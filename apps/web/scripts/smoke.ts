/**
 * End-to-end smoke test against a REAL PostgreSQL (via embedded-postgres — no
 * Docker/admin needed). Applies the committed migration and exercises the core
 * stack: identity, outputs, publication import + dedup, RVM, search, and the
 * Google Scholar checker. Run: `pnpm --filter @researchtrics/web smoke`.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import EmbeddedPostgres from 'embedded-postgres';
import pg from 'pg';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..', '..', '..');
const migrationsDir = join(repoRoot, 'packages', 'db', 'prisma', 'migrations');

/** All committed migration SQL files, in apply order. */
function allMigrations(): string[] {
  return readdirSync(migrationsDir)
    .filter((d) => /^\d/.test(d))
    .sort()
    .map((d) => join(migrationsDir, d, 'migration.sql'));
}

const PORT = 55432;
const DB = 'researchtrics';
const USER = 'researchtrics';
const PASS = 'researchtrics';
const dataDir = join(tmpdir(), 'researchtrics-smoke-pgdata');

process.env.DATABASE_URL = `postgresql://${USER}:${PASS}@localhost:${PORT}/${DB}?schema=public`;
process.env.SESSION_SECRET = 'x'.repeat(40);
process.env.TOKEN_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString('base64');
process.env.NODE_ENV = 'test';
process.env.LOCAL_STORAGE_DIR = join(tmpdir(), 'researchtrics-smoke-storage');

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
  const client = new pg.Client({ host: 'localhost', port: PORT, user: USER, password: PASS, database: DB });
  await client.connect();
  for (const path of allMigrations()) {
    const sql = readFileSync(path, 'utf8').replace(/CREATE EXTENSION IF NOT EXISTS pg_trgm;\n?/g, '');
    await client.query(sql);
  }
  await client.end();
  console.log('Migration applied.\n');

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

    // Re-importing a soft-deleted DOI must RESTORE it, not return a dead slug
    // (which 404s) — the DOI is globally unique so a fresh row can't be made.
    await prisma.publication.update({ where: { id: created.publicationId }, data: { deletedAt: new Date() } });
    check('publication is soft-deleted (not visible by slug)', (await core.getPublicationBySlug(created.slug)) === null);
    const reimport = await core.createPublicationFromNormalized(normalized);
    check('re-import of a removed DOI restores it (same id)', reimport.status === 'exists' && reimport.publicationId === created.publicationId);
    check('restored publication is visible by slug again (no 404)', (await core.getPublicationBySlug(created.slug)) !== null);

    // Citation-count refresh keeps on-platform totals live (§33): re-pull the
    // current count from OpenAlex for a work whose stored count is stale.
    const citePub = await core.createPublicationFromNormalized({
      title: 'Cited Work For Refresh',
      openAlexId: 'W_cite_refresh',
      authors: [{ rawName: 'Cite Author' }],
      citationCounts: [{ source: 'openalex' as const, count: 5 }],
    });
    const fakeOpenAlex = (async () => ({
      ok: true,
      status: 200,
      json: async () => ({ results: [{ id: 'https://openalex.org/W_cite_refresh', cited_by_count: 99 }] }),
    })) as unknown as typeof fetch;
    const refreshed = await core.refreshCitationCounts({ staleAfterDays: -1, fetchImpl: fakeOpenAlex });
    check('citation refresh updates a stale count from OpenAlex', refreshed.updated >= 1, JSON.stringify(refreshed));
    const refreshedCount = await prisma.publicationCitationCount.findUnique({
      where: { publicationId_source: { publicationId: citePub.publicationId, source: 'openalex' } },
      select: { count: true },
    });
    check('refreshed publication reflects the new citation count', refreshedCount?.count === 99, `count=${refreshedCount?.count}`);

    // DOI minting (§37): register a DataCite DOI for a work that has none.
    process.env.DATACITE_ENDPOINT = 'https://api.test.datacite.org';
    process.env.DATACITE_REPOSITORY_ID = 'SMOKE.TEST';
    process.env.DATACITE_PASSWORD = 'smoke-secret';
    process.env.DATACITE_PREFIX = '10.99999';
    const doiPub = await core.createManualPublication(reg.researcher.id, reg.researcher.displayName, {
      title: 'A Book Without a DOI',
      outputType: 'book',
    });
    let mintedBody: unknown = null;
    const fakeDataCite = (async (_url: string, init?: { body?: string }) => {
      mintedBody = JSON.parse(String(init?.body ?? '{}'));
      return {
        ok: true,
        status: 201,
        json: async () => ({ data: { id: '10.99999/smoke-abc', attributes: { state: 'findable' } } }),
        text: async () => '',
      };
    }) as unknown as typeof fetch;
    const minted = await core.mintPublicationDoi(doiPub.publicationId, { fetchImpl: fakeDataCite, publish: true });
    check('DOI minted and returned', minted.status === 'minted' && minted.doi === '10.99999/smoke-abc');
    check(
      'mint payload carries DataCite creators + findable event',
      !!(mintedBody as { data?: { attributes?: { event?: string; creators?: unknown[] } } })?.data?.attributes?.event &&
        Array.isArray((mintedBody as { data?: { attributes?: { creators?: unknown[] } } }).data?.attributes?.creators),
    );
    check(
      'minted DOI is stored as a publication identifier',
      (await prisma.publicationIdentifier.findFirst({
        where: { publicationId: doiPub.publicationId, scheme: 'doi', value: '10.99999/smoke-abc' },
      })) !== null,
    );
    const second = await core.mintPublicationDoi(doiPub.publicationId, { fetchImpl: fakeDataCite });
    check('re-minting returns the existing DOI (idempotent)', second.status === 'exists' && second.doi === '10.99999/smoke-abc');
    delete process.env.DATACITE_ENDPOINT;
    delete process.env.DATACITE_REPOSITORY_ID;
    delete process.env.DATACITE_PASSWORD;
    delete process.env.DATACITE_PREFIX;

    // ORCID work push-back (§13): add a researcher's own work to their ORCID
    // record via the member API, with put-code tracking for idempotency.
    const orcid = await import('@researchtrics/integration-orcid');
    process.env.ORCID_CLIENT_ID = 'APP-SMOKE';
    process.env.ORCID_CLIENT_SECRET = 'smoke-secret';
    process.env.ORCID_REDIRECT_URI = 'https://www.researchtrics.com/api/v1/integrations/orcid/callback';
    process.env.ORCID_ENVIRONMENT = 'sandbox';
    process.env.ORCID_ENABLE_WORK_SYNC = 'true';
    check('ORCID work sync gates on the env flag', orcid.isOrcidWorkSyncEnabled() === true);
    const orcidPub = await core.createManualPublication(reg.researcher.id, reg.researcher.displayName, {
      title: 'A Work To Sync To ORCID',
      outputType: 'journal_article',
    });
    await prisma.orcidConnection.create({
      data: {
        researcherId: reg.researcher.id,
        orcid: '0000-0002-1825-0097',
        accessTokenEnc: core.encryptSecret('fake-access-token'),
        scope: '/authenticate /activities/update',
      },
    });
    const fakeOrcid = (async () => ({
      status: 201,
      headers: new Headers({ location: 'https://api.sandbox.orcid.org/v3.0/0000-0002-1825-0097/work/987654' }),
      text: async () => '',
    })) as unknown as typeof fetch;
    const pushed = await orcid.pushPublicationToOrcid(reg.researcher.id, orcidPub.publicationId, { fetchImpl: fakeOrcid });
    check('work pushed to ORCID returns a put-code', pushed.status === 'pushed' && pushed.putCode === '987654');
    check(
      'the ORCID push is recorded for idempotency',
      (await prisma.orcidWorkSync.findUnique({
        where: { researcherId_publicationId: { researcherId: reg.researcher.id, publicationId: orcidPub.publicationId } },
      })) !== null,
    );
    const pushedAgain = await orcid.pushPublicationToOrcid(reg.researcher.id, orcidPub.publicationId, { fetchImpl: fakeOrcid });
    check('re-pushing the same work is a no-op (returns existing put-code)', pushedAgain.status === 'exists');
    const stranger = await core.registerResearcher({
      email: 'stranger@example.org',
      password: 'strangerpass9!',
      displayName: 'Stranger Researcher',
    });
    await prisma.orcidConnection.create({
      data: {
        researcherId: stranger.researcher.id,
        orcid: '0000-0002-1825-0098',
        accessTokenEnc: core.encryptSecret('another-token'),
        scope: '/authenticate /activities/update',
      },
    });
    let notMyWork = false;
    await orcid
      .pushPublicationToOrcid(stranger.researcher.id, orcidPub.publicationId, { fetchImpl: fakeOrcid })
      .catch(() => {
        notMyWork = true;
      });
    check('a researcher cannot push a work they did not author', notMyWork);
    await prisma.orcidConnection.deleteMany({ where: { researcherId: stranger.researcher.id } });
    await prisma.orcidWorkSync.deleteMany({ where: { researcherId: reg.researcher.id } });
    await prisma.orcidConnection.deleteMany({ where: { researcherId: reg.researcher.id } });
    delete process.env.ORCID_CLIENT_ID;
    delete process.env.ORCID_CLIENT_SECRET;
    delete process.env.ORCID_REDIRECT_URI;
    delete process.env.ORCID_ENABLE_WORK_SYNC;

    // A DOI-less work discovered via multiple co-authors must dedup on its
    // OpenAlex id — not create a duplicate (which would violate the identifier
    // unique constraint, as seen in production worker logs).
    const oaWork = {
      title: 'A Preprint Without a DOI',
      outputType: 'preprint' as const,
      openAlexId: 'W-smoke-dedup-1',
      authors: [{ rawName: 'Grace Hopper' }],
    };
    const oa1 = await core.createPublicationFromNormalized(oaWork);
    const oa2 = await core.createPublicationFromNormalized(oaWork);
    check(
      'dedup on OpenAlex id returns existing (no unique-constraint crash)',
      oa1.status === 'created' && oa2.status === 'exists' && oa2.publicationId === oa1.publicationId,
      `${oa1.status}/${oa2.status}`,
    );

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
    // The recipient must actually receive it: in their inbox AND as an alert (§41).
    const incomingBefore = await core.listIncomingRequests(reg2.researcher.id);
    check('recipient receives the request in their inbox', incomingBefore.some((r) => r.id === cr.id));
    const collabNotifs = await core.listNotifications(reg2.researcher.id);
    check(
      'recipient is alerted with a collaboration notification (§41)',
      collabNotifs.some((n) => n.type === 'collaboration_request' && /wants to collaborate/.test(n.message) && n.href === '/dashboard/collaborate' && !n.read),
    );
    await core.respondToRequest(cr.id, reg2.researcher.id, true);
    const incoming = await core.listIncomingRequests(reg2.researcher.id);
    check('request accepted (no longer pending)', incoming.length === 0);

    console.log('\nFollowing (social edge + notification, §18/§41)');
    await core.followResearcher(reg.researcher.id, reg2.researcher.id);
    const st1 = await core.getFollowState(reg2.researcher.id, reg.researcher.id);
    check('follow creates an edge + follower count', st1.isFollowing && st1.followers >= 1, JSON.stringify(st1));
    check(
      'followed researcher is alerted (§41)',
      (await core.listNotifications(reg2.researcher.id)).some((n) => n.type === 'follow' && /started following you/.test(n.message)),
    );
    await core.followResearcher(reg.researcher.id, reg2.researcher.id); // idempotent
    const st1b = await core.getFollowState(reg2.researcher.id, reg.researcher.id);
    check('following is idempotent (no duplicate)', st1b.followers === st1.followers);
    await core.unfollowResearcher(reg.researcher.id, reg2.researcher.id);
    const st2 = await core.getFollowState(reg2.researcher.id, reg.researcher.id);
    check('unfollow removes the edge', !st2.isFollowing && st2.followers === st1.followers - 1);

    console.log('\nSaved publications (private bookmarks, §18)');
    await core.savePublication(reg.researcher.id, created.publicationId);
    check('save bookmarks a publication', await core.isPublicationSaved(reg.researcher.id, created.publicationId));
    check(
      'saved list includes it',
      (await core.listSavedPublications(reg.researcher.id)).some((s) => s.id === created.publicationId),
    );
    await core.unsavePublication(reg.researcher.id, created.publicationId);
    check('unsave removes the bookmark', !(await core.isPublicationSaved(reg.researcher.id, created.publicationId)));

    console.log('\nFollowing feed (latest from who you follow, §18)');
    const reg2pub = await core.createManualPublication(reg2.researcher.id, reg2.researcher.displayName, {
      title: 'Turing on Computation',
      outputType: 'journal_article',
    });
    await core.followResearcher(reg.researcher.id, reg2.researcher.id);
    const feed = await core.getFollowingFeed(reg.researcher.id, { take: 20 });
    check(
      'feed surfaces public work by followed researchers',
      feed.some((f) => f.id === reg2pub.publicationId),
      `items=${feed.length}`,
    );
    check('empty feed when following no one', (await core.getFollowingFeed(reg2.researcher.id, { take: 5 })).length === 0);

    // Shared authorship: when one co-author uploads, it counts for the rest.
    const shared = await core.createManualPublication(reg.researcher.id, reg.researcher.displayName, {
      title: 'A Jointly Authored Study',
      outputType: 'journal_article',
      coAuthors: [
        { name: reg2.researcher.displayName, researcherId: reg2.researcher.id }, // linked from platform
        { name: 'Off-platform Person' }, // stays unlinked
      ],
    });
    const reg2Pubs = await core.listResearcherPublications(reg2.researcher.id, { take: 50 });
    check(
      'linked co-author gets the uploaded work on their own profile',
      reg2Pubs.some((p) => p.id === shared.publicationId),
    );
    const reg2Analytics = await core.getResearcherAnalytics(reg2.researcher.id);
    check('shared work counts toward the co-author publication total', reg2Analytics.publicationCount >= 1);
    check(
      'co-author is notified of being added to the shared work',
      (await core.listNotifications(reg2.researcher.id)).some(
        (n) => n.type === 'coauthor_added' && n.publicationTitle === 'A Jointly Authored Study',
      ),
    );
    // The uploader must never fabricate someone else's authorship silently: a
    // co-author can detach themselves, and the shared record survives.
    const detach = await core.removePublicationForResearcher(reg2.researcher.id, shared.publicationId);
    check('a wrongly-tagged co-author can remove themselves (record preserved)', detach.unlinked && !detach.deleted);
    check(
      'after removal the work no longer counts for that co-author',
      !(await core.listResearcherPublications(reg2.researcher.id, { take: 50 })).some((p) => p.id === shared.publicationId),
    );

    // Exact upload path the form uses: store a PDF, then create a manual
    // publication that references it AND links a platform co-author. This is the
    // combination reported as failing in production.
    const pdfBytes = new TextEncoder().encode(
      '%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\nBT /F1 12 Tf (Joint study text) Tj ET\n%%EOF',
    );
    const storedDoc = await core.storeFile({
      data: pdfBytes,
      filename: 'Dr Leah Paper.pdf',
      mimeType: 'application/pdf',
      accessLevel: 'public',
      uploaderId: reg.user.id,
    });
    check('research document (PDF with text) uploads and stores', !!storedDoc.id && storedDoc.pdfHasText === true);
    const withDoc = await core.createManualPublication(reg.researcher.id, reg.researcher.displayName, {
      title: 'Manual Upload With Attached Document',
      outputType: 'journal_article',
      primaryFileId: storedDoc.id,
      coAuthors: [{ name: reg2.researcher.displayName, researcherId: reg2.researcher.id }],
    });
    check('manual publication with an attached file + linked co-author is created', withDoc.status === 'created');
    check(
      'the attached document links to the created publication',
      (await prisma.publication.findUnique({ where: { id: withDoc.publicationId }, select: { primaryFileId: true } }))
        ?.primaryFileId === storedDoc.id,
    );
    // Clean up so the co-author's later assertions are unaffected.
    await core.removePublicationForResearcher(reg2.researcher.id, withDoc.publicationId);

    const followers = await core.listFollowers(reg2.researcher.id);
    check('follower list includes the follower', followers.some((f) => f.id === reg.researcher.id));
    const following = await core.listFollowing(reg.researcher.id);
    check('following list includes the followed', following.some((f) => f.id === reg2.researcher.id));
    const fset = await core.filterFollowed(reg.researcher.id, [reg2.researcher.id]);
    check('filterFollowed marks who the viewer follows', fset.has(reg2.researcher.id));

    console.log('\nPlans & entitlements (§premium)');
    const status0 = await core.getPlanStatus(reg.researcher.id, false);
    check('new researcher is on the free plan with an AI allowance', status0.entitlements.plan === 'free' && status0.aiRemaining === status0.entitlements.aiMonthlyLimit);
    check('free plan has web browsing off', status0.entitlements.webBrowsing === false);
    await core.incrementAssistantUsage(reg.researcher.id);
    const status1 = await core.getPlanStatus(reg.researcher.id, false);
    check('AI usage is metered against the allowance', status1.aiUsed === 1 && status1.aiRemaining === status0.aiRemaining - 1);
    check('admin is treated as premium', (await core.getPlanStatus(reg.researcher.id, true)).entitlements.webBrowsing === true);
    await core.setResearcherPlan(reg.researcher.id, 'premium');
    const status2 = await core.getPlanStatus(reg.researcher.id, false);
    check('upgrading to premium unlocks web browsing + higher limit', status2.entitlements.plan === 'premium' && status2.entitlements.webBrowsing === true);
    await core.setResearcherPlan(reg.researcher.id, 'premium', new Date(Date.now() - 1000));
    check('an expired premium reverts to free', (await core.getPlanStatus(reg.researcher.id, false)).entitlements.plan === 'free');

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

    console.log('\nBackground AI summary precompute (worker-cached, §29/§48)');
    const pre = await core.precomputeProfileSummary(reg.researcher.id);
    check('profile summary precomputed for a researcher with content', pre.updated, `model=${pre.model}`);
    const cachedSummary = await prisma.researcher.findUnique({
      where: { id: reg.researcher.id },
      select: { aiSummary: true, aiSummaryAt: true, aiSummaryModel: true },
    });
    check(
      'AI summary cached with model + timestamp',
      !!cachedSummary?.aiSummary && !!cachedSummary?.aiSummaryAt && !!cachedSummary?.aiSummaryModel,
    );
    const batch = await core.precomputeProfileSummaries({ limit: 10, staleAfterDays: 0 });
    check('batch precompute reports processed/updated counts', batch.processed >= 1, JSON.stringify(batch));

    console.log('\nAI Assistant (grounded writing help, never fabricates)');
    const kwres = await core.runAssistantTask(reg.researcher.id, {
      task: 'keywords',
      material: 'Psychometric measurement invariance in cross-cultural testing of anxiety scales.',
    });
    check(
      'assistant returns keywords drawn from the author text',
      /psychometric|measurement|invariance|anxiety/i.test(kwres.text),
      kwres.text.slice(0, 60),
    );
    check('assistant output carries a no-fabrication disclaimer + provider label', !!kwres.disclaimer && !!kwres.model);
    const absres = await core.runAssistantTask(reg.researcher.id, {
      task: 'abstract',
      material: 'We piloted a numeracy intervention across ten schools and measured outcomes at six months.',
    });
    check(
      'abstract scaffold inserts a placeholder, never invents a result (on-platform)',
      !absres.external ? /\[RESULT NEEDED\]/.test(absres.text) : absres.text.length > 0,
    );
    let tooShort = false;
    await core.runAssistantTask(reg.researcher.id, { task: 'improve', material: 'too short' }).catch(() => {
      tooShort = true;
    });
    check('assistant rejects material that is too thin (BAD_REQUEST)', tooShort);

    // New tasks: outline scaffold + reviewer response (on-platform, no fabrication).
    const outline = await core.runAssistantTask(reg.researcher.id, {
      task: 'outline',
      material: 'We evaluated a community health worker programme across five rural districts.',
    });
    check(
      'outline produces an IMRaD structure without inventing findings',
      !outline.external ? /Methods|Introduction/i.test(outline.text) : outline.text.length > 0,
    );
    // refine requires a directive; missing one is rejected.
    let refineNeedsDirective = false;
    await core
      .runAssistantTask(reg.researcher.id, { task: 'refine', material: 'A passage to revise here.' })
      .catch(() => {
        refineNeedsDirective = true;
      });
    check('refine requires a revision directive (BAD_REQUEST)', refineNeedsDirective);
    const refined = await core.runAssistantTask(reg.researcher.id, {
      task: 'refine',
      material: 'The intervention reduced anxiety scores in the sample of participants.',
      directive: 'make it shorter',
    });
    check('refine runs with a directive and returns text', refined.text.length > 0 && !!refined.disclaimer);

    // Conversational chat: multi-turn, plan-metered, never fabricates.
    const chat = await core.runAssistantChat(reg.researcher.id, {
      messages: [
        { role: 'user', content: 'What research questions could I explore about anxiety scales?' },
        { role: 'assistant', content: 'A few directions worth considering…' },
        { role: 'user', content: 'Refine the first one to be more specific.' },
      ],
    });
    check('assistant chat returns text with a disclaimer + provider label', chat.text.length > 0 && !!chat.disclaimer && !!chat.model);
    let chatNeedsMessage = false;
    await core.runAssistantChat(reg.researcher.id, { messages: [] }).catch(() => {
      chatNeedsMessage = true;
    });
    check('assistant chat rejects an empty conversation (BAD_REQUEST)', chatNeedsMessage);
    let chatLastMustBeUser = false;
    await core
      .runAssistantChat(reg.researcher.id, { messages: [{ role: 'assistant', content: 'Hello there.' }] })
      .catch(() => {
        chatLastMustBeUser = true;
      });
    check('assistant chat requires the last turn to be from the user (BAD_REQUEST)', chatLastMustBeUser);

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

    console.log('\nOpportunities (provenance + explainable matching)');
    const funderActor = {
      userId: reg.user.id,
      roles: [{ role: 'funder' as const, scopeType: 'global' as const, scopeId: null }],
    };
    let postDenied = false;
    await core
      .createOpportunity(plainActor, { title: 'Should be denied', disciplines: ['psychometrics'] })
      .catch(() => {
        postDenied = true;
      });
    check('non-poster cannot create an opportunity (FORBIDDEN)', postDenied);

    const opp = await core.createOpportunity(funderActor, {
      title: 'Psychometrics Methods Fellowship',
      type: 'fellowship',
      organization: 'Smoke Foundation',
      country: 'GB',
      disciplines: ['psychometrics', 'measurement'],
      sourceUrl: 'https://example.org/fellowship',
    });
    check('funder creates opportunity + RTO id', /^RTO-\d{8}$/.test(opp.publicId), opp.publicId);
    check('opportunity carries provenance (source)', opp.source === 'manual', `source=${opp.source}`);

    const openList = await core.listOpportunities({ openOnly: true });
    check('open opportunity appears in the public list', openList.items.some((o) => o.id === opp.id), `total=${openList.total}`);

    const oppRecs = await core.recommendOpportunities(reg.researcher.id, 10);
    check('recommends an opportunity matching a stated interest', oppRecs.some((o) => o.id === opp.id), oppRecs[0]?.title);
    check('every opportunity match is explained (Spec §29)', oppRecs.length > 0 && oppRecs.every((o) => o.reasons.length > 0), oppRecs[0]?.reasons.join('; '));

    await core.saveOpportunity(reg.researcher.id, opp.id);
    const savedList = await core.listSavedOpportunities(reg.researcher.id);
    check('save bookmarks the opportunity', savedList.some((o) => o.id === opp.id));
    await core.unsaveOpportunity(reg.researcher.id, opp.id);
    const afterUnsave = await core.listSavedOpportunities(reg.researcher.id);
    check('unsave removes the bookmark', !afterUnsave.some((o) => o.id === opp.id));

    console.log('\nResearch graph (grounded projection + explainable paths)');
    // Link the two researchers via a co-authored, researcher-attributed publication.
    await prisma.publication.create({
      data: {
        publicId: 'RTP-90000001',
        slug: 'graph-coauthored-smoke',
        title: 'Graph Co-authored Work',
        visibility: 'public',
        authors: {
          create: [
            { authorOrder: 0, rawName: 'Ada Lovelace', researcherId: reg.researcher.id },
            { authorOrder: 1, rawName: 'Alan Turing', researcherId: reg2.researcher.id },
          ],
        },
      },
    });

    const ego = await core.buildResearcherEgoGraph(reg.researcher.id);
    const coEdge = ego.edges.find((e) => e.type === 'co_authored' && e.target === reg2.researcher.id);
    check('ego graph derives a co-author edge from real records', !!coEdge);
    check('every graph edge is explained (Spec §29)', ego.edges.length > 0 && ego.edges.every((e) => e.label.length > 0), coEdge?.label);
    check('co-author appears as a node in the ego graph', ego.nodes.some((n) => n.id === reg2.researcher.id && n.type === 'researcher'));

    const netSummary = await core.getNetworkSummary(reg.researcher.id);
    check('network summary counts the collaborator', netSummary.collaborators >= 1, `collaborators=${netSummary.collaborators}`);

    const path = await core.getConnectionPath(reg.researcher.id, reg2.researcher.id);
    check('connection path links the two researchers', path.connected && path.hops >= 1, `hops=${path.hops}`);
    check('connection path explains each hop (Spec §29)', path.steps.length > 0 && path.steps.every((s) => s.reason.length > 0), path.steps[0]?.reason);

    console.log('\nResearcher Discovery (provenance, provisional, identity — not RVM)');
    const provider = new core.FixtureDiscoveryProvider();
    const candidates = await provider.discover({ institution: 'University X' });
    check('discovery provider yields candidates with provenance', candidates.length >= 1 && !!candidates[0]!.provenance.source, `n=${candidates.length}`);
    const jane = candidates[0]!;

    const prov1 = await core.createProvisionalResearcher(jane);
    check('provisional profile created + RTX id', prov1.status === 'created' && /^RTX-\d{8}$/.test(prov1.researchtricsId), prov1.researchtricsId);
    const discovered = await core.getDiscoveredProfileBySlug(prov1.slug);
    check('discovered profile is UNCLAIMED, not verified (§68)', discovered?.profileStatus === 'unclaimed' && discovered?.userId == null);
    check('per-field provenance recorded (§36)', (discovered?.discoverySources.length ?? 0) >= 1, `sources=${discovered?.discoverySources.length}`);

    const idReport = core.buildIdentityReport({
      orcidExact: true,
      institutionMatch: true,
      affiliationMatch: true,
      topicSimilarity: 1,
      coauthorOverlap: 6,
    });
    check('identity confidence is 0..100 and distinct from RVM (§26)', idReport.confidence >= 0 && idReport.confidence <= 100 && idReport.tier === 'very_high', `conf=${idReport.confidence} tier=${idReport.tier}`);
    check('identity match is explained (§25)', idReport.reasons.length > 0, idReport.reasons.join('; '));

    const prov2 = await core.createProvisionalResearcher(jane);
    check('re-discovery is idempotent on ORCID (no duplicate)', prov2.status === 'exists' && prov2.researcherId === prov1.researcherId);

    const ravi = (await provider.discover({ topic: 'open science' }))[0]!;
    await core.recordSuppression({ name: ravi.fullName, country: ravi.country, reason: 'opt-out' });
    const provSuppressed = await core.createProvisionalResearcher(ravi);
    check('suppression blocks profile recreation (§35)', provSuppressed.status === 'suppressed');

    const tok = core.generateClaimToken();
    check('claim token verifies and rejects a wrong token (§32)', core.verifyClaimToken(tok.token, tok.tokenHash) && !core.verifyClaimToken('wrong', tok.tokenHash));

    // Discovery run (batch) via the offline fixture provider — records a run + counts (§22/§40).
    const run = await core.runDiscovery({
      provider: core.createDiscoveryProvider('fixture'),
      query: {},
    });
    check('discovery run records counts (§40)', run.discovered >= 2 && run.created + run.matched >= 1, `discovered=${run.discovered} created=${run.created} matched=${run.matched}`);
    check('re-run is idempotent (existing profiles matched, not duplicated)', (await core.runDiscovery({ provider: core.createDiscoveryProvider('fixture'), query: {} })).created === 0);
    const runs = await core.listDiscoveryRuns(5);
    check('discovery runs are listed for the admin dashboard', runs.length >= 1 && runs[0]!.status === 'completed');

    console.log('\nProfile claiming & verification (§11–§16, §35, §68)');
    const claimant = await core.registerClaimant({ email: 'claimant@example.org', password: 'correcthorse7!' });
    let ownGuard = false;
    await core
      .claimProfile(prov1.researcherId, reg.user.id, { method: 'orcid', verifiedOrcid: 'x' })
      .catch(() => {
        ownGuard = true;
      });
    check('a user with an existing profile cannot claim another (merge is separate §24)', ownGuard);

    await core.startClaim(prov1.researcherId, claimant.userId);
    let mismatch = false;
    await core
      .claimProfile(prov1.researcherId, claimant.userId, { method: 'orcid', verifiedOrcid: '0000-0000-0000-0000' })
      .catch(() => {
        mismatch = true;
      });
    check('a mismatched/typed ORCID never claims a profile (§12)', mismatch);

    const claimed = await core.claimProfile(prov1.researcherId, claimant.userId, {
      method: 'orcid',
      verifiedOrcid: '0000-0002-1111-2222',
    });
    check('ORCID-verified claim marks the profile VERIFIED (§68)', claimed.profileStatus === 'verified' && claimed.verificationLevel === 3);
    const claimedR = await prisma.researcher.findUnique({ where: { id: prov1.researcherId }, select: { userId: true } });
    check('claimed profile is now owned by the claimant account', claimedR?.userId === claimant.userId);

    await core.setPublicationClaim(prov1.researcherId, created.publicationId, 'claimed', undefined);
    const pubClaims = await core.listResearcherPublicationClaims(prov1.researcherId);
    check('publication claim recorded (§14)', pubClaims.some((c) => c.publicationId === created.publicationId && c.status === 'claimed'));
    await core.setPublicationClaim(prov1.researcherId, created.publicationId, 'disputed', 'not mine');
    const pubStillExists = await prisma.publication.findUnique({ where: { id: created.publicationId }, select: { id: true } });
    check('dispute removes the association but keeps the global record (§15)', !!pubStillExists);

    const fresh = await core.createProvisionalResearcher({
      fullName: 'Temp Unclaimed',
      nameVariants: ['Temp Unclaimed'],
      topics: ['testing'],
      works: [],
      coauthors: [],
      provenance: { source: 'fixture', retrievedAt: new Date().toISOString() },
    });
    await core.requestProfileRemoval(fresh.researcherId, 'opt out', undefined);
    const removed = await prisma.researcher.findUnique({ where: { id: fresh.researcherId }, select: { profileStatus: true, deletedAt: true } });
    check('profile removal suppresses the unclaimed profile (§35)', removed?.profileStatus === 'suppressed' && removed?.deletedAt != null);

    console.log('\nInvitations, referrals, review/merge, metrics, discovery API (§17–§57)');
    // A fresh unclaimed profile to invite/merge.
    const inviteTarget = await core.createProvisionalResearcher({
      fullName: 'Grace Hopper',
      nameVariants: ['Grace Hopper', 'G. Hopper'],
      openalexAuthorId: 'A5000000100',
      topics: ['computing'],
      works: [],
      coauthors: [],
      provenance: { source: 'fixture', retrievedAt: new Date().toISOString() },
    });
    const invite = await core.createClaimInvitation({ researcherId: inviteTarget.researcherId, channel: 'public' });
    check('claim invitation issues a raw token (§18)', invite.token.length > 20);
    const resolved = await core.resolveInvitation(invite.token);
    check('invitation resolves to the target profile', resolved?.researcher.id === inviteTarget.researcherId && !resolved?.expired && !resolved?.consumed);
    check('a bad invitation token resolves to nothing', (await core.resolveInvitation('not-a-token')) === null);
    await core.consumeInvitation(invite.token);
    const afterConsume = await core.resolveInvitation(invite.token);
    check('invitation is single-use once consumed (§32)', afterConsume?.consumed === true);

    // Merge: build a duplicate of inviteTarget and merge it in.
    const dupProfile = await core.createProvisionalResearcher({
      fullName: 'Grace Hopper',
      nameVariants: ['Grace Hopper'],
      orcid: '0000-0003-9999-0001',
      topics: ['compilers'],
      works: [],
      coauthors: [],
      provenance: { source: 'fixture', retrievedAt: new Date().toISOString() },
    });
    const queue = await core.listReviewQueue();
    check('review queue surfaces same-name duplicates for human review (§57)', queue.some((g) => g.researchers.length >= 2));
    await core.mergeResearchers(inviteTarget.researcherId, dupProfile.researcherId, undefined);
    const mergedDup = await prisma.researcher.findUnique({ where: { id: dupProfile.researcherId }, select: { profileStatus: true, deletedAt: true } });
    check('merge marks the duplicate merged, never hard-deleted (§24)', mergedDup?.profileStatus === 'merged' && mergedDup?.deletedAt != null);
    const canonOrcid = await prisma.researcherIdentifier.findFirst({ where: { researcherId: inviteTarget.researcherId, scheme: 'orcid', value: '0000-0003-9999-0001' } });
    check('merge moves the duplicate’s identifiers to the canonical profile', !!canonOrcid);

    const metrics = await core.discoveryGrowthMetrics();
    check('growth metrics count discovered/claimed/verified (§40)', metrics.totalDiscovered >= 0 && metrics.verified >= 1 && metrics.bySource.length >= 1, `verified=${metrics.verified} sources=${metrics.bySource.length}`);

    const apiQuery = await core.queryDiscoveredResearchers({ take: 10 });
    check('discovery query is paginated + returns provenance-bearing profiles (§51)', apiQuery.total >= 0 && Array.isArray(apiQuery.items));

    console.log('\nFederation: DataCite research-output discovery (§24–§26)');
    const now2 = new Date().toISOString();
    const stubProvider = {
      name: 'datacite',
      external: true,
      capabilities: ['search', 'healthCheck'] as const,
      healthCheck: async () => ({ provider: 'datacite', status: 'healthy' as const, checkedAt: now2 }),
      searchWorks: async () => [
        { source: 'datacite', resourceType: 'dataset' as const, title: 'Cross-cultural sample 2020', externalIds: { doi: '10.5555/data.1', datacite: '10.5555/data.1' }, authors: [{ rawName: 'Ada Lovelace' }], provenance: { source: 'datacite', sourceId: '10.5555/data.1', sourceUrl: 'https://doi.org/10.5555/data.1', retrievedAt: now2 } },
        { source: 'datacite', resourceType: 'software' as const, title: 'invariance-r', externalIds: { doi: '10.5555/soft.1', datacite: '10.5555/soft.1' }, authors: [{ rawName: 'Ada Lovelace' }], provenance: { source: 'datacite', sourceId: '10.5555/soft.1', retrievedAt: now2 } },
      ],
    };
    const outputs = await core.discoverResearchOutputs(prov1.researcherId, { provider: stubProvider });
    check('discovers dataset/software research outputs (§25/§26)', outputs.outputs.length === 2 && outputs.outputs.some((o) => o.resourceType === 'dataset') && outputs.outputs.some((o) => o.resourceType === 'software'), `n=${outputs.outputs.length}`);
    check('discovered outputs carry DataCite provenance (§38)', outputs.outputs.every((o) => o.provenance.source === 'datacite'));
    check('research-output discovery uses the researcher’s ORCID', outputs.orcid === '0000-0002-1111-2222', `orcid=${outputs.orcid}`);

    const pubmedStub = {
      name: 'pubmed',
      external: true,
      capabilities: ['search', 'healthCheck'] as const,
      healthCheck: async () => ({ provider: 'pubmed', status: 'healthy' as const, checkedAt: now2 }),
      searchWorks: async () => [
        { source: 'pubmed', resourceType: 'publication' as const, title: 'Resilience and coping in clinical populations', externalIds: { pmid: '12345678', pmcid: 'PMC7654321', doi: '10.1000/health.1' }, authors: [{ rawName: 'Ada Lovelace' }], publicationTypes: ['Journal Article'], provenance: { source: 'pubmed', sourceId: '12345678', sourceUrl: 'https://pubmed.ncbi.nlm.nih.gov/12345678/', retrievedAt: now2 } },
      ],
    };
    const footprint = await core.getBiomedicalFootprint(prov1.researcherId, { provider: pubmedStub });
    check('biomedical footprint counts PubMed records (§27)', footprint.count === 1 && footprint.indicator === 'present', `count=${footprint.count}`);
    check('PubMed records carry PMID + provenance (§6/§38)', footprint.works.every((w) => !!w.externalIds.pmid && w.provenance.source === 'pubmed'));

    console.log('\nFederation: ROR institution normalization (§8)');
    const rorRecord = { source: 'ror', rorId: '05a28r0s0', name: 'Smoke University', aliases: ['Smoke Univ.'], acronyms: ['SU'], country: 'United Kingdom', countryCode: 'GB', website: 'https://smoke.example', types: ['Education'], provenance: { source: 'ror', sourceId: '05a28r0s0', sourceUrl: 'https://ror.org/05a28r0s0', retrievedAt: now2 } };
    const rorStub = {
      name: 'ror',
      external: true,
      capabilities: ['getInstitution', 'search', 'healthCheck'] as const,
      healthCheck: async () => ({ provider: 'ror', status: 'healthy' as const, checkedAt: now2 }),
      searchInstitutions: async () => [rorRecord],
      getInstitution: async () => rorRecord,
    };
    const rorCandidates = await core.resolveInstitution('SU', { provider: rorStub });
    check('ROR resolves an institution name to a candidate with a ROR id (§8)', rorCandidates.length === 1 && rorCandidates[0]!.rorId === '05a28r0s0');
    await core.linkInstitutionToRor(institution.id, { record: rorRecord, actorId: reg.user.id });
    const linked = await prisma.institution.findUnique({ where: { id: institution.id }, select: { rorId: true, aliases: true, website: true } });
    check('linking sets ROR id + aliases + website on the institution (§8)', linked?.rorId === '05a28r0s0' && (linked?.aliases ?? []).includes('SU') && linked?.website === 'https://smoke.example', `ror=${linked?.rorId}`);
    const byRor = await core.findInstitutionByRor('05a28r0s0');
    check('institution is now findable by its ROR id (dedup)', byRor?.id === institution.id);

    console.log('\nFederation: unified work record + conflict resolution + citations (§16–§19, §30)');
    const wnow = new Date().toISOString();
    const mkWork = (source: string, over: Record<string, unknown>) => ({
      source,
      resourceType: 'publication',
      title: 'Measurement invariance',
      externalIds: {},
      authors: [],
      provenance: { source, retrievedAt: wnow },
      ...over,
    });
    const uCandidates = [
      mkWork('crossref', { publishedYear: 2020, publisher: 'Elsevier', externalIds: { doi: '10.9/uni.1', crossref: '10.9/uni.1' }, authors: [{ rawName: 'Ada Lovelace' }] }),
      mkWork('openalex', { publishedYear: 2021, externalIds: { doi: '10.9/uni.1', openalex: 'W900' }, authors: [{ rawName: 'Ada Lovelace' }] }),
    ] as never;
    const uni = await core.upsertUnifiedWork(uCandidates);
    check('unified work record created with RTW id (§16)', uni.status === 'created' && /^RTW-\d{8}$/.test(uni.publicId), uni.publicId);
    check('field conflict detected + retained, never overwritten (§19)', uni.conflicts.includes('publishedYear'));
    const uniRec = await core.getUnifiedWorkByDoi('10.9/uni.1');
    check('all source values kept in field provenance (§19/§38)', (uniRec?.fieldProvenance.filter((p) => p.field === 'publishedYear').length ?? 0) === 2 && uniRec?.openalexId === 'W900');
    const uni2 = await core.upsertUnifiedWork(uCandidates);
    check('unification is idempotent on DOI (updated, no duplicate)', uni2.status === 'updated' && uni2.id === uni.id);

    await core.recordCitationEdges('10.9/citing.1', [
      { citedDoi: '10.9/uni.1', source: 'crossref' },
      { citedDoi: '10.9/uni.1', source: 'openalex' },
    ]);
    const counts = await core.citationCountsBySource('10.9/uni.1');
    check('citation counts stay source-distinguishable, never merged (§30)', counts.crossref === 1 && counts.openalex === 1, JSON.stringify(counts));

    console.log('\nFederation ops: health, data quality, visibility audit, unified read (§34/§40/§42/§29)');
    const healthStub = [
      { name: 'crossref', external: true, capabilities: ['healthCheck'] as const, healthCheck: async () => ({ provider: 'crossref', status: 'healthy' as const, latencyMs: 42, checkedAt: wnow }) },
      { name: 'pubmed', external: true, capabilities: ['healthCheck'] as const, healthCheck: async () => ({ provider: 'pubmed', status: 'down' as const, checkedAt: wnow, error: 'unreachable' }) },
    ] as never;
    const healthReport = await core.federationHealthReport(healthStub);
    check('source-health report probes each provider (§34)', healthReport.length === 2 && healthReport.some((h: { status: string }) => h.status === 'healthy') && healthReport.some((h: { status: string }) => h.status === 'down'));

    const dq = await core.dataQualityReport();
    check('data-quality report yields a 0..100 score + metrics (§42)', dq.score >= 0 && dq.score <= 100 && dq.metrics.length >= 5, `score=${dq.score} metrics=${dq.metrics.length}`);

    const audit = await core.researchVisibilityAudit(reg.researcher.id);
    check('visibility audit returns grounded coverage + recommendations (§40)', typeof audit.coverage.publications === 'number' && Array.isArray(audit.gaps) && Array.isArray(audit.recommendations));

    const uWork = await core.getUnifiedWorkByPublicId(uni.publicId);
    check('unified work is readable by public id with field provenance (§29)', uWork?.publicId === uni.publicId && (uWork?.fieldProvenance.length ?? 0) > 0);

    console.log('\nPhase 15 hardening: rate limit, circuit breaker, anti-fraud (§32/§33/§35)');
    // Rate limiter: permits up to the limit, then blocks (deterministic clock).
    let clock = 0;
    const limiter = new core.RateLimiter({ now: () => clock });
    const rule = { limit: 3, windowMs: 60_000 };
    const decisions = [];
    for (let i = 0; i < 4; i++) decisions.push(await limiter.hit('smoke', rule));
    check(
      'rate limiter allows up to the limit then blocks (§35)',
      decisions.slice(0, 3).every((d) => d.allowed) && decisions[3]!.allowed === false && decisions[3]!.retryAfterSeconds > 0,
      `allowed=${decisions.map((d) => d.allowed).join(',')}`,
    );

    // Circuit breaker: trips OPEN after failures, then half-opens after cooldown.
    let cbClock = 0;
    const breaker = new core.CircuitBreaker('smoke', { failureThreshold: 2, cooldownMs: 5_000, now: () => cbClock });
    const boom = async () => { throw new Error('down'); };
    for (let i = 0; i < 2; i++) { try { await breaker.execute(boom); } catch { /* expected */ } }
    const openedState = breaker.currentState();
    let failedFast = false;
    try { await breaker.execute(async () => 'x'); } catch (e) { failedFast = e instanceof core.CircuitOpenError; }
    cbClock = 5_001;
    const halfOpen = breaker.currentState();
    check(
      'circuit breaker trips open, fails fast, then half-opens after cooldown',
      openedState === 'open' && failedFast && halfOpen === 'half_open',
      `open=${openedState} failFast=${failedFast} recovered=${halfOpen}`,
    );

    // Anti-fraud: disposable-email claim is high risk and routed to review (§33).
    const disposableRisk = await core.assessClaimRisk({
      userId: reg.user.id,
      researcherId: reg.researcher.id,
      email: 'ghost@mailinator.com',
    });
    check(
      'disposable-email claim is high risk and requires review (§33)',
      disposableRisk.level === 'high' && disposableRisk.requiresReview,
      `level=${disposableRisk.level} score=${disposableRisk.score}`,
    );
    const cleanRisk = await core.assessClaimRisk({
      userId: reg.user.id,
      researcherId: reg.researcher.id,
      email: 'prof@cam.ac.uk',
    });
    check('institutional-email claim is low risk (§33)', cleanRisk.level === 'low' && !cleanRisk.requiresReview, `level=${cleanRisk.level}`);

    // Security events append to the audit log without breaking the flow (§35).
    const auditBefore = await prisma.auditLog.count();
    await core.recordSecurityEvent({ action: 'smoke.security_event', entityType: 'researcher', entityId: reg.researcher.id, detail: { ok: true } });
    check('security event appended to audit log (§35)', (await prisma.auditLog.count()) === auditBefore + 1);

    console.log('\nFile storage: upload → serve pipeline (local-fs, §46/§36)');
    const stored = await core.storeFile({
      data: new TextEncoder().encode('{"ok":true}'),
      filename: 'meta.json',
      mimeType: 'application/json',
      accessLevel: 'public',
      uploaderId: reg.user.id,
    });
    check(
      'storeFile persists to object storage + records metadata (§46)',
      /^[0-9a-f]{2}\//.test(stored.storageKey) && stored.url.includes('/api/v1/files/'),
      stored.storageKey,
    );
    const readBack = await core.getStorageProvider().read?.(stored.storageKey);
    check(
      'stored bytes read back from the provider',
      !!readBack && new TextDecoder().decode(readBack) === '{"ok":true}',
    );
    const meta = await core.getFileForServe(stored.storageKey);
    check(
      'serve metadata + public access resolve (§36)',
      meta?.mimeType === 'application/json' && core.canAccessFile(meta.accessLevel, meta, null) === true,
    );
    check(
      'private file is uploader-only (§36)',
      core.canAccessFile('private', { uploaderId: reg.user.id }, { id: reg.user.id }) === true &&
        core.canAccessFile('private', { uploaderId: reg.user.id }, { id: 'someone-else' }) === false,
    );
    let emptyRejected = false;
    try {
      await core.storeFile({ data: new Uint8Array(0), filename: 'empty.json', mimeType: 'application/json' });
    } catch {
      emptyRejected = true;
    }
    check('empty upload rejected by size guard (§35)', emptyRejected);

    console.log('\nOpportunity lifecycle: auto-expire past-deadline listings (§85)');
    const adminActorOpp = { userId: reg.user.id, roles: [{ role: 'platform_admin' as const, scopeType: 'global' as const, scopeId: null }] };
    const pastOpp = await core.createOpportunity(adminActorOpp, {
      title: 'Expired grant call',
      type: 'grant',
      deadline: new Date(Date.now() - 24 * 3600_000),
    });
    const futureOpp = await core.createOpportunity(adminActorOpp, {
      title: 'Open grant call',
      type: 'grant',
      deadline: new Date(Date.now() + 24 * 3600_000),
    });
    const swept = await core.expireOpportunities();
    const pastAfter = await core.getOpportunityBySlug(pastOpp.slug);
    const futureAfter = await core.getOpportunityBySlug(futureOpp.slug);
    check(
      'expiry closes past-deadline listings, leaves live ones open (§85)',
      swept.closed >= 1 && pastAfter?.status === 'closed' && futureAfter?.status === 'open',
      `closed=${swept.closed} past=${pastAfter?.status} future=${futureAfter?.status}`,
    );
    check(
      'expiry is a soft transition — never deletes (provenance kept)',
      !!pastAfter && pastAfter.publicId === pastOpp.publicId,
    );

    console.log('\nOpportunity ingestion: provider abstraction + idempotent upsert (§20)');
    const oppProvider = core.createOpportunityProvider('fixture');
    const ingest1 = await core.ingestOpportunities(oppProvider);
    check(
      'ingest creates provenance-stamped listings from a source provider (§20)',
      ingest1.created >= 1 && ingest1.source === 'import:fixture',
      `created=${ingest1.created} source=${ingest1.source}`,
    );
    const ingest2 = await core.ingestOpportunities(oppProvider);
    check(
      'ingest is idempotent — re-run updates in place, no duplicates',
      ingest2.created === 0 && ingest2.updated === ingest1.created,
      `created=${ingest2.created} updated=${ingest2.updated}`,
    );
    const grantsGovMapped = core.mapGrantsGov({ id: 99, title: 'NSF Grant', closeDate: '06/30/2027', agencyName: 'NSF' });
    check(
      'Grants.gov mapper normalizes a hit with provenance (offline)',
      grantsGovMapped?.type === 'grant' && grantsGovMapped?.country === 'US' && !!grantsGovMapped?.sourceUrl,
    );
    // Type classification surfaces non-grant categories from funding titles.
    check(
      'opportunity type is classified from the title (jobs/fellowships surfaced §20)',
      core.classifyOpportunityType('Postdoctoral Fellowship in Physics') === 'fellowship' &&
        core.mapGrantsGov({ id: 7, title: 'Faculty Position — Lecturer', closeDate: '01/01/2027' })?.type === 'position',
    );
    // WikiCFP conference source (offline via injected fetch).
    const wikicfpXml = '<rss><channel><item><title>ICML 2027 : Conference on Machine Learning</title><link>http://wikicfp.com/e/1</link><description>desc [Vienna, Austria] [Jul 1, 2027 - Jul 5, 2027]</description><guid>cfp-9</guid></item></channel></rss>';
    const wikicfp = core.createOpportunityProvider('wikicfp', {
      wikicfp: { fetchImpl: (async () => ({ ok: true, text: async () => wikicfpXml })) as unknown as typeof fetch },
    });
    const cfpIngest = await core.ingestOpportunities(wikicfp);
    check(
      'WikiCFP ingests conference calls-for-papers (§20)',
      cfpIngest.created >= 1 && cfpIngest.source === 'import:wikicfp',
      `created=${cfpIngest.created}`,
    );

    console.log('\nDOI import links the importer as author (§15 fix)');
    // A publication that exists but is not linked to reg's researcher…
    const orphan = await core.createPublicationFromNormalized({
      title: 'An Imported Paper With No Author Link',
      doi: '10.9/imported.1',
      authors: [{ rawName: 'Some Other Author' }],
    });
    let orphanLinked = await prisma.publicationAuthor.count({
      where: { publicationId: orphan.publicationId, researcherId: reg.researcher.id },
    });
    check('imported paper starts unlinked to the importer', orphanLinked === 0);
    await core.linkResearcherToPublication(orphan.publicationId, {
      id: reg.researcher.id,
      displayName: reg.researcher.displayName,
    });
    orphanLinked = await prisma.publicationAuthor.count({
      where: { publicationId: orphan.publicationId, researcherId: reg.researcher.id },
    });
    check('linkResearcherToPublication associates the importer (shows in My publications)', orphanLinked === 1);
    // Idempotent — no double link.
    await core.linkResearcherToPublication(orphan.publicationId, { id: reg.researcher.id, displayName: reg.researcher.displayName });
    const afterTwice = await prisma.publicationAuthor.count({
      where: { publicationId: orphan.publicationId, researcherId: reg.researcher.id },
    });
    check('linking is idempotent (no duplicate authorship)', afterTwice === 1);

    console.log('\nProfile robustness: photo + manual publication (§9/§11)');
    await core.updateProfile(reg.researcher.id, { photoUrl: 'https://cdn.example.org/x/photo.png' }, reg.user.id);
    const withPhoto = await core.getResearcherBySlug(reg.researcher.slug);
    check('profile photo can be set + read back', withPhoto?.photoUrl === 'https://cdn.example.org/x/photo.png');

    const manualPub = await core.createManualPublication(reg.researcher.id, reg.researcher.displayName, {
      title: 'A Monograph Without a DOI',
      outputType: 'book',
      publishedYear: 2026,
      publisher: 'Example Press',
    });
    check('manual publication created + RTP id', manualPub.status === 'created' && !!manualPub.slug);
    const myPubs = await prisma.publicationAuthor.count({ where: { researcherId: reg.researcher.id } });
    check('manual publication is linked to its author (shows on profile)', myPubs >= 1, `authorships=${myPubs}`);
    const loadedManual = await core.getPublicationBySlug(manualPub.slug);
    check('manual publication loads with its type (book)', loadedManual?.outputType === 'book');

    // Co-authors: uploader is not shown as the sole author.
    const withCoAuthors = await core.createManualPublication(reg.researcher.id, reg.researcher.displayName, {
      title: 'A Co-Authored Report',
      outputType: 'research_report',
      coAuthors: [{ name: 'Jane Q. Coauthor' }, { name: 'Sam Second' }],
    });
    const coAuthored = await core.getPublicationBySlug(withCoAuthors.slug);
    check(
      'manual upload records co-authors (not sole author)',
      !!coAuthored && coAuthored.authors.length === 3 && coAuthored.authors.some((a) => a.rawName === 'Jane Q. Coauthor'),
      `authors=${coAuthored?.authors.length}`,
    );

    // Remove a sole-authored publication (error/duplicate) → soft-deleted.
    const rm = await core.removePublicationForResearcher(reg.researcher.id, withCoAuthors.publicationId);
    check('removing a sole-authored publication deletes it', rm.deleted && !rm.unlinked);
    check('deleted publication no longer resolves', !(await core.getPublicationBySlug(withCoAuthors.slug)));
    // Non-author cannot remove someone else's publication.
    let removeDenied = false;
    await core.removePublicationForResearcher(reg2.researcher.id, manualPub.publicationId).catch(() => {
      removeDenied = true;
    });
    check('a non-author cannot remove a publication (FORBIDDEN)', removeDenied);
    check(
      'publication detail carries the file relation for citation_pdf_url (Model A, §11)',
      loadedManual !== null && loadedManual.primaryFile === null,
    );

    console.log('\nFederation-first: ingest a discovered researcher\'s OpenAlex works (§5/§25)');
    const fakeOaFetch = (async () => ({
      ok: true,
      json: async () => ({
        results: [
          {
            id: 'https://openalex.org/W5001',
            doi: 'https://doi.org/10.5555/discovered.1',
            title: 'Discovered Work on Malaria Vectors',
            type: 'article',
            publication_year: 2024,
            cited_by_count: 7,
            open_access: { is_oa: true, oa_url: 'https://example.org/w5001.pdf' },
            primary_location: { source: { display_name: 'PLOS ONE' } },
            authorships: [{ author: { display_name: reg.researcher.displayName } }],
          },
        ],
      }),
    })) as unknown as typeof fetch;
    const worksResult = await core.ingestResearcherWorks(
      { id: reg.researcher.id, displayName: reg.researcher.displayName, openalexAuthorId: 'A999' },
      { fetchImpl: fakeOaFetch },
    );
    check(
      'discovered researcher works are ingested as publications (§5)',
      worksResult.created === 1 && worksResult.fetched === 1,
      `created=${worksResult.created} exists=${worksResult.exists}`,
    );
    const linkedPub = await prisma.publication.findFirst({
      where: { title: 'Discovered Work on Malaria Vectors' },
      include: { authors: true, citationCounts: true },
    });
    check(
      'ingested work links back to the researcher + carries citations (§5/§30)',
      !!linkedPub &&
        linkedPub.authors.some((a) => a.researcherId === reg.researcher.id) &&
        linkedPub.citationCounts.some((c) => c.source === 'openalex' && c.count === 7),
    );

    console.log('\nAffiliation control: add by institution name (§7)');
    const aff = await core.addResearcherAffiliation({
      researcherId: reg.researcher.id,
      institutionName: 'Makerere University',
      country: 'Uganda',
      role: 'faculty',
      isPrimary: true,
    });
    check('affiliation added + institution resolved/created by name (§7)', !!aff.id && !!aff.institutionId);
    const profileWithAff = await core.getResearcherBySlug(reg.researcher.slug);
    check(
      'affiliation shows on profile with institution + primary flag',
      (profileWithAff?.affiliations.length ?? 0) >= 1 &&
        profileWithAff!.affiliations.some((a) => a.institution.name === 'Makerere University' && a.isPrimary),
    );
    await core.removeAffiliation(aff.id, reg.researcher.id);
    const afterRemove = await core.getResearcherBySlug(reg.researcher.slug);
    check(
      'affiliation can be removed',
      !afterRemove?.affiliations.some((a) => a.institution.name === 'Makerere University'),
    );

    console.log('\nEngagement notifications: read/recommend + country, throttled (§41)');
    // Link a publication to reg's researcher, then notify an engagement.
    const notifPub = await core.createManualPublication(reg.researcher.id, reg.researcher.displayName, {
      title: 'A Paper People Will Read',
      outputType: 'journal_article',
    });
    const n1 = await core.notifyEngagement({
      publicationId: notifPub.publicationId,
      type: 'publication_read',
      country: 'Germany',
    });
    check('read notification created for the author with country (§41)', n1.created === 1);
    // Throttled — an identical read within the window does not re-notify.
    const n2 = await core.notifyEngagement({ publicationId: notifPub.publicationId, type: 'publication_read', country: 'Germany' });
    check('duplicate read within window is throttled', n2.created === 0);
    // A recommend is a different type — notifies.
    const n3 = await core.notifyEngagement({ publicationId: notifPub.publicationId, type: 'publication_recommend', country: 'Kenya' });
    check('a different engagement type notifies', n3.created === 1);
    // The author is never notified of their OWN action.
    const n4 = await core.notifyEngagement({ publicationId: notifPub.publicationId, type: 'publication_download', excludeResearcherId: reg.researcher.id });
    check('author is not notified of their own action', n4.created === 0);

    // Opportunity match notifications: reg's researcher has a matching interest
    // for `opp` (psychometrics), so a match notification is created — once only.
    const m1 = await core.notifyOpportunityMatches({ perResearcher: 10 });
    check('opportunity matches notified to interested researchers (§41)', m1.created >= 1, `created=${m1.created}`);
    const m2 = await core.notifyOpportunityMatches({ perResearcher: 10 });
    check('opportunity match is idempotent (told once)', m2.created === 0, `created=${m2.created}`);
    const oppList = await core.listNotifications(reg.researcher.id);
    check(
      'opportunity match renders as an interest match with a link',
      oppList.some((n) => n.type === 'opportunity_match' && /matches your interests/.test(n.message) && n.href === `/opportunities/${opp.slug}`),
    );

    const unread = await core.countUnreadNotifications(reg.researcher.id);
    check('unread count reflects notifications', unread >= 2, `unread=${unread}`);
    const list = await core.listNotifications(reg.researcher.id);
    check('notifications describe what + where, no personal data', list.some((n) => n.message.includes('Germany') && n.message.includes('read')));
    const marked = await core.markNotificationsRead(reg.researcher.id);
    check('mark-read clears unread', marked >= 2 && (await core.countUnreadNotifications(reg.researcher.id)) === 0);

    console.log('\nEmail digests: batched engagement summary to verified users (§41)');
    // reg's user is email-verified in this smoke? mark verified to receive digests.
    await prisma.user.update({ where: { id: reg.user.id }, data: { emailVerified: true } });
    // Capture emails via a stub provider.
    const sentEmails: Array<{ to: string; subject: string; text: string }> = [];
    core.setEmailProvider({ send: async (m) => { sentEmails.push({ to: m.to, subject: m.subject, text: m.text }); } });
    const digest = await core.buildEngagementDigest(reg.researcher.id, 7);
    check(
      'digest aggregates the researcher\'s recent engagement (§41)',
      !!digest && digest.total >= 1 && digest.email === reg.user.email,
      `total=${digest?.total}`,
    );
    check(
      'digest folds in matched opportunities',
      !!digest && digest.opportunities.some((o) => o.slug === opp.slug),
      `opps=${digest?.opportunities.length}`,
    );
    const sendResult = await core.sendEngagementDigests(7, 'https://www.researchtrics.com');
    check(
      'digest email sent to the verified author (batched, country-level)',
      sendResult.sent >= 1 && sentEmails.some((e) => e.to === reg.user.email && /read|download|recommend|interaction/i.test(e.text)),
      `sent=${sendResult.sent}`,
    );
    check(
      'digest contains no reader IPs/identities (privacy)',
      sentEmails.every((e) => !/\d+\.\d+\.\d+\.\d+/.test(e.text)),
    );

    console.log('\nProfile read');
    const profile = await core.getResearcherBySlug(reg.researcher.slug);
    check('researcher profile loads by slug', profile?.researchtricsId === reg.researcher.researchtricsId);

    console.log('\nProfile publications + avatars (§8, §11)');
    const profilePubs = await core.listResearcherPublications(reg.researcher.id, { take: 100 });
    check(
      'profile lists the researcher\'s public publications, newest first',
      profilePubs.length >= 1 && profilePubs.every((p) => !!p.title && !!p.slug),
      `count=${profilePubs.length}`,
    );
    const listed = await core.listResearchers({ take: 5 });
    check(
      'researcher listing exposes photoUrl for avatars',
      listed.items.length >= 1 && 'photoUrl' in listed.items[0]!,
    );

    // Dashboard "Next steps" reflects REAL state, not a static list.
    const checklist = await core.getOnboardingChecklist(reg.researcher.id);
    check('onboarding checklist covers all five steps', checklist.length === 5);
    check(
      'checklist marks publications done once a work exists',
      checklist.find((s) => s.key === 'publications')?.done === true,
    );
    check(
      'checklist marks affiliation done for an affiliated researcher',
      checklist.find((s) => s.key === 'affiliation')?.done === true,
    );
    const newbie = await core.registerResearcher({
      email: 'newbie@example.org',
      password: 'freshstart8!',
      displayName: 'Newbie Researcher',
    });
    const freshChecklist = await core.getOnboardingChecklist(newbie.researcher.id);
    check(
      'a brand-new researcher has every onboarding step still to do',
      freshChecklist.length === 5 && freshChecklist.every((s) => !s.done),
    );

    // Verification: a new account is Level 0 (Unverified) — this is what drives
    // the "Get verified" prompt. Email verification is the Level 1 path.
    const newbieLevel = await prisma.researcher.findUnique({
      where: { id: newbie.researcher.id },
      select: { verificationLevel: true },
    });
    check('a brand-new researcher starts Unverified (Level 0)', newbieLevel?.verificationLevel === 0);
    await core.issueEmailVerification(newbie.user.id, 'newbie@example.org', 'https://researchtrics.com');
    const issuedToken = await prisma.verificationToken.findFirst({
      where: { userId: newbie.user.id, purpose: 'email' },
      orderBy: { createdAt: 'desc' },
    });
    check('issuing verification stores a single-use email token', !!issuedToken && !issuedToken.usedAt);
    // The resend rate limit is registered so the endpoint can throttle abuse.
    const rl = await core.checkRateLimit('resend-verification', `user:${newbie.user.id}`);
    check('resend-verification rate limit is wired', rl.allowed === true);

    console.log('\nImpact report (§premium)');
    const reportDeep = await core.buildImpactReport(reg.researcher.id, { deep: true });
    check(
      'report assembles headline metrics + top works',
      reportDeep.researcher.researchtricsId === reg.researcher.researchtricsId &&
        reportDeep.metrics.publications >= 1 &&
        reportDeep.topPublications.length >= 1,
      `pubs=${reportDeep.metrics.publications}`,
    );
    check(
      'deep report includes reach-by-country',
      Array.isArray(reportDeep.reachByCountry) && reportDeep.reachByCountry!.some((c) => c.country === 'Germany'),
    );
    const reportFree = await core.buildImpactReport(reg.researcher.id, { deep: false });
    check('free report withholds reach-by-country', reportFree.reachByCountry === null);

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
