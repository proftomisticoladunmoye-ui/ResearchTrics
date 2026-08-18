import { Worker, Queue, type Job } from 'bullmq';
import IORedis from 'ioredis';
import pino from 'pino';
import { syncOjsSource } from '@researchtrics/integration-ojs';
import {
  runDiscovery,
  runDiscoveryWithWorks,
  createDiscoveryProvider,
  expireOpportunities,
  ingestOpportunities,
  createOpportunityProvider,
  sendEngagementDigests,
  emailProviderFromEnv,
  setEmailProvider,
  type DiscoveryProviderName,
  type DiscoveryQuery,
  type OpportunitySourceName,
} from '@researchtrics/core';

// Wire the real email transport (Resend when configured, else console).
setEmailProvider(emailProviderFromEnv());

/** Parse a DISCOVERY_SEED string like "country:UG" / "ror:https://…" / "topic:malaria". */
function parseSeed(seed: string): DiscoveryQuery {
  const i = seed.indexOf(':');
  const key = (i === -1 ? seed : seed.slice(0, i)).trim().toLowerCase();
  const value = (i === -1 ? '' : seed.slice(i + 1)).trim();
  const limit = Number(process.env.DISCOVERY_LIMIT ?? 25);
  const q: DiscoveryQuery = { limit } as DiscoveryQuery;
  if (key === 'country') (q as Record<string, unknown>).country = value;
  else if (key === 'ror') (q as Record<string, unknown>).rorId = value;
  else if (key === 'orcid') (q as Record<string, unknown>).orcid = value;
  else if (key === 'topic') (q as Record<string, unknown>).topic = value;
  else if (key === 'institution') (q as Record<string, unknown>).institution = value;
  return q;
}
import { QUEUES, defaultJobOptions } from './queues';

