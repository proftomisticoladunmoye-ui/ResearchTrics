import mammoth from 'mammoth';
import { parse as parseHtml, type HTMLElement } from 'node-html-parser';
import { prisma, type PrismaClient } from '@researchtrics/db';
import { storeFile } from './storage';
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
  authorsDetected: number;
  abstractDetected: boolean;
  keywordsDetected: number;
  headings: number;
  paragraphs: number;
  tables: number;
  images: number;
  imagesUploaded: number;
  imagesInlined: number;
  /** Vector diagrams/charts (EMF/WMF) the web can't display — dropped + reported. */
  imagesUnconvertible: number;
  links: number;
  youtube: number;
  references: number;
  warnings: string[];
}

export interface ImportedAuthor {
  name: string;
  affiliation?: string;
}
export interface ImportedReference {
  raw: string;
  doi?: string;
}

export interface DocxImportResult {
  title: string;
  subtitle: string;
  authors: ImportedAuthor[];
  abstract: string;
  keywords: string[];
  references: ImportedReference[];
  bodyHtml: string;
  report: DocxImportReport;
}

const YT_RE = /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([A-Za-z0-9_-]{6,})/i;

/** Common scholarly section labels — never valid as a bulletin title. */
const SECTION_HEADING =
  /^(abstract|introduction|background|keywords?|methods?|methodology|materials(?:\s+and\s+methods)?|results|discussion|conclusions?|references?|bibliography|works cited|acknowledge?ments?|appendix|appendices|table of contents|contents|summary|highlights|limitations|implications|recommendations|literature review)\b/i;

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
  let imagesUnconvertible = 0;
  const warnings: string[] = [];

  // Web-renderable raster formats. Word DIAGRAMS/CHARTS/SmartArt are usually
  // stored as vector EMF/WMF (image/x-emf, image/x-wmf), which browsers cannot
  // display — we cannot faithfully rasterize those server-side, so they are
  // dropped from the body and reported for the author to re-insert as pictures.
  const WEB_IMAGE = /^image\/(png|jpe?g|gif|webp)$/i;

  const { value: rawHtml, messages } = await mammoth.convertToHtml(
    { buffer },
    {
      // Map Word's Title/Subtitle styles to real headings so the paper title is
      // detectable (Word's Title style otherwise becomes a plain paragraph).
      styleMap: [
        "p[style-name='Title'] => h1:fresh",
        "p[style-name='Subtitle'] => h2.rt-subtitle:fresh",
      ],
      convertImage: mammoth.images.imgElement(async (image) => {
        const contentType = (image.contentType || 'application/octet-stream').toLowerCase();
        if (!WEB_IMAGE.test(contentType)) {
          // e.g. image/x-emf, image/x-wmf, image/tiff, image/bmp — not usable on
          // the web. Emit an empty src marker; post-processing removes it.
          imagesUnconvertible += 1;
          return { src: '' };
        }
        const b64 = await image.read('base64');
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
          imagesInlined += 1;
          return { src: `data:${contentType};base64,${b64}` };
        }
      }),
    },
  );
  for (const m of messages) {
    if (m.type === 'warning') warnings.push(m.message);
  }

  return processImportedHtml(rawHtml, { imagesUploaded, imagesInlined, imagesUnconvertible, warnings });
}

/**
 * Pure transformation of mammoth's HTML into a bulletin body + report: lift the
 * title heading, turn YouTube links into embeds, count structure, sanitize.
 * Separated from I/O so it is deterministically unit-testable.
 */
