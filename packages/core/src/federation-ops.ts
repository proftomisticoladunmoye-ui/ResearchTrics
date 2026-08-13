import { prisma, type PrismaClient } from '@researchtrics/db';
import {
  allFederationProviders,
  type ScholarlyMetadataProvider,
  type ProviderHealth,
} from '@researchtrics/federation';
import { notFound } from './errors';
import { getCircuitBreaker, CircuitOpenError, type CircuitState } from './circuit-breaker';

/**
 * Federation operations & audits (addendum §34, §40, §42).
 *
 * The presentation/ops layer over the federation: provider health, a data
 * quality framework, and a multi-source research-visibility audit. Every figure
 * is a grounded count over real records — nothing fabricated.
 */

// ---------- Source health (§34) ----------

function federationConfigFromEnv() {
  return {
    openalex: { baseUrl: process.env.OPENALEX_BASE_URL ?? 'https://api.openalex.org', mailto: process.env.OPENALEX_MAILTO },
    crossref: { baseUrl: process.env.CROSSREF_BASE_URL ?? 'https://api.crossref.org', mailto: process.env.CROSSREF_MAILTO },
    datacite: { baseUrl: process.env.DATACITE_BASE_URL },
    pubmed: { baseUrl: process.env.PUBMED_BASE_URL, apiKey: process.env.PUBMED_API_KEY, tool: process.env.PUBMED_TOOL, email: process.env.PUBMED_EMAIL },
    ror: { baseUrl: process.env.ROR_BASE_URL },
  };
}

async function withTimeout(p: Promise<ProviderHealth>, ms: number, provider: string): Promise<ProviderHealth> {
  let timer: NodeJS.Timeout;
  const timeout = new Promise<ProviderHealth>((resolve) => {
    timer = setTimeout(
      () => resolve({ provider, status: 'down', checkedAt: new Date().toISOString(), error: 'timeout' }),
      ms,
    );
  });
  try {
    return await Promise.race([p, timeout]);
  } finally {
    clearTimeout(timer!);
  }
}

/** A provider's health plus the circuit-breaker state guarding its outbound calls. */
export interface ProviderHealthWithCircuit extends ProviderHealth {
  circuit: CircuitState;
}

/**
 * Probe every configured provider's health (§34), each timeout-guarded and
 * routed through a per-provider circuit breaker (Phase 15). A provider that
 * keeps reporting `down` trips its breaker OPEN, so subsequent probes fail fast
 * (`circuit_open`) instead of hanging — the same breaker guards live ingestion
 * calls. Breaker state is surfaced so operators can see a source cooling down.
 */
export async function federationHealthReport(
  providers?: ScholarlyMetadataProvider[],
  timeoutMs = 4000,
): Promise<ProviderHealthWithCircuit[]> {
  const list = providers ?? allFederationProviders(federationConfigFromEnv());
  return Promise.all(list.map((p) => guardedHealthProbe(p, timeoutMs)));
}

async function guardedHealthProbe(
  provider: ScholarlyMetadataProvider,
  timeoutMs: number,
): Promise<ProviderHealthWithCircuit> {
  const breaker = getCircuitBreaker(`federation:${provider.name}`);
  try {
    // Treat a `down` health as a breaker failure so repeated outages trip it.
    const health = await breaker.execute(async () => {
      const h = await withTimeout(provider.healthCheck(), timeoutMs, provider.name);
      if (h.status === 'down') throw new ProbeDownError(h);
      return h;
    });
    return { ...health, circuit: breaker.currentState() };
  } catch (err) {
    if (err instanceof ProbeDownError) {
      return { ...err.health, circuit: breaker.currentState() };
    }
    if (err instanceof CircuitOpenError) {
      return {
        provider: provider.name,
        status: 'down',
        checkedAt: new Date().toISOString(),
        error: 'circuit_open',
        circuit: 'open',
      };
    }
    return {
      provider: provider.name,
      status: 'down',
      checkedAt: new Date().toISOString(),
      error: err instanceof Error ? err.message : 'unknown error',
      circuit: breaker.currentState(),
    };
  }
}

/** Internal: carries a `down` health through the breaker as a failure. */
class ProbeDownError extends Error {
  constructor(readonly health: ProviderHealth) {
    super('provider down');
    this.name = 'ProbeDownError';
  }
}

// ---------- Data quality framework (§42) ----------

export interface DataQualityMetric {
  key: string;
  label: string;
  /** 0..100 — higher is better. */
  score: number;
  detail: string;
}

export interface DataQualityReport {
  /** Overall 0..100 — the mean of the metric scores. */
  score: number;
  metrics: DataQualityMetric[];
}

const ORCID_RE = /^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/;
const pct = (n: number, d: number) => (d === 0 ? 100 : Math.round((n / d) * 100));