const logger = pino({
  level: process.env.LOG_LEVEL ?? (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
});

const redisUrl = process.env.REDIS_URL ?? 'redis://localhost:6379';

// BullMQ workers require maxRetriesPerRequest: null on the connection.
const connection = new IORedis(redisUrl, { maxRetriesPerRequest: null });

/**
 * Phase 1 worker: proves the queue infrastructure end-to-end with a health
 * queue. Integration/RVM/AI processors are registered in later phases.
 */
const healthQueue = new Queue(QUEUES.systemHealth, { connection, defaultJobOptions });

const healthWorker = new Worker(
  QUEUES.systemHealth,
  async (job: Job) => {
    logger.info({ jobId: job.id, name: job.name }, 'Processing health job');
    return { ok: true, at: new Date().toISOString() };
  },
  { connection, concurrency: 2 },
);

healthWorker.on('ready', () => logger.info('Worker ready; listening for jobs'));
healthWorker.on('failed', (job, err) =>
  logger.error({ jobId: job?.id, err }, 'Job failed'),
);
healthWorker.on('error', (err) => logger.error({ err }, 'Worker error'));

/** OJS sync processor (Spec §12, §73). Runs a full idempotent harvest. */
const ojsWorker = new Worker(
  QUEUES.ojsSync,
  async (job: Job<{ ojsSourceId: string }>) => {
    logger.info({ jobId: job.id, ojsSourceId: job.data.ojsSourceId }, 'Starting OJS sync');
    const result = await syncOjsSource(job.data.ojsSourceId, { kind: 'scheduled' });
    logger.info({ jobId: job.id, ...result }, 'OJS sync finished');
    return result;
  },
  { connection, concurrency: 1 },
);
ojsWorker.on('failed', (job, err) => logger.error({ jobId: job?.id, err }, 'OJS sync failed'));

/**
 * Researcher discovery processor (Discovery Engine §23, §52). Large discovery
 * campaigns run here — never inside a web request. Live providers join the
 * polite pool via env-configured mailto; the offline fixture provider needs no
 * config.
 */
const discoveryWorker = new Worker(
  QUEUES.discoveryRun,
  async (job: Job<{ provider: DiscoveryProviderName; query: DiscoveryQuery; actorId?: string | null }>) => {
    const { provider, query, actorId } = job.data;
    logger.info({ jobId: job.id, provider, query }, 'Starting discovery run');
    const instance = createDiscoveryProvider(provider, {
      openalex: { baseUrl: process.env.OPENALEX_BASE_URL, mailto: process.env.OPENALEX_MAILTO, apiKey: process.env.OPENALEX_API_KEY },
      crossref: { baseUrl: process.env.CROSSREF_BASE_URL, mailto: process.env.CROSSREF_MAILTO },
    });
    const summary = await runDiscovery({ provider: instance, query, actorId: actorId ?? null });
    logger.info({ jobId: job.id, ...summary, candidates: summary.candidates.length }, 'Discovery run finished');
    return summary;
  },
  { connection, concurrency: 1 },
);
discoveryWorker.on('failed', (job, err) => logger.error({ jobId: job?.id, err }, 'Discovery run failed'));

// Opportunity lifecycle: auto-close listings past their deadline (Spec §85).
const opportunityQueue = new Queue(QUEUES.opportunityExpire, { connection, defaultJobOptions });
const opportunityWorker = new Worker(
  QUEUES.opportunityExpire,
  async (job: Job) => {
    const result = await expireOpportunities();
    logger.info({ jobId: job.id, ...result }, 'Opportunity expiry sweep complete');
    return result;
  },
  { connection, concurrency: 1 },
);
opportunityWorker.on('failed', (job, err) =>
  logger.error({ jobId: job?.id, err }, 'Opportunity expiry failed'),
);

// Opportunity ingestion from legitimate sources (Spec §20). Gated: a real
// source only runs when OPPORTUNITY_INGEST_SOURCES lists it (terms reviewed).
const ingestQueue = new Queue(QUEUES.opportunityIngest, { connection, defaultJobOptions });
const ingestWorker = new Worker(
  QUEUES.opportunityIngest,
  async (job: Job<{ source: OpportunitySourceName; keyword?: string; rows?: number }>) => {
    const { source, keyword, rows } = job.data;
    const provider = createOpportunityProvider(source, {
      grantsGov: { baseUrl: process.env.GRANTS_GOV_BASE_URL },
      euFunding: { baseUrl: process.env.EU_FUNDING_BASE_URL },
      wikicfp: { category: process.env.WIKICFP_CATEGORY },
    });
    const result = await ingestOpportunities(provider, { keyword, rows });
    logger.info({ jobId: job.id, ...result }, 'Opportunity ingestion complete');
    return result;
  },
  { connection, concurrency: 1 },
);
ingestWorker.on('failed', (job, err) =>
  logger.error({ jobId: job?.id, err }, 'Opportunity ingestion failed'),
);

// Federation-first population: discover researchers from OpenAlex for a
// configured seed, then enrich each with their works. Gated on DISCOVERY_SEED.
const discoveryIngestQueue = new Queue(QUEUES.discoveryIngest, { connection, defaultJobOptions });
const discoveryIngestWorker = new Worker(
  QUEUES.discoveryIngest,
  async (job: Job<{ seed: string }>) => {
    const query = parseSeed(job.data.seed);
    const provider = createDiscoveryProvider('openalex', {
      openalex: { mailto: process.env.OPENALEX_MAILTO },
    });
    const summary = await runDiscoveryWithWorks(
      { provider, query, actorId: null },
      { worksPerResearcher: Number(process.env.DISCOVERY_WORKS ?? 25), mailto: process.env.OPENALEX_MAILTO },
    );
    logger.info(
      { jobId: job.id, discovered: summary.discovered, created: summary.created, enriched: summary.researchersEnriched, works: summary.worksCreated },
      'Discovery ingestion complete',
    );
    return summary;
  },
  { connection, concurrency: 1 },
);
discoveryIngestWorker.on('failed', (job, err) =>
  logger.error({ jobId: job?.id, err }, 'Discovery ingestion failed'),
);

// Weekly engagement email digests (§41). Gated on EMAIL_DIGESTS_ENABLED; needs a
// real email transport (EMAIL_PROVIDER=resend) to actually deliver.
const emailDigestQueue = new Queue(QUEUES.emailDigest, { connection, defaultJobOptions });
const emailDigestWorker = new Worker(
  QUEUES.emailDigest,
  async (job: Job) => {
    const result = await sendEngagementDigests(Number(process.env.EMAIL_DIGEST_DAYS ?? 7));
    logger.info({ jobId: job.id, ...result }, 'Engagement digests sent');
    return result;
  },
  { connection, concurrency: 1 },
);
emailDigestWorker.on('failed', (job, err) =>
  logger.error({ jobId: job?.id, err }, 'Engagement digest job failed'),
);

async function bootstrap(): Promise<void> {
  logger.info({ redisUrl: redisUrl.replace(/:[^:@/]*@/, ':****@') }, 'Starting ResearchTrics worker');
  // Enqueue a self-check so the pipeline is exercised on boot.
  await healthQueue.add('boot-check', { source: 'bootstrap' }).catch((err) => {
    logger.warn({ err }, 'Could not enqueue boot-check (is Redis up?)');
  });
  // Sweep expired opportunities now, then hourly (idempotent, deduped by jobId).
  await opportunityQueue.add('sweep', {}).catch(() => {});
  await opportunityQueue
    .add('sweep', {}, { repeat: { every: 60 * 60 * 1000 }, jobId: 'opportunity-expire-hourly' })
    .catch((err) => logger.warn({ err }, 'Could not schedule opportunity expiry'));

  // Schedule ingestion only for sources explicitly enabled (terms reviewed),
  // e.g. OPPORTUNITY_INGEST_SOURCES="grants_gov". Runs daily per source.
  const enabled = (process.env.OPPORTUNITY_INGEST_SOURCES ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean) as OpportunitySourceName[];
  for (const source of enabled) {
    // Run once now (repeatable jobs don't fire immediately), then daily.
    await ingestQueue
      .add('ingest', { source, rows: 100 })
      .catch((err) => logger.warn({ err, source }, 'Could not enqueue initial ingestion'));
    await ingestQueue
      .add(
        'ingest',
        { source, rows: 100 },
        { repeat: { every: 24 * 60 * 60 * 1000 }, jobId: `opportunity-ingest-${source}` },
      )
      .catch((err) => logger.warn({ err, source }, 'Could not schedule opportunity ingestion'));
    logger.info({ source }, 'Opportunity ingestion scheduled (immediate + daily)');
  }

  // Federation-first discovery: DISCOVERY_SEED is a comma-separated list so the
  // graph fills GLOBALLY (multiple countries / institutions / topics), each seed
  // run now + daily. Jobs process serially (concurrency 1), so many seeds are safe.
  const seeds = (process.env.DISCOVERY_SEED ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  for (const [i, seed] of seeds.entries()) {
    await discoveryIngestQueue.add('discover', { seed }).catch(() => {});
    await discoveryIngestQueue
      .add('discover', { seed }, { repeat: { every: 24 * 60 * 60 * 1000 }, jobId: `discovery-ingest-${i}` })
      .catch((err) => logger.warn({ err, seed }, 'Could not schedule discovery ingestion'));
  }
  if (seeds.length) logger.info({ seeds }, 'Global discovery ingestion scheduled (immediate + daily)');

  // Weekly engagement digests, when enabled.
  if (process.env.EMAIL_DIGESTS_ENABLED === 'true') {
    await emailDigestQueue
      .add('digest', {}, { repeat: { every: 7 * 24 * 60 * 60 * 1000 }, jobId: 'email-digest-weekly' })
      .catch((err) => logger.warn({ err }, 'Could not schedule email digests'));
    logger.info('Weekly engagement digests scheduled');
  }
}

async function shutdown(signal: string): Promise<void> {
  logger.info({ signal }, 'Shutting down worker');
  await healthWorker.close();
  await ojsWorker.close();
  await discoveryWorker.close();
  await opportunityWorker.close();
  await ingestWorker.close();
  await discoveryIngestWorker.close();
  await emailDigestWorker.close();
  await healthQueue.close();
  await opportunityQueue.close();
  await ingestQueue.close();
  await discoveryIngestQueue.close();
  await emailDigestQueue.close();
  await connection.quit();
  process.exit(0);
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));

void bootstrap();
