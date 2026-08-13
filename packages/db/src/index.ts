import { PrismaClient } from '@prisma/client';

export * from '@prisma/client';

/**
 * Prisma singleton. Avoids exhausting connections during Next.js hot-reload
 * by caching the client on globalThis in non-production.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma: PrismaClient =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

/**
 * Returns the next researcher serial from a Postgres sequence, used to mint the
 * persistent RTX identity (Spec §7). The sequence guarantees uniqueness under
 * concurrency without an application-level race.
 */
export async function nextResearcherSerial(client: PrismaClient = prisma): Promise<number> {
  return nextSerial('researcher_rtx_seq', client);
}

/** Next publication serial for minting RTP public IDs (Spec §9). */
export async function nextPublicationSerial(client: PrismaClient = prisma): Promise<number> {
  return nextSerial('publication_rtp_seq', client);
}

/** Next serial for project/dataset/instrument/software public IDs (Spec §9). */
export async function nextOutputSerial(
  kind: 'project' | 'dataset' | 'instrument' | 'software',
  client: PrismaClient = prisma,
): Promise<number> {
  const seq = {
    project: 'project_rtj_seq',
    dataset: 'dataset_rtd_seq',
    instrument: 'instrument_rti_seq',
    software: 'software_rts_seq',
  }[kind];
  return nextSerial(seq, client);
}

/** Next serial for minting RTO opportunity public IDs (Phase 13). */
export async function nextOpportunitySerial(client: PrismaClient = prisma): Promise<number> {
  return nextSerial('opportunity_rto_seq', client);
}

/** Next serial for minting RTW unified work record public IDs (Federation §16). */
export async function nextWorkSerial(client: PrismaClient = prisma): Promise<number> {
  return nextSerial('work_rtw_seq', client);
}

async function nextSerial(sequence: string, client: PrismaClient): Promise<number> {
  // Sequence name is an internal constant (never user input) — safe to inline.
  const rows = await client.$queryRawUnsafe<Array<{ nextval: bigint }>>(
    `SELECT nextval('${sequence}') AS nextval`,
  );
  const first = rows[0];
  if (!first) throw new Error(`Failed to obtain next value from sequence ${sequence}`);
  return Number(first.nextval);
}
