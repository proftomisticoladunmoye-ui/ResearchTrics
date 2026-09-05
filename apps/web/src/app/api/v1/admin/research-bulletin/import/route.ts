import { type NextRequest } from 'next/server';
import { importDocx, isAdmin, unauthorized, badRequest, MAX_UPLOAD_BYTES } from '@researchtrics/core';
import { ok, fail } from '@/lib/api';
import { getCurrentUser } from '@/lib/current-user';
import { enforceRateLimit } from '@/lib/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

/**
 * Admin: import a Microsoft Word (.docx) document into native, editable Research
 * Bulletin content — returns { title, bodyHtml, report } for the editor to
 * pre-fill (§11, §12). The document is NOT stored as an attachment; extracted
 * images are uploaded to object storage. Treats the upload as untrusted input.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || !isAdmin(user.actor)) throw unauthorized();
    await enforceRateLimit('upload', `user:${user.id}`);

    const form = await req.formData().catch(() => {
      throw badRequest('Expected multipart form-data.');
    });
    const entry = form.get('file');
    if (!(entry instanceof File)) throw badRequest('A .docx file is required.');
    const name = entry.name.toLowerCase();
    if (entry.type !== DOCX_MIME && !name.endsWith('.docx')) {
      throw badRequest('Only Microsoft Word .docx files are supported.');
    }
    if (entry.size === 0 || entry.size > MAX_UPLOAD_BYTES) {
      throw badRequest(`File must be between 1 byte and ${MAX_UPLOAD_BYTES} bytes.`);
    }

    const buffer = Buffer.from(await entry.arrayBuffer());
    const result = await importDocx(buffer, { uploaderId: user.id });
    return ok(result);
  } catch (err) {
    return fail(err);
  }
}
