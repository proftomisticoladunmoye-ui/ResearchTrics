/**
 * Background job queues (Spec §73). Names are stable contracts shared between
 * producers (web) and this worker. Processors are added phase by phase.
 */
export const QUEUES = {
  systemHealth: 'system.health',
  ojsSync: 'ojs.sync',
  discoveryRun: 'discovery.run',
  orcidSync: 'orcid.sync',
  crossrefImport: 'crossref.import',
  openalexImport: 'openalex.import',
  citationUpdate: 'citation.update',
  pdfExtract: 'pdf.extract',
  rvmCompute: 'rvm.compute',
  aiProcess: 'ai.process',
  analyticsAggregate: 'analytics.aggregate',
  email: 'email.send',
  notification: 'notification.dispatch',
  opportunityExpire: 'opportunity.expire',
  opportunityIngest: 'opportunity.ingest',
  discoveryIngest: 'discovery.ingest',
} as const;

export type QueueName = (typeof QUEUES)[keyof typeof QUEUES];

/** Default job options: retries with backoff + dead-lettering semantics (Spec §73). */
export const defaultJobOptions = {
  attempts: 5,
  backoff: { type: 'exponential' as const, delay: 2000 },
  removeOnComplete: { age: 3600, count: 1000 },
  removeOnFail: { age: 24 * 3600 },
};
