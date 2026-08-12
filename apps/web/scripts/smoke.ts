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

    console.log('\nProfile read');
    const profile = await core.getResearcherBySlug(reg.researcher.slug);
    check('researcher profile loads by slug', profile?.researchtricsId === reg.researcher.researchtricsId);

    await prisma.$disconnect();
  } finally {
    await server.stop();
  }

  console.log(`\n${'='.repeat(44)}\nSMOKE RESULT: ${pass} passed, ${fail} failed\n${'='.repeat(44)}`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error('SMOKE ERROR:', err);
  process.exit(1);
});
