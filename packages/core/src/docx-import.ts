import mammoth from 'mammoth';
import { parse as parseHtml, type HTMLElement } from 'node-html-parser';
import { prisma, type PrismaClient } from '@researchtrics/db';
import { storeFile, isAllowedUploadMime } from './storage';
import { sanitizeBulletinHtml } from './html-sanitize';
import { logger } from './logger';

/**
 * DOCX → native Research Bulletin content (§11, §12). Converts an uploaded Word
 * document into structured, editable HTML (NOT an attachment): headings,
 * paragraphs, lists, tables, images, links and emphasis are preserved. Images
 * are uploaded to object storage (or inlined when the format isn't storable);
 * YouTube links become responsive embeds. The result is sanitized. An import
 * report surfaces what was detected and what needs the author's attention before
 * publication — we never fabricate structure we couldn't find.
 */

export interface DocxImportReport {
  titleDetected: boolean;
  headings: number;
  paragraphs: number;
  tables: number;
  images: number;
  imagesUploaded: number;
  imagesInlined: number;
  links: number;
  youtube: number;
  references: number;
  warnings: string[];
}

export interface DocxImportResult {
  title: string;
  bodyHtml: string;
  report: DocxImportReport;
}

const YT_RE = /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([A-Za-z0-9_-]{6,})/i;

function youtubeId(url: string): string | null {
  const m = url.match(YT_RE);
  return m ? m[1]! : null;
}

/**
 * Convert a .docx buffer. `uploaderId` owns any extracted images. `fetchImpl`
 * is unused here but kept for symmetry/testing of downstream callers.
 */
export async function importDocx(
  buffer: Buffer,
  opts: { uploaderId?: string | null } = {},
  client: PrismaClient = prisma,
): Promise<DocxImportResult> {
  let imagesUploaded = 0;
  let imagesInlined = 0;
  const warnings: string[] = [];

  // Mammoth → HTML, uploading each embedded image to object storage when its
  // format is storable, else inlining it as a data URI so nothing is lost.
  const { value: rawHtml, messages } = await mammoth.convertToHtml(
    { buffer },
    {
      convertImage: mammoth.images.imgElement(async (image) => {
        const contentType = image.contentType || 'application/octet-stream';
        const b64 = await image.read('base64');
        if (isAllowedUploadMime(contentType)) {
          try {
            const bytes = Buffer.from(b64, 'base64');
            const stored = await storeFile(
              {
                data: new Uint8Array(bytes),
                filename: `bulletin-image.${contentType.split('/')[1] ?? 'bin'}`,
                mimeType: contentType,
                accessLevel: 'public',
                uploaderId: opts.uploaderId ?? null,
              },
              client,
            );
            imagesUploaded += 1;
            return { src: stored.url };
          } catch (err) {
            logger.warn({ err: (err as Error).message }, 'DOCX image upload failed; inlining instead');
          }
        }
        imagesInlined += 1;
        return { src: `data:${contentType};base64,${b64}` };
      }),
    },
  );
  for (const m of messages) {
    if (m.type === 'warning') warnings.push(m.message);
  }

  return processImportedHtml(rawHtml, { imagesUploaded, imagesInlined, warnings });
}

/**
 * Pure transformation of mammoth's HTML into a bulletin body + report: lift the
 * title heading, turn YouTube links into embeds, count structure, sanitize.
 * Separated from I/O so it is deterministically unit-testable.
 */
export function processImportedHtml(
  rawHtml: string,
  extra: { imagesUploaded?: number; imagesInlined?: number; warnings?: string[] } = {},
): DocxImportResult {
  const warnings = [...(extra.warnings ?? [])];
  const imagesUploaded = extra.imagesUploaded ?? 0;
  const imagesInlined = extra.imagesInlined ?? 0;
  const root = parseHtml(rawHtml);

  // Title = first heading (h1 preferred, else h2); removed from the body.
  let title = '';
  const firstHeading = root.querySelector('h1') ?? root.querySelector('h2');
  if (firstHeading) {
    title = firstHeading.text.trim();
    firstHeading.remove();
  }
  if (!title) warnings.push('No title heading detected — set the title manually.');

  // YouTube <a> links → responsive iframe embeds.
  let youtube = 0;
  for (const a of root.querySelectorAll('a')) {
    const id = youtubeId(a.getAttribute('href') ?? '');
    if (id) {
      youtube += 1;
      a.replaceWith(
        parseHtml(
          `<figure><iframe src="https://www.youtube.com/embed/${id}" title="Embedded video" allowfullscreen></iframe></figure>`,
        ),
      );
    }
  }

  const headings = root.querySelectorAll('h2,h3,h4,h5,h6').length;
  const paragraphs = root.querySelectorAll('p').length;
  const tables = root.querySelectorAll('table').length;
  const images = root.querySelectorAll('img').length;
  const links = root.querySelectorAll('a').length;
  const references = countReferences(root);

  const bodyHtml = sanitizeBulletinHtml(root.toString());

  return {
    title,
    bodyHtml,
    report: { titleDetected: title.length > 0, headings, paragraphs, tables, images, imagesUploaded, imagesInlined, links, youtube, references, warnings },
  };
}

/** Best-effort reference count: list items or paragraphs after a References heading. */
function countReferences(root: HTMLElement): number {
  const headings = root.querySelectorAll('h1,h2,h3,h4,h5,h6');
  const refHeading = headings.find((h) => /^(references|bibliography|works cited)\b/i.test(h.text.trim()));
  if (!refHeading) return 0;
  // Count list items in the first list after the heading, else paragraphs until the next heading.
  let node = refHeading.nextElementSibling;
  let count = 0;
  while (node) {
    const tag = node.tagName?.toLowerCase();
    if (tag && /^h[1-6]$/.test(tag)) break;
    if (tag === 'ol' || tag === 'ul') count += node.querySelectorAll('li').length;
    else if (tag === 'p' && node.text.trim().length > 0) count += 1;
    node = node.nextElementSibling;
  }
  return count;
}
