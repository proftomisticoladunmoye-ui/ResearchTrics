/* Live diagnostics: probe the REAL R2 bucket and the production DB enum. */
import 'dotenv/config';
import { probeObjectStorage, storeFile } from '../src/index';
import { prisma } from '@researchtrics/db';

async function main() {
  console.log('--- Object storage probe (real R2) ---');
  const probe = await probeObjectStorage();
  console.log(JSON.stringify(probe, null, 2));

  console.log('\n--- Full storeFile round-trip (PDF) ---');
  try {
    const bytes = new TextEncoder().encode('%PDF-1.4\nBT /F1 12 Tf (diag) Tj ET\n%%EOF');
    const r = await storeFile({ data: bytes, filename: 'diag.pdf', mimeType: 'application/pdf', accessLevel: 'public' });
    console.log('storeFile OK:', { id: r.id, url: r.url, pdfHasText: r.pdfHasText });
  } catch (err) {
    console.log('storeFile FAILED:', (err as Error).message);
  }

  console.log('\n--- Production NotificationType enum values ---');
  const rows = await prisma.$queryRawUnsafe<Array<{ enumlabel: string }>>(
    `SELECT e.enumlabel FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid WHERE t.typname = 'NotificationType' ORDER BY e.enumsortorder`,
  );
  console.log(rows.map((r) => r.enumlabel).join(', '));
  console.log('has coauthor_added:', rows.some((r) => r.enumlabel === 'coauthor_added'));

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error('DIAG ERROR:', e);
  process.exit(1);
});
