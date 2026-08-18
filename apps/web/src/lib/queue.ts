import { Queue } from 'bullmq';
import IORedis from 'ioredis';

/**
 * Lazy BullMQ producer for the web tier (Spec §43, §73). Expensive work is
 * enqueued, never run inline in a request. Shares one Redis connection.
 */
let connection: IORedis | null = null;
const queues = new Map<string, Queue>();

function getConnection(): IORedis {
  connection ??= new IORedis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
    maxRetriesPerRequest: null,
  });
  return connection;
}

export function getQueue(name: string): Queue {
  let q = queues.get(name);
  if (!q) {
    q = new Queue(name, { connection: getConnection() });
    queues.set(name, q);
  }
  return q;
}

export const OJS_SYNC_QUEUE = 'ojs.sync';
export const DISCOVERY_RUN_QUEUE = 'discovery.run';
export const EMAIL_DIGEST_QUEUE = 'email.digest';
