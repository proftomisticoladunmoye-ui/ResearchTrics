/**
 * Seed script (Spec §8 seed). Idempotent: safe to run repeatedly.
 * Ensures the RTX sequence + extensions exist, then seeds reference data
 * (a demo institution) for local development.
 */
import { prisma } from './index';

async function main(): Promise<void> {
  // Ensure sequence + extensions exist even if init.sql was not applied.
  await prisma.$executeRawUnsafe('CREATE EXTENSION IF NOT EXISTS pg_trgm');
  await prisma.$executeRawUnsafe(
    'CREATE SEQUENCE IF NOT EXISTS researcher_rtx_seq START WITH 1 INCREMENT BY 1',
  );
  await prisma.$executeRawUnsafe(
    'CREATE SEQUENCE IF NOT EXISTS publication_rtp_seq START WITH 1 INCREMENT BY 1',
  );

  const institution = await prisma.institution.upsert({
    where: { slug: 'researchtrics-demo-university' },
    update: {},
    create: {
      name: 'ResearchTrics Demo University',
      slug: 'researchtrics-demo-university',
      country: 'Global',
      type: 'university',
      isTenant: true,
    },
  });

  console.log(`Seed complete. Demo institution: ${institution.id}`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
