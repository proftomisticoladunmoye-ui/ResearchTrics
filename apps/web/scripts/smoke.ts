/**
 * End-to-end smoke test against a REAL PostgreSQL (via embedded-postgres — no
 * Docker/admin needed). Applies the committed migration and exercises the core
 * stack: identity, outputs, publication import + dedup, RVM, search, and the
 * Google Scholar checker. Run: `pnpm --filter @researchtrics/web smoke`.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import EmbeddedPostgres from 'embedded-postgres';
import pg from 'pg';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..', '..', '..');
const migrationPath = join(repoRoot, 'packages', 'db', 'prisma', 'migrations', '00000000000000_init', 'migration.sql');

const PORT = 55432;
const DB = 'researchtrics';
const USER = 'researchtrics';
const PASS = 'researchtrics';
const dataDir = join(tmpdir(), 'researchtrics-smoke-pgdata');

process.env.DATABASE_URL = `postgresql://${USER}:${PASS}@localhost:${PORT}/${DB}?schema=public`;
process.env.SESSION_SECRET = 'x'.repeat(40);
process.env.TOKEN_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString('base64');
process.env.NODE_ENV = 'test';

let pass = 0;
let fail = 0;
function check(name: string, cond: boolean, detail = '') {
  if (cond) {
    pass += 1;
    console.log(`  [PASS] ${name}${detail ? ` — ${detail}` : ''}`);
  } else {
    fail += 1;
    console.log(`  [FAIL] ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

async function main() {
  const server = new EmbeddedPostgres({ databaseDir: dataDir, user: USER, password: PASS, port: PORT, persistent: false });
  console.log('Booting embedded PostgreSQL…');
  await server.initialise();
  await server.start();
  await server.createDatabase(DB);
  console.log('PostgreSQL up on port', PORT);

  // Apply the committed migration (strip pg_trgm — contrib may be absent in the
  // embedded build; not needed for these runtime queries).
  const migrationSql = readFileSync(migrationPath, 'utf8').replace(
    /CREATE EXTENSION IF NOT EXISTS pg_trgm;\n?/g,
    '',
  );
  const client = new pg.Client({ host: 'localhost', port: PORT, user: USER, password: PASS, database: DB });
  await client.connect();
  await client.query(migrationSql);
  await client.end();
  console.log('Migration applied (36 tables).\n');

  // Dynamic imports AFTER env + DB are ready (prisma reads DATABASE_URL on init).
  const core = await import('@researchtrics/core');
  const { PostgresSearchIndex } = await import('@researchtrics/search');
  const { prisma } = await import('@researchtrics/db');

  try {
    console.log('Identity & auth');
    const reg = await core.registerResearcher({ email: 'ada@example.org', password: 'correcthorse7!', displayName: 'Ada Lovelace' });
    check('register mints RTX id', /^RTX-\d{8}$/.test(reg.researcher.researchtricsId), reg.researcher.researchtricsId);
    const authed = await core.authenticate('ada@example.org', 'correcthorse7!');
    check('authenticate returns the user', authed.id === reg.user.id);
    let dupThrew = false;
    await core.registerResearcher({ email: 'ada@example.org', password: 'correcthorse7!', displayName: 'Dupe' }).catch(() => {
      dupThrew = true;
    });
    check('duplicate email rejected', dupThrew);

    console.log('\nResearch outputs');
    const proj = await core.createProject(reg.researcher.id, { title: 'Measurement Invariance Programme' }, reg.user.id);
    check('project mints RTJ id', /^RTJ-\d{8}$/.test(proj.publicId), proj.publicId);
    const ds = await core.createDataset(reg.researcher.id, { title: 'Cross-cultural sample 2020', accessLevel: 'open' });
    check('dataset mints RTD id', /^RTD-\d{8}$/.test(ds.publicId), ds.publicId);
    const inst = await core.createInstrument(reg.researcher.id, { title: 'Resilience Scale', construct: 'Resilience', itemCount: 12 });
    check('instrument mints RTI id', /^RTI-\d{8}$/.test(inst.publicId), inst.publicId);
    const sw = await core.createSoftware(reg.researcher.id, { name: 'invariance-r', version: '1.0.0' });
    check('software mints RTS id', /^RTS-\d{8}$/.test(sw.publicId), sw.publicId);

    console.log('\nPublications & dedup');
    const normalized = {
      title: 'A Study of Measurement Invariance',
      abstract: 'We examine invariance across cultures.',
      doi: '10.1234/smoke.1',
      journalTitle: 'Journal of Testing',
      issnElectronic: '2515-8260',
      volume: '12',
      issue: '3',
      firstPage: '45',
      lastPage: '67',
      publishedYear: 2020,
      openAccess: true,
      authors: [{ rawName: 'Ada Lovelace', givenName: 'Ada', familyName: 'Lovelace' }],
      citationCounts: [
        { source: 'crossref' as const, count: 12 },
        { source: 'openalex' as const, count: 15 },
      ],
      provenance: [{ source: 'crossref' as const, sourceId: '10.1234/smoke.1' }],
    };
    const created = await core.createPublicationFromNormalized(normalized);
    check('publication created + RTP id', created.status === 'created');
    const again = await core.createPublicationFromNormalized(normalized);
    check('dedup on DOI returns existing (no duplicate)', again.status === 'exists' && again.publicationId === created.publicationId);

    console.log('\nCitation export & Google Scholar checker');
    const pubDetail = await core.getPublicationBySlug(created.slug);
    check('publication loads by slug', !!pubDetail);
    if (pubDetail) {
      const bibtex = core.formatCitation(core.buildCitationData(pubDetail), 'bibtex');
      check('BibTeX export produced', bibtex.includes('@article') && bibtex.includes('Lovelace'));
      const report = core.checkGoogleScholarCompliance(core.scholarInputFromPublication(pubDetail));
      check('Scholar checker runs', report.overall === 'pass' || report.overall === 'warning', `overall=${report.overall} pass=${report.summary.pass} warn=${report.summary.warning} fail=${report.summary.fail}`);
    }

    console.log('\nRVM');
    const rvm = await core.computeAndStoreRvm(reg.researcher.id);
    check('RVM computes overall in 0..100', rvm.result.overall >= 0 && rvm.result.overall <= 100, `overall=${rvm.result.overall}`);
    check('RVM has 10 transparent dimensions', rvm.result.dimensions.length === 10);
    check('RVM confidence in 0..1', rvm.result.confidence >= 0 && rvm.result.confidence <= 1, `conf=${rvm.result.confidence}`);
    check('RVM snapshot persisted', (await prisma.rvmScore.count()) >= 1);

    console.log('\nSearch');
    const index = new PostgresSearchIndex(prisma);
    const res = await index.search({ q: 'invariance' });
    check('search finds seeded content', res.total > 0, `total=${res.total}`);
    check('search facets populated', res.facets.types.publication + res.facets.types.project >= 1, `pub=${res.facets.types.publication} proj=${res.facets.types.project} sw=${res.facets.types.software}`);

    console.log('\nAnalytics (bot-filtered)');
    await core.recordEvent({ eventType: 'publication_view', entityType: 'publication', entityId: created.publicationId, userAgent: 'Mozilla/5.0 (human)', ip: '1.2.3.4' });
    await core.recordEvent({ eventType: 'publication_view', entityType: 'publication', entityId: created.publicationId, userAgent: 'Googlebot/2.1', ip: '9.9.9.9' });
    const pm = await core.getEntityMetrics('publication', created.publicationId);
    check('human view counted, bot excluded', pm.publication_view === 1, `views=${pm.publication_view}`);
    const dup = await core.getEntityMetrics('publication', created.publicationId);
    await core.recordEvent({ eventType: 'publication_view', entityType: 'publication', entityId: created.publicationId, userAgent: 'Mozilla/5.0 (human)', ip: '1.2.3.4' });
    const after = await core.getEntityMetrics('publication', created.publicationId);
    check('repeat view de-duplicated', after.publication_view === dup.publication_view, `still=${after.publication_view}`);

    console.log('\nCollaboration (explainable)');
    await core.setInterests(reg.researcher.id, ['psychometrics', 'measurement invariance']);
    const reg2 = await core.registerResearcher({ email: 'alan@example.org', password: 'correcthorse7!', displayName: 'Alan Turing' });
    await core.setInterests(reg2.researcher.id, ['psychometrics', 'computation']);
    const recs = await core.recommendCollaborators(reg.researcher.id, 10);
    check('recommends a collaborator with shared interest', recs.length >= 1 && recs[0]!.researcherId === reg2.researcher.id, recs[0]?.displayName);
    check('every recommendation is explained (Spec §29)', recs.every((r) => r.reasons.length > 0), recs[0]?.reasons.join('; '));
    const cr = await core.createCollaborationRequest(reg.researcher.id, reg2.researcher.id, 'Keen to collaborate');
    await core.respondToRequest(cr.id, reg2.researcher.id, true);
    const incoming = await core.listIncomingRequests(reg2.researcher.id);
    check('request accepted (no longer pending)', incoming.length === 0);

    console.log('\nResearch groups');
    const grp = await core.createGroup(reg.researcher.id, { name: 'Psychometrics Lab', interests: 'psychometrics' });
    const groupDetail = await core.getGroupBySlug(grp.slug);
    check('group created with lead as member', groupDetail?.members.length === 1 && groupDetail.members[0]!.researcherId === reg.researcher.id);
    await core.addGroupMember(grp.id, reg2.researcher.id, 'Member');
    const after2 = await core.getGroupBySlug(grp.slug);
    check('member added to group', after2?.members.length === 2);

    console.log('\nAI Research Intelligence (grounded, on-platform)');
    const intel = await core.getResearcherIntelligence(reg.researcher.id);
    check(
      'profile summary is generated on-platform by default',
      intel.summary.providerName === 'local' && intel.summary.external === false,
      `provider=${intel.summary.providerName}`,
    );
    check(
      'summary is grounded in real records (mentions the researcher)',
      intel.summary.generation.text.includes('Ada Lovelace'),
      intel.summary.generation.text.slice(0, 80),
    );
    const factRefs = new Set(intel.summary.facts.map((f) => f.ref));
    check(
      'no fabrication — every cited source is a provided record (Spec §29)',
      intel.summary.generation.sources.every((s) => factRefs.has(s)),
    );
    check(
      'expertise extracted from stated interests',
      intel.expertise.some((t) => t.term === 'psychometrics'),
      intel.expertise.map((t) => t.term).join(', '),
    );
    check(
      'every expertise term is explained by evidence (Spec §29)',
      intel.expertise.length > 0 && intel.expertise.every((t) => t.evidence.length > 0),
    );

    console.log('\nInstitutional platform (tenant-scoped, grounded)');
    const institution = await core.findOrCreateInstitutionByName('Smoke University', { country: 'GB' });
    await core.addAffiliation({ researcherId: reg.researcher.id, institutionId: institution.id, verified: true });
    const pendingAff = await core.addAffiliation({
      researcherId: reg2.researcher.id,
      institutionId: institution.id,
      verified: false,
    });
    const adminActor = {
      userId: reg.user.id,
      roles: [{ role: 'institution_admin' as const, scopeType: 'institution' as const, scopeId: institution.id }],
    };
    const plainActor = {
      userId: reg2.user.id,
      roles: [{ role: 'researcher' as const, scopeType: 'global' as const, scopeId: null }],
    };

    const ov1 = await core.getInstitutionOverview(institution.id);
    check('overview counts affiliated researchers from real records', ov1.researcherCount === 2, `researchers=${ov1.researcherCount}`);
    check('overview shows one pending, one verified affiliation', ov1.pendingAffiliationCount === 1 && ov1.verifiedAffiliationCount === 1, `pending=${ov1.pendingAffiliationCount} verified=${ov1.verifiedAffiliationCount}`);

    check('tenant isolation — admin cannot manage another institution (Spec §49)', core.canManageInstitution(adminActor, 'some-other-institution') === false);
    check('tenant isolation — a plain researcher cannot manage the institution', core.canManageInstitution(plainActor, institution.id) === false);

    let deniedThrew = false;
    await core.verifyAffiliation(plainActor, pendingAff.id).catch(() => {
      deniedThrew = true;
    });
    check('non-admin verify is rejected (FORBIDDEN)', deniedThrew);

    await core.verifyAffiliation(adminActor, pendingAff.id);
    const ov2 = await core.getInstitutionOverview(institution.id);
    check('admin verify confirms the affiliation', ov2.pendingAffiliationCount === 0 && ov2.verifiedAffiliationCount === 2, `pending=${ov2.pendingAffiliationCount} verified=${ov2.verifiedAffiliationCount}`);
    const verifiedResearcher = await prisma.researcher.findUnique({ where: { id: reg2.researcher.id }, select: { verificationLevel: true } });
    check('verifying raises identity to institution level (Spec §38)', (verifiedResearcher?.verificationLevel ?? 0) >= 2, `level=${verifiedResearcher?.verificationLevel}`);

    console.log('\nProfile read');
    const profile = await core.getResearcherBySlug(reg.researcher.slug);
    check('researcher profile loads by slug', profile?.researchtricsId === reg.researcher.researchtricsId);

    await prisma.$disconnect();
  } finally {
    // embedded-postgres deletes its data dir on stop; on Windows a lingering
    // file handle can make that rmdir race (EBUSY). Teardown cleanup must never
    // mask the test outcome — swallow it and let the exit code reflect `fail`.
    try {
      await server.stop();
    } catch (stopErr) {
      console.warn('  [warn] embedded-postgres teardown:', (stopErr as Error).message);
    }
  }

  console.log(`\n${'='.repeat(44)}\nSMOKE RESULT: ${pass} passed, ${fail} failed\n${'='.repeat(44)}`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error('SMOKE ERROR:', err);
  process.exit(1);
});
