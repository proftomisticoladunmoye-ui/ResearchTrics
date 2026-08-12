import { Worker, Queue, type Job } from 'bullmq';
import IORedis from 'ioredis';
import pino from 'pino';
import { syncOjsSource } from '@researchtrics/integration-ojs';
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

async function bootstrap(): Promise<void> {
  logger.info({ redisUrl: redisUrl.replace(/:[^:@/]*@/, ':****@') }, 'Starting ResearchTrics worker');
  // Enqueue a self-check so the pipeline is exercised on boot.
  await healthQueue.add('boot-check', { source: 'bootstrap' }).catch((err) => {
    logger.warn({ err }, 'Could not enqueue boot-check (is Redis up?)');
  });
}

async function shutdown(signal: string): Promise<void> {
  logger.info({ signal }, 'Shutting down worker');
  await healthWorker.close();
  await ojsWorker.close();
  await healthQueue.close();
  await connection.quit();
  process.exit(0);
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));

void bootstrap();
