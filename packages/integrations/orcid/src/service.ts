import { prisma, type PrismaClient } from '@researchtrics/db';
import { encryptSecret, decryptSecret, setVerificationLevel, badRequest, conflict, notFound, logger } from '@researchtrics/core';
import { loadOrcidConfig } from './config';
import { exchangeCode, fetchPublicProfile, buildWorkPayload, pushWork, type OrcidPublicProfile } from './client';

/**
 * ORCID connect flow (Spec §13). Verifies iD ownership via OAuth, stores
 * ENCRYPTED tokens, links the iD as a verified identifier, raises verification
 * to Level 3, and imports a minimal public profile (filling empty fields only —
 * never overwriting researcher-provided data; Spec §85). Tokens are never
 * returned to callers/frontend.
 */

export interface ConnectResult {
  orcid: string;
  verificationLevel: number;
  imported: { biography: boolean; interests: number };
}

export async function connectOrcid(
  researcherId: string,
  code: string,
  client: PrismaClient = prisma,
  fetchImpl: typeof fetch = fetch,
): Promise<ConnectResult> {
  const config = loadOrcidConfig();
  const token = await exchangeCode(config, code, fetchImpl);
  const orcid = token.orcid;

  // Guard: an ORCID iD may belong to only one researcher (Spec §58).
  const existingOwner = await client.researcherIdentifier.findUnique({
    where: { scheme_value: { scheme: 'orcid', value: orcid } },
  });
  if (existingOwner && existingOwner.researcherId !== researcherId) {
    throw conflict('This ORCID iD is already connected to another ResearchTrics profile');
  }

  const accessTokenEnc = encryptSecret(token.accessToken);
  const refreshTokenEnc = token.refreshToken ? encryptSecret(token.refreshToken) : null;
  const tokenExpiresAt = token.expiresInSeconds
    ? new Date(Date.now() + token.expiresInSeconds * 1000)
    : null;

  await client.$transaction(async (tx) => {
    await tx.orcidConnection.upsert({
      where: { researcherId },
      update: { orcid, accessTokenEnc, refreshTokenEnc, scope: token.scope ?? null, tokenExpiresAt },
      create: {
        researcherId,
        orcid,
        accessTokenEnc,
        refreshTokenEnc,
        scope: token.scope ?? null,
        tokenExpiresAt,
      },
    });

    await tx.researcherIdentifier.upsert({
      where: { scheme_value: { scheme: 'orcid', value: orcid } },
      update: { verified: true, researcherId },
      create: { researcherId, scheme: 'orcid', value: orcid, verified: true },
    });
  });

  // Raise verification to Level 3 (ORCID verified) with an audit record.
  await setVerificationLevel(researcherId, 3, 'orcid', { evidenceRef: orcid }, client);

  // Best-effort public profile import (non-fatal).
  let imported = { biography: false, interests: 0 };
  try {
    const profile = await fetchPublicProfile(config, orcid, token.accessToken, fetchImpl);
    imported = await importPublicProfile(researcherId, orcid, profile, client);
  } catch (err) {
    logger.warn({ err, orcid }, 'ORCID public profile import failed (connection still established)');
  }

  const researcher = await client.researcher.findUnique({
    where: { id: researcherId },
    select: { verificationLevel: true },
  });

  return { orcid, verificationLevel: researcher?.verificationLevel ?? 3, imported };
}