export async function dataQualityReport(client: PrismaClient = prisma): Promise<DataQualityReport> {
  const [
    researcherCount,
    withInterests,
    withAffiliation,
    orcidIds,
    pubCount,
    pubWithAbstract,
    pubDoiCount,
    provResearchers,
  ] = await Promise.all([
    client.researcher.count({ where: { deletedAt: null } }),
    client.researcher.count({ where: { deletedAt: null, interests: { some: {} } } }),
    client.researcher.count({ where: { deletedAt: null, affiliations: { some: {} } } }),
    client.researcherIdentifier.findMany({ where: { scheme: 'orcid' }, select: { value: true } }),
    client.publication.count({ where: { deletedAt: null } }),
    client.publication.count({ where: { deletedAt: null, abstract: { not: null } } }),
    client.publicationIdentifier.count({ where: { scheme: 'doi' } }),
    client.researcher.count({ where: { deletedAt: null, discoverySources: { some: {} } } }),
  ]);

  // Uniqueness: duplicate ORCID values (should be globally unique).
  const orcidValues = orcidIds.map((i) => i.value);
  const orcidUnique = new Set(orcidValues).size;
  const orcidDupes = orcidValues.length - orcidUnique;
  // Validity: malformed ORCID strings.
  const orcidInvalid = orcidValues.filter((v) => !ORCID_RE.test(v)).length;

  const metrics: DataQualityMetric[] = [
    { key: 'completeness_interests', label: 'Researchers with interests', score: pct(withInterests, researcherCount), detail: `${withInterests}/${researcherCount}` },
    { key: 'completeness_affiliation', label: 'Researchers with an affiliation', score: pct(withAffiliation, researcherCount), detail: `${withAffiliation}/${researcherCount}` },
    { key: 'completeness_abstract', label: 'Publications with an abstract', score: pct(pubWithAbstract, pubCount), detail: `${pubWithAbstract}/${pubCount}` },
    { key: 'completeness_doi', label: 'Publications with a DOI', score: pct(Math.min(pubDoiCount, pubCount), pubCount), detail: `${pubDoiCount} DOIs / ${pubCount} publications` },
    { key: 'uniqueness_orcid', label: 'ORCID uniqueness', score: pct(orcidUnique, orcidValues.length || 1), detail: orcidDupes === 0 ? 'no duplicates' : `${orcidDupes} duplicate(s)` },
    { key: 'validity_orcid', label: 'ORCID format validity', score: pct((orcidValues.length - orcidInvalid), orcidValues.length || 1), detail: orcidInvalid === 0 ? 'all valid' : `${orcidInvalid} invalid` },
    { key: 'provenance_coverage', label: 'Discovered researchers with provenance', score: pct(provResearchers, provResearchers === 0 ? 1 : provResearchers), detail: `${provResearchers} with source records` },
  ];

  const score = Math.round(metrics.reduce((s, m) => s + m.score, 0) / metrics.length);
  return { score, metrics };
}

// ---------- Research Visibility Audit (§40) ----------

export interface VisibilityAudit {
  coverage: {
    publications: number;
    withDoi: number;
    withAbstract: number;
    datasets: number;
    software: number;
    projects: number;
    hasOrcid: boolean;
    affiliations: number;
  };
  gaps: string[];
  recommendations: string[];
}

/**
 * A multi-source research-visibility audit for a researcher (§40): what their
 * ResearchTrics footprint contains, where the gaps are, and what to do — all
 * from real records, never fabricated.
 */
export async function researchVisibilityAudit(
  researcherId: string,
  client: PrismaClient = prisma,
): Promise<VisibilityAudit> {
  const researcher = await client.researcher.findUnique({
    where: { id: researcherId },
    include: {
      identifiers: true,
      affiliations: { include: { institution: { select: { rorId: true } } } },
      _count: { select: { datasetsCreated: true, softwareAuthored: true, projectsLed: true } },
    },
  });
  if (!researcher) throw notFound('Researcher not found');

  const publications = await client.publication.findMany({
    where: { deletedAt: null, authors: { some: { researcherId } } },
    select: { abstract: true, identifiers: { select: { scheme: true } } },
  });
  const withDoi = publications.filter((p) => p.identifiers.some((i) => i.scheme === 'doi')).length;
  const withAbstract = publications.filter((p) => !!p.abstract).length;
  const hasOrcid = researcher.identifiers.some((i) => i.scheme === 'orcid');
  const unresolvedInstitutions = researcher.affiliations.filter((a) => !a.institution?.rorId).length;

  const coverage: VisibilityAudit['coverage'] = {
    publications: publications.length,
    withDoi,
    withAbstract,
    datasets: researcher._count.datasetsCreated,
    software: researcher._count.softwareAuthored,
    projects: researcher._count.projectsLed,
    hasOrcid,
    affiliations: researcher.affiliations.length,
  };

  const gaps: string[] = [];
  const recommendations: string[] = [];
  if (!hasOrcid) {
    gaps.push('No ORCID iD connected');
    recommendations.push('Connect your ORCID iD to verify identity and link works');
  }
  if (publications.length > 0 && withDoi < publications.length) {
    gaps.push(`${publications.length - withDoi} publication(s) missing a DOI`);
    recommendations.push('Add DOIs to publications for better discoverability');
  }
  if (publications.length > 0 && withAbstract < publications.length) {
    gaps.push(`${publications.length - withAbstract} publication(s) missing an abstract`);
    recommendations.push('Add missing abstracts');
  }
  if (researcher.affiliations.length === 0) {
    gaps.push('No institutional affiliation');
    recommendations.push('Add your institutional affiliation');
  } else if (unresolvedInstitutions > 0) {
    gaps.push(`${unresolvedInstitutions} affiliation(s) not resolved to a ROR institution`);
    recommendations.push('Resolve institution identity via ROR');
  }
  if (coverage.datasets + coverage.software === 0) {
    recommendations.push('Discover and link datasets/software via DataCite');
  }

  return { coverage, gaps, recommendations };
}

// ---------- Unified record read (§29) ----------

export async function getUnifiedWorkByPublicId(publicId: string, client: PrismaClient = prisma) {
  return client.unifiedWorkRecord.findUnique({
    where: { publicId },
    include: { fieldProvenance: { orderBy: [{ field: 'asc' }, { source: 'asc' }] } },
  });
}
