import {
  prisma,
  nextResearcherSerial,
  type User,
  type Researcher,
  type PrismaClient,
} from '@researchtrics/db';
import { hashPassword, verifyPassword } from './password';
import { formatResearchtricsId, slugWithSuffix } from './id';
import { conflict, unauthorized, validationError } from './errors';

/**
 * Account & identity provisioning (Spec §7, §55). Registration mints the
 * persistent RTX identity atomically with the user account.
 */

export interface RegisterInput {
  email: string;
  password: string;
  displayName: string;
}

export interface RegisteredAccount {
  user: User;
  researcher: Researcher;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function registerResearcher(
  input: RegisterInput,
  client: PrismaClient = prisma,
): Promise<RegisteredAccount> {
  const email = input.email.trim().toLowerCase();
  const displayName = input.displayName.trim();

  if (!EMAIL_RE.test(email)) throw validationError('A valid email address is required');
  if (displayName.length < 2) throw validationError('Display name is required');

  const existing = await client.user.findUnique({ where: { email } });
  if (existing) throw conflict('An account with this email already exists');

  // hashPassword enforces the password policy and throws on weak input.
  const passwordHash = await hashPassword(input.password).catch(() => {
    throw validationError('Password must be at least 10 characters');
  });

  const serial = await nextResearcherSerial(client);
  const researchtricsId = formatResearchtricsId(serial);
  const slug = slugWithSuffix(displayName, String(serial));

  return client.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: { email, passwordHash, status: 'active' },
    });

    const researcher = await tx.researcher.create({
      data: {
        researchtricsId,
        slug,
        displayName,
        userId: user.id,
        profileVisibility: 'public',
      },
    });

    // Default role assignment (Spec §6).
    await tx.userRole.create({
      data: { userId: user.id, role: 'researcher', scopeType: 'global' },
    });

    await tx.auditLog.create({
      data: {
        actorId: user.id,
        action: 'researcher.register',
        entityType: 'researcher',
        entityId: researcher.id,
        after: { researchtricsId, email },
      },
    });

    return { user, researcher };
  });
}

/** Verify credentials. Returns the user or throws unauthorized (no user enumeration). */
export async function authenticate(
  email: string,
  password: string,
  client: PrismaClient = prisma,
): Promise<User> {
  const normalized = email.trim().toLowerCase();
  const user = await client.user.findUnique({ where: { email: normalized } });
  const ok = user?.passwordHash
    ? await verifyPassword(user.passwordHash, password)
    : // Perform a dummy verify to reduce timing signal when the user is absent.
      await verifyPassword(
        '$argon2id$v=19$m=19456,t=2,p=1$c29tZXNhbHRzb21lc2FsdA$0000000000000000000000000000000000000000000',
        password,
      ).then(() => false);

  if (!user || !ok || user.deletedAt || user.status === 'suspended') {
    throw unauthorized('Invalid email or password');
  }
  return user;
}