export function processImportedHtml(
  rawHtml: string,
  extra: { imagesUploaded?: number; imagesInlined?: number; imagesUnconvertible?: number; warnings?: string[] } = {},
): DocxImportResult {
  const warnings = [...(extra.warnings ?? [])];
  const imagesUploaded = extra.imagesUploaded ?? 0;
  const imagesInlined = extra.imagesInlined ?? 0;
  const imagesUnconvertible = extra.imagesUnconvertible ?? 0;
  const root = parseHtml(rawHtml);

  // Title = the first heading — but ONLY if it isn't a standard section label
  // (Abstract, Introduction, References, …). A scholarly Word doc often has its
  // title as plain text and "Abstract"/"Introduction" as the first real heading;
  // lifting that as the title is wrong, so we skip it and ask for a manual title
  // rather than guessing.
  let title = '';
  const firstHeading = root.querySelector('h1') ?? root.querySelector('h2');
  if (firstHeading && !SECTION_HEADING.test(firstHeading.text.trim())) {
    title = firstHeading.text.trim();
    firstHeading.remove();
  }
  if (!title) {
    warnings.push(
      firstHeading
        ? `Title not set — the first heading ("${firstHeading.text.trim().slice(0, 40)}") looks like a section, not a title. Enter the title manually.`
        : 'No title heading detected — set the title manually.',
    );
  }

  // --- Front matter: lift authors/affiliation/abstract/keywords/references into
  // their own fields and OUT of the body, so the body is clean main content that
  // arranges to production quality without manual editing. ---
  const structured = !!findHeadingIn(root, /^(abstract|introduction|background)\b/i);

  // Subtitle (Word "Subtitle" style → h2.rt-subtitle).
  let subtitle = '';
  const subEl = root.querySelector('.rt-subtitle');
  if (subEl) {
    subtitle = subEl.text.trim();
    subEl.remove();
  }

  // Keywords line anywhere ("Keywords: a, b, c").
  let keywords: string[] = [];
  const kwEl = root.querySelectorAll('p').find((p) => /^\s*key\s?words?\b\s*[:.—-]/i.test(p.text));
  if (kwEl) {
    keywords = kwEl.text
      .replace(/^\s*key\s?words?\b\s*[:.—-]?\s*/i, '')
      .split(/[,;]/)
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 30);
    kwEl.remove();
  }

  // Authors + affiliation: the leading paragraph(s) before the first heading —
  // only in a structured scholarly doc, so we never swallow body prose.
  const authors: ImportedAuthor[] = [];
  if (structured) {
    const lead: HTMLElement[] = [];
    for (const node of root.childNodes as unknown as HTMLElement[]) {
      const tag = node.tagName?.toLowerCase();
      if (!tag) continue; // text node
      if (/^h[1-6]$/.test(tag)) break; // reached the first section heading
      if (tag === 'p') {
        if (node.text.trim()) lead.push(node);
      } else break; // a table/figure/list before any heading → not front matter
      if (lead.length >= 3) break;
    }
    if (lead.length) {
      const parsed = parseAuthors(lead.map((p) => p.text.trim()));
      if (parsed.length) {
        authors.push(...parsed);
        lead.forEach((p) => p.remove());
      }
    }
    if (authors.length === 0) warnings.push('Authors not detected — add author name(s) and affiliation manually.');
  }

  // Abstract section.
  let abstract = '';
  const absH = findHeadingIn(root, /^abstract\b/i);
  if (absH) {
    const nodes = collectUntilNextHeading(absH);
    abstract = nodes.map((n) => n.text.trim()).filter(Boolean).join('\n\n');
    absH.remove();
    nodes.forEach((n) => n.remove());
  }

  // References section → structured list with DOIs pulled out.
  const references: ImportedReference[] = [];
  const refH = findHeadingIn(root, /^(references|bibliography|works cited)\b/i);
  if (refH) {
    const nodes = collectUntilNextHeading(refH);
    for (const n of nodes) {
      const tag = n.tagName?.toLowerCase();
      if (tag === 'ol' || tag === 'ul') n.querySelectorAll('li').forEach((li) => pushReference(references, li.text));
      else pushReference(references, n.text);
    }
    refH.remove();
    nodes.forEach((n) => n.remove());
  }

  // Drop unconvertible-image markers (empty src emitted for EMF/WMF etc.).
  for (const img of root.querySelectorAll('img')) {
    if (!(img.getAttribute('src') ?? '').trim()) img.remove();
  }

  // Wrap each remaining image in a <figure>, pulling an adjacent caption
  // paragraph ("Figure N…"/"Table N…" or a short line) into <figcaption>, so
  // images/diagrams keep their position in the flow and render tidily.
  for (const img of root.querySelectorAll('img')) {
    if (img.closest('figure')) continue;
    const host = img.parentNode as HTMLElement | null;
    const hostIsSoleImageP =
      !!host && host.tagName?.toLowerCase() === 'p' && host.querySelectorAll('img').length === 1 && host.text.trim() === '';
    const caption = hostIsSoleImageP ? pickCaption(host) : null;
    const capHtml = caption ? `<figcaption>${escapeText(caption.text.trim())}</figcaption>` : '';
    const figure = parseHtml(`<figure>${img.toString()}${capHtml}</figure>`).querySelector('figure')!;
    if (hostIsSoleImageP) host!.replaceWith(figure);
    else img.replaceWith(figure);
    if (caption) caption.remove();
  }

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

  if (imagesUnconvertible > 0) {
    warnings.push(
      `${imagesUnconvertible} image${imagesUnconvertible === 1 ? '' : 's'} could not be imported — they are vector diagrams/charts (EMF/WMF, common for SmartArt or pasted charts) that browsers can't display. In Word, right-click each and "Save as Picture" (PNG/JPEG) then re-insert, or export the page as an image, and re-import.`,
    );
  }

  const bodyHtml = sanitizeBulletinHtml(root.toString());

  return {
    title,
    subtitle,
    authors,
    abstract,
    keywords,
    references,
    bodyHtml,
    report: {
      titleDetected: title.length > 0,
      authorsDetected: authors.length,
      abstractDetected: abstract.length > 0,
      keywordsDetected: keywords.length,
      headings,
      paragraphs,
      tables,
      images,
      imagesUploaded,
      imagesInlined,
      imagesUnconvertible,
      links,
      youtube,
      references: references.length,
      warnings,
    },
  };
}

