import { prisma, type PrismaClient } from '@researchtrics/db';
import { generateSessionToken, hashToken } from './crypto';
import { getEmailProvider, emailVerificationTemplate } from './email';
import { badRequest } from './errors';

/**
 * Verification levels 0..5 (Spec §38) and single-use token flows (Spec §40).
 * Levels are honestly labelled; a level is only ever raised with a recorded,
 * auditable method.
 */

const EMAIL_TOKEN_TTL_MS = 1000 * 60 * 60 * 24; // 24h

/** Issue an email-verification token and dispatch the verification email. */
export async function issueEmailVerification(
  userId: string,
  email: string,
  appUrl: string,
  client: PrismaClient = prisma,
): Promise<void> {
  const token = generateSessionToken();
  await client.verificationToken.create({
    data: {
      userId,
      tokenHash: hashToken(token),
      purpose: 'email',
      expiresAt: new Date(Date.now() + EMAIL_TOKEN_TTL_MS),
    },
  });
  const verifyUrl = `${appUrl.replace(/\/$/, '')}/verify-email?token=${token}`;
  await getEmailProvider().send({ to: email, ...emailVerificationTemplate(verifyUrl) });
}

/**
 * Consume an email-verification token: marks the user verified and raises the
 * researcher to at least Level 1 (email verified). Idempotent-safe.
 */
export async function verifyEmailToken(
  token: string,
  client: PrismaClient = prisma,
): Promise<{ userId: string }> {
  const record = await client.verificationToken.findUnique({
    where: { tokenHash: hashToken(token) },
  });
  if (!record || record.purpose !== 'email') throw badRequest('Invalid verification link');
  if (record.usedAt) throw badRequest('This verification link has already been used');
  if (record.expiresAt.getTime() < Date.now()) throw badRequest('This verification link has expired');

  await client.$transaction(async (tx) => {
    await tx.verificationToken.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    });
    await tx.user.update({ where: { id: record.userId }, data: { emailVerified: true } });

    const researcher = await tx.researcher.findUnique({ where: { userId: record.userId } });
    if (researcher && researcher.verificationLevel < 1) {
      await tx.researcher.update({
        where: { id: researcher.id },
        data: { verificationLevel: 1 },
      });
      await tx.verificationRecord.create({
        data: { researcherId: researcher.id, level: 1, method: 'email' },
      });
      await tx.auditLog.create({
        data: {
          actorId: record.userId,
          action: 'researcher.verify',
          entityType: 'researcher',
          entityId: researcher.id,
          after: { level: 1, method: 'email' },
        },
      });
    }
  });

  return { userId: record.userId };
}

/**
 * Raise a researcher's verification level with an auditable record (Spec §38, §68).
 * Never lowers an existing level.
 */
export async function setVerificationLevel(
  researcherId: string,
  level: number,
  method: string,
  options: { verifiedById?: string; evidenceRef?: string; actorId?: string } = {},
  client: PrismaClient = prisma,
): Promise<void> {
  const researcher = await client.researcher.findUnique({ where: { id: researcherId } });
  if (!researcher) throw badRequest('Researcher not found');
  if (level <= researcher.verificationLevel) {
    // Still record the evidence, but do not lower the level.
    await client.verificationRecord.create({
      data: {
        researcherId,
        level,
        method,
        evidenceRef: options.evidenceRef ?? null,
        verifiedById: options.verifiedById ?? null,
      },
    });
    return;
  }

  await client.$transaction([
    client.researcher.update({ where: { id: researcherId }, data: { verificationLevel: level } }),
    client.verificationRecord.create({
      data: {
        researcherId,
        level,
        method,
        evidenceRef: options.evidenceRef ?? null,
        verifiedById: options.verifiedById ?? null,
      },
    }),
    client.auditLog.create({
      data: {
        actorId: options.actorId ?? options.verifiedById ?? null,
        action: 'researcher.verify',
        entityType: 'researcher',
        entityId: researcherId,
        after: { level, method },
      },
    }),
  ]);
}
