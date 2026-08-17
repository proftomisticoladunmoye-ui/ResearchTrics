/**
 * Local dev database holder (no Docker): boots a persistent embedded
 * PostgreSQL, applies the migration once, seeds a little demo content, and
 * stays alive so `next start`/`next dev` can serve against it.
 * Run in the background; stop with Ctrl-C.
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
const migrationFiles = readdirSync(migrationsDir)
  .filter((d) => /^\d/.test(d))
  .sort()
  .map((d) => join(migrationsDir, d, 'migration.sql'));

const PORT = Number(process.env.DEV_PG_PORT ?? 55433);
const DB = 'researchtrics';
const USER = 'researchtrics';
const PASS = 'researchtrics';
const dataDir = join(tmpdir(), 'researchtrics-dev-pgdata');

process.env.DATABASE_URL = `postgresql://${USER}:${PASS}@localhost:${PORT}/${DB}?schema=public`;
process.env.SESSION_SECRET = process.env.SESSION_SECRET ?? 'dev-'.padEnd(40, 'x');
process.env.TOKEN_ENCRYPTION_KEY = process.env.TOKEN_ENCRYPTION_KEY ?? Buffer.alloc(32, 7).toString('base64');

async function tableExists(): Promise<boolean> {
  const c = new pg.Client({ host: 'localhost', port: PORT, user: USER, password: PASS, database: DB });
  await c.connect();
  try {
    await c.query('SELECT 1 FROM users LIMIT 1');
    return true;
  } catch {
    return false;
  } finally {
    await c.end();
  }
}

async function main() {
  const server = new EmbeddedPostgres({ databaseDir: dataDir, user: USER, password: PASS, port: PORT, persistent: true });
  try {
    await server.initialise();
  } catch {
    /* already initialised */
  }
  await server.start();
  await server.createDatabase(DB).catch(() => undefined);

  if (!(await tableExists())) {
    const sql = migrationFiles
      .map((p) => readFileSync(p, 'utf8').replace(/CREATE EXTENSION IF NOT EXISTS pg_trgm;\n?/g, ''))
      .join('\n');
    const c = new pg.Client({ host: 'localhost', port: PORT, user: USER, password: PASS, database: DB });
    await c.connect();
    await c.query(sql);
    await c.end();
    console.log('DB: migration applied.');
  } else {
    console.log('DB: schema already present.');
  }

  // Idempotent demo content so public pages are not empty.
  const core = await import('@researchtrics/core');
  const { prisma } = await import('@researchtrics/db');
  const existing = await prisma.user.findUnique({ where: { email: 'ada@researchtrics.local' } });
  if (!existing) {
    const { researcher, user } = await core.registerResearcher({
      email: 'ada@researchtrics.local',
      password: 'demo-password-123',
      displayName: 'Ada Lovelace',
    });
    await core.updateProfile(
      researcher.id,
      { biography: 'Mathematician and pioneer of scientific computing.', country: 'United Kingdom', academicRank: 'Professor' },
      user.id,
    );
    await core.setInterests(researcher.id, ['scientific computing', 'analytical engines', 'psychometrics']);
    await core.createProject(researcher.id, { title: 'Measurement Invariance Programme', description: 'A programme on cross-cultural measurement.' }, user.id);
    await core.createPublicationFromNormalized({
      title: 'A Study of Measurement Invariance',
      abstract: 'We examine invariance across cultures.',
      doi: '10.1234/demo.1',
      journalTitle: 'Journal of Testing',
      issnElectronic: '2515-8260',
      volume: '12',
      issue: '3',
      firstPage: '45',
      lastPage: '67',
      publishedYear: 2020,
      openAccess: true,
      authors: [{ rawName: 'Ada Lovelace', givenName: 'Ada', familyName: 'Lovelace' }],
      citationCounts: [{ source: 'crossref', count: 12 }],
      provenance: [{ source: 'crossref', sourceId: '10.1234/demo.1' }],
    });
    console.log('DB: demo content seeded.');
  }
  await prisma.$disconnect();

  console.log(`DB READY on ${process.env.DATABASE_URL}`);

  const shutdown = async () => {
    console.log('Stopping embedded PostgreSQL…');
    await server.stop();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
  // Keep the process (and Postgres) alive.
  setInterval(() => undefined, 1 << 30);
}

main().catch((err) => {
  console.error('serve-db error:', err);
  process.exit(1);
});