/** Fill empty profile fields + add new interests from the ORCID record. */
async function importPublicProfile(
  researcherId: string,
  orcid: string,
  profile: OrcidPublicProfile,
  client: PrismaClient,
): Promise<{ biography: boolean; interests: number }> {
  const researcher = await client.researcher.findUnique({ where: { id: researcherId } });
  if (!researcher) return { biography: false, interests: 0 };

  // Provenance for the imported record (Spec §84).
  await client.externalRecord.upsert({
    where: {
      source_sourceId_entityType_entityId: {
        source: 'orcid',
        sourceId: orcid,
        entityType: 'researcher',
        entityId: researcherId,
      },
    },
    update: { lastSyncedAt: new Date(), normalizedPayload: profile as object },
    create: {
      source: 'orcid',
      sourceId: orcid,
      sourceUrl: `https://orcid.org/${orcid}`,
      entityType: 'researcher',
      entityId: researcherId,
      retrievedAt: new Date(),
      lastSyncedAt: new Date(),
      confidence: 1,
      normalizedPayload: profile as object,
    },
  });

  let biographyFilled = false;
  const updates: { biography?: string; givenNames?: string; familyName?: string } = {};
  if (!researcher.biography && profile.biography) {
    updates.biography = profile.biography;
    biographyFilled = true;
  }
  if (!researcher.givenNames && profile.givenNames) updates.givenNames = profile.givenNames;
  if (!researcher.familyName && profile.familyName) updates.familyName = profile.familyName;
  if (Object.keys(updates).length > 0) {
    await client.researcher.update({ where: { id: researcherId }, data: updates });
  }

  // Add interests from keywords, skipping any that already exist.
  let added = 0;
  for (const keyword of profile.keywords.slice(0, 30)) {
    const label = keyword.trim().slice(0, 80);
    if (!label) continue;
    const res = await client.researchInterest
      .create({ data: { researcherId, label } })
      .then(() => 1)
      .catch(() => 0); // unique(researcherId,label) → skip duplicates
    added += res;
  }

  return { biography: biographyFilled, interests: added };
}

export async function disconnectOrcid(
  researcherId: string,
  client: PrismaClient = prisma,
): Promise<void> {
  await client.orcidConnection.deleteMany({ where: { researcherId } });
  // Identifier is retained but marked unverified; identity history is preserved.
  await client.researcherIdentifier.updateMany({
    where: { researcherId, scheme: 'orcid' },
    data: { verified: false },
  });
}

export interface PushWorkResult {
  status: 'pushed' | 'exists';
  putCode: string;
}

/**
 * Push one of a researcher's publications into their ORCID record (Spec §13).
 * Requires ORCID work sync to be enabled AND the researcher's connection to carry
 * the `/activities/update` scope (re-connecting grants it). Idempotent: a work
 * already synced returns its put-code instead of pushing a duplicate. The token
 * is decrypted only in memory here, never returned.
 */
export async function pushPublicationToOrcid(
  researcherId: string,
  publicationId: string,
  opts: { fetchImpl?: typeof fetch } = {},
  client: PrismaClient = prisma,
): Promise<PushWorkResult> {
  const config = loadOrcidConfig();
  if (!config.workSyncEnabled) {
    throw badRequest('ORCID work sync is not enabled on this server (set ORCID_ENABLE_WORK_SYNC=true).');
  }

  const connection = await client.orcidConnection.findUnique({ where: { researcherId } });
  if (!connection) throw badRequest('Connect your ORCID iD first, then sync works.');
  if (!connection.scope || !connection.scope.includes('/activities/update')) {
    throw badRequest('Reconnect your ORCID iD to grant permission to add works (the update scope).');
  }

  // Idempotency: never push the same work twice.
  const existing = await client.orcidWorkSync.findUnique({
    where: { researcherId_publicationId: { researcherId, publicationId } },
    select: { putCode: true },
  });
  if (existing) return { status: 'exists', putCode: existing.putCode };

  const pub = await client.publication.findFirst({
    where: { id: publicationId, deletedAt: null },
    include: {
      journal: { select: { name: true } },
      identifiers: { where: { scheme: 'doi' }, select: { value: true }, take: 1 },
      authors: { where: { researcherId }, select: { id: true }, take: 1 },
    },
  });
  if (!pub) throw notFound('Publication not found.');
  if (pub.authors.length === 0) throw badRequest('You can only add your own works to your ORCID record.');

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.researchtrics.com').replace(/\/$/, '');
  const work = buildWorkPayload({
    title: pub.title,
    outputType: pub.outputType,
    publishedYear: pub.publishedYear,
    journalName: pub.journal?.name ?? null,
    doi: pub.identifiers[0]?.value ?? null,
    landingUrl: `${appUrl}/publications/${pub.slug}`,
  });

  const accessToken = decryptSecret(connection.accessTokenEnc);
  const putCode = await pushWork(config, connection.orcid, accessToken, work, opts.fetchImpl);

  await client.orcidWorkSync.create({ data: { researcherId, publicationId, putCode } });
  await client.orcidConnection.update({
    where: { researcherId },
    data: { lastSyncedAt: new Date() },
  });
  logger.info({ researcherId, publicationId, putCode }, 'Work pushed to ORCID');
  return { status: 'pushed', putCode };
}
