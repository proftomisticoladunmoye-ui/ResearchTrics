import { Worker, Queue, type Job } from 'bullmq';
import IORedis from 'ioredis';
import pino from 'pino';
import { syncOjsSource } from '@researchtrics/integration-ojs';
import {
  runDiscovery,
  createDiscoveryProvider,
  expireOpportunities,
  type DiscoveryProviderName,
  type DiscoveryQuery,
} from '@researchtrics/core';
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
}

async function shutdown(signal: string): Promise<void> {
  logger.info({ signal }, 'Shutting down worker');
  await healthWorker.close();
  await ojsWorker.close();
  await discoveryWorker.close();
  await opportunityWorker.close();
  await healthQueue.close();
  await opportunityQueue.close();
  await connection.quit();
  process.exit(0);
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));

void bootstrap();