/** A caption paragraph immediately after an image's wrapper, if it reads like one. */
function pickCaption(host: HTMLElement | null): HTMLElement | null {
  const next = host?.nextElementSibling as HTMLElement | null;
  if (!next || next.tagName?.toLowerCase() !== 'p') return null;
  const text = next.text.trim();
  if (!text) return null;
  // "Figure 1…", "Fig. 2…", "Table 3…", or a short standalone line.
  if (/^(figure|fig\.?|table|scheme|plate)\s*\d+/i.test(text) || text.length <= 160) return next;
  return null;
}

function escapeText(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** First heading (h1–h6) whose text matches `re`, or null. */
function findHeadingIn(root: HTMLElement, re: RegExp): HTMLElement | null {
  return root.querySelectorAll('h1,h2,h3,h4,h5,h6').find((h) => re.test(h.text.trim())) ?? null;
}

/** Sibling elements after `heading` up to (not including) the next heading. */
function collectUntilNextHeading(heading: HTMLElement): HTMLElement[] {
  const out: HTMLElement[] = [];
  let n = heading.nextElementSibling as HTMLElement | null;
  while (n) {
    if (n.tagName && /^h[1-6]$/.test(n.tagName.toLowerCase())) break;
    out.push(n);
    n = n.nextElementSibling as HTMLElement | null;
  }
  return out;
}

/** Parse a byline into authors + a shared affiliation (best-effort). */
function parseAuthors(lines: string[]): ImportedAuthor[] {
  const first = lines[0] ?? '';
  if (!first || first.length > 240) return []; // long → body prose, not a byline
  const names = first
    .split(/,| and |;|&|·/i)
    .map((s) => s.replace(/[\d*†‡§¶#]+/g, '').replace(/\s+/g, ' ').trim())
    .filter((n) => n.length >= 2 && n.length <= 80 && /[A-Za-z]/.test(n) && !/@/.test(n));
  if (names.length === 0) return [];
  const affiliation = lines.slice(1).join('; ').trim() || undefined;
  return names.map((name) => ({ name, ...(affiliation ? { affiliation } : {}) }));
}

/** Add a reference (with any DOI extracted) if the text is substantive. */
function pushReference(arr: ImportedReference[], raw: string): void {
  const t = raw.replace(/\s+/g, ' ').trim();
  if (t.length < 6) return;
  const doi = (t.match(/\b10\.\d{4,9}\/[^\s"<>]+/i)?.[0] ?? '').replace(/[.,;)\]]+$/, '');
  arr.push({ raw: t, ...(doi ? { doi } : {}) });
}
