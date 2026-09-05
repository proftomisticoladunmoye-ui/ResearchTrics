import PDFDocument from 'pdfkit';
import { parse as parseHtml, type HTMLElement, type Node } from 'node-html-parser';
import { SERIES_NAME, SERIES_PUBLISHER, LICENSE_LABELS, BULLETIN_TYPE_LABELS, suggestedCitation, type BulletinAuthor, type BulletinReference, type BulletinDetail } from './bulletin';
import { logger } from './logger';

/**
 * Professional PDF for a published Research Bulletin (§19), generated from the
 * canonical content with pdfkit (pure-JS — no headless browser needed). Includes
 * ResearchTrics branding, the bulletin number, full front matter, body, figures
 * (best-effort image embedding), references, suggested citation and license.
 * Text-forward and reliable; complex figure/table fidelity improves over time.
 */

const BLUE = '#12386b';
const GOLD = '#9a7b1f';
const MUTED = '#6b7280';
const A4_MARGIN = 56;

function num(n: number | null): string {
  return n == null ? '—' : String(n).padStart(3, '0');
}

/** Fetch image bytes for embedding (data: URIs inline; http(s) via fetch). Best-effort. */
async function loadImage(src: string, appUrl: string): Promise<Buffer | null> {
  try {
    if (src.startsWith('data:')) {
      const comma = src.indexOf(',');
      if (comma === -1) return null;
      const meta = src.slice(5, comma);
      if (!/image\/(png|jpe?g)/i.test(meta)) return null; // pdfkit supports png/jpeg only
      return Buffer.from(src.slice(comma + 1), 'base64');
    }
    const url = src.startsWith('http') ? src : `${appUrl.replace(/\/$/, '')}${src}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const type = res.headers.get('content-type') ?? '';
    if (!/image\/(png|jpe?g)/i.test(type)) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    return buf.length > 0 && buf.length <= 8 * 1024 * 1024 ? buf : null;
  } catch (err) {
    logger.warn({ err: (err as Error).message, src: src.slice(0, 80) }, 'PDF image load failed');
    return null;
  }
}

export async function renderBulletinPdf(b: BulletinDetail, appUrl: string): Promise<Buffer> {
  const authors = Array.isArray(b.authors) ? (b.authors as unknown as BulletinAuthor[]) : [];
  const references = Array.isArray(b.references) ? (b.references as unknown as BulletinReference[]) : [];
  const url = `${appUrl.replace(/\/$/, '')}/research-bulletin/${b.slug}`;

  // Pre-load body images (async) before the synchronous pdfkit render pass.
  const root = parseHtml(b.bodyHtml);
  const imgSrcs = root.querySelectorAll('img').map((img) => img.getAttribute('src') ?? '').filter(Boolean).slice(0, 20);
  const imageCache = new Map<string, Buffer | null>();
  await Promise.all(imgSrcs.map(async (s) => imageCache.set(s, await loadImage(s, appUrl))));

  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: A4_MARGIN, bottom: A4_MARGIN, left: A4_MARGIN, right: A4_MARGIN },
    info: { Title: b.title, Author: authors.map((a) => a.name).join(', ') || SERIES_PUBLISHER },
  });
  const chunks: Buffer[] = [];
  doc.on('data', (c: Buffer) => chunks.push(c));
  const done = new Promise<Buffer>((resolve) => doc.on('end', () => resolve(Buffer.concat(chunks))));

  const contentWidth = doc.page.width - A4_MARGIN * 2;

  // --- Masthead ---
  doc.fillColor(GOLD).font('Helvetica-Bold').fontSize(9)
    .text(`${SERIES_NAME.toUpperCase()} · No. ${num(b.number)}`, { characterSpacing: 0.5 });
  doc.moveDown(0.2);
  doc.fillColor(MUTED).font('Helvetica').fontSize(8).text(BULLETIN_TYPE_LABELS[b.type] + ' · ' + b.category);
  doc.moveTo(A4_MARGIN, doc.y + 4).lineTo(doc.page.width - A4_MARGIN, doc.y + 4).strokeColor(GOLD).lineWidth(1).stroke();
  doc.moveDown(0.8);

  // --- Title block ---
  doc.fillColor(BLUE).font('Helvetica-Bold').fontSize(20).text(b.title, { lineGap: 2 });
  if (b.subtitle) doc.moveDown(0.2).fillColor(MUTED).font('Helvetica').fontSize(12).text(b.subtitle);
  doc.moveDown(0.4);
  if (authors.length) {
    doc.fillColor('#111827').font('Helvetica-Bold').fontSize(10)
      .text(authors.map((a) => a.name).join(', '));
    const affil = Array.from(new Set(authors.map((a) => a.affiliation).filter(Boolean)));
    if (affil.length) doc.font('Helvetica').fontSize(9).fillColor(MUTED).text(affil.join('; '));
  }
  doc.font('Helvetica').fontSize(9).fillColor(MUTED).text(
    `${b.publicationDate ? b.publicationDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : ''} · Published by ${SERIES_PUBLISHER}`,
  );
  doc.moveDown(0.8);

  // --- Abstract ---
  sectionHeading(doc, 'Abstract');
  doc.font('Helvetica').fontSize(10).fillColor('#1f2937').text(b.abstract, { lineGap: 2, align: 'justify' });
  if (b.keywords.length) {
    doc.moveDown(0.3).font('Helvetica-Oblique').fontSize(9).fillColor(MUTED).text(`Keywords: ${b.keywords.join(', ')}`);
  }
  doc.moveDown(0.6);

  // --- Body ---
  renderChildren(doc, root, contentWidth, imageCache);

  // --- References ---
  if (references.length) {
    ensureSpace(doc, 80);
    doc.moveDown(0.6);
    sectionHeading(doc, 'References');
    doc.font('Helvetica').fontSize(9).fillColor('#1f2937');
    references.forEach((r, i) => {
      doc.text(`${i + 1}. ${r.raw}${r.doi ? ` https://doi.org/${r.doi}` : ''}`, { lineGap: 1.5, paragraphGap: 3 });
    });
  }

  // --- Suggested citation ---
  doc.moveDown(0.8);
  ensureSpace(doc, 70);
  sectionHeading(doc, 'Suggested citation');
  doc.font('Helvetica-Oblique').fontSize(9).fillColor('#1f2937').text(suggestedCitation(b, appUrl), { lineGap: 1.5 });

  // --- Footer ---
  doc.moveDown(0.8);
  doc.moveTo(A4_MARGIN, doc.y).lineTo(doc.page.width - A4_MARGIN, doc.y).strokeColor('#e5e7eb').lineWidth(0.5).stroke();
  doc.moveDown(0.3);
  doc.font('Helvetica').fontSize(8).fillColor(MUTED).text(
    `${SERIES_NAME} · No. ${num(b.number)} · License: ${LICENSE_LABELS[b.license] ?? b.license}`,
  );
  doc.fillColor(BLUE).fontSize(8).text(url, { link: url, underline: true });

  doc.end();
  return done;
}

function sectionHeading(doc: PDFKit.PDFDocument, text: string): void {
  doc.font('Helvetica-Bold').fontSize(12).fillColor(BLUE).text(text);
  doc.moveDown(0.25);
}

function ensureSpace(doc: PDFKit.PDFDocument, needed: number): void {
  if (doc.y + needed > doc.page.height - A4_MARGIN) doc.addPage();
}

function renderChildren(doc: PDFKit.PDFDocument, parent: HTMLElement, width: number, images: Map<string, Buffer | null>): void {
  for (const node of parent.childNodes) renderNode(doc, node, width, images);
}

function textOf(el: HTMLElement): string {
  return el.text.replace(/\s+/g, ' ').trim();
}

function renderNode(doc: PDFKit.PDFDocument, node: Node, width: number, images: Map<string, Buffer | null>): void {
  const el = node as HTMLElement;
  const tag = el.tagName?.toLowerCase();
  if (!tag) return; // text nodes handled inside blocks
  switch (tag) {
    case 'h2':
    case 'h3':
    case 'h4':
    case 'h5':
    case 'h6': {
      ensureSpace(doc, 40);
      const size = tag === 'h2' ? 14 : tag === 'h3' ? 12 : 11;
      doc.moveDown(0.4).font('Helvetica-Bold').fontSize(size).fillColor(BLUE).text(textOf(el), { lineGap: 1 });
      doc.moveDown(0.2);
      break;
    }
    case 'p': {
      const t = textOf(el);
      if (t) doc.font('Helvetica').fontSize(10).fillColor('#1f2937').text(t, { lineGap: 2, align: 'justify', paragraphGap: 4 });
      // Inline images inside paragraphs
      for (const img of el.querySelectorAll('img')) embedImage(doc, img, width, images);
      break;
    }
    case 'ul':
    case 'ol': {
      const items = el.querySelectorAll('li').map((li) => textOf(li)).filter(Boolean);
      doc.font('Helvetica').fontSize(10).fillColor('#1f2937');
      items.forEach((it, i) => {
        ensureSpace(doc, 24);
        doc.text(`${tag === 'ol' ? `${i + 1}.` : '•'}  ${it}`, { indent: 12, lineGap: 1.5, paragraphGap: 2 });
      });
      doc.moveDown(0.2);
      break;
    }
    case 'blockquote': {
      const t = textOf(el);
      if (t) { ensureSpace(doc, 30); doc.font('Helvetica-Oblique').fontSize(10).fillColor(MUTED).text(t, { indent: 16, lineGap: 2, paragraphGap: 4 }); }
      break;
    }
    case 'pre':
    case 'code': {
      const t = el.text.replace(/\n+$/,'');
      if (t.trim()) { ensureSpace(doc, 30); doc.font('Courier').fontSize(8.5).fillColor('#111827').text(t, { lineGap: 1 }); doc.moveDown(0.3); }
      break;
    }
    case 'figure': {
      for (const img of el.querySelectorAll('img')) embedImage(doc, img, width, images);
      const cap = el.querySelector('figcaption');
      if (cap) doc.font('Helvetica-Oblique').fontSize(8.5).fillColor(MUTED).text(textOf(cap), { align: 'center' }).moveDown(0.2);
      // iframes (video) can't render in PDF — leave a reference.
      const iframe = el.querySelector('iframe');
      if (iframe) doc.font('Helvetica').fontSize(9).fillColor(BLUE).text(`[Video: ${iframe.getAttribute('src') ?? ''}]`);
      break;
    }
    case 'img':
      embedImage(doc, el, width, images);
      break;
    case 'table':
      renderTable(doc, el, width);
      break;
    case 'section':
    case 'div':
      renderChildren(doc, el, width, images);
      break;
    default: {
      const t = textOf(el);
      if (t) doc.font('Helvetica').fontSize(10).fillColor('#1f2937').text(t, { lineGap: 2, paragraphGap: 3 });
    }
  }
}

function embedImage(doc: PDFKit.PDFDocument, img: HTMLElement, width: number, images: Map<string, Buffer | null>): void {
  const src = img.getAttribute('src') ?? '';
  const buf = images.get(src);
  if (!buf) return;
  try {
    ensureSpace(doc, 120);
    doc.moveDown(0.2).image(buf, { fit: [width, 320], align: 'center' });
    doc.moveDown(0.2);
  } catch {
    /* unsupported image — skip */
  }
}

function renderTable(doc: PDFKit.PDFDocument, table: HTMLElement, width: number): void {
  const rows = table.querySelectorAll('tr');
  if (rows.length === 0) return;
  doc.moveDown(0.2).font('Helvetica').fontSize(8.5).fillColor('#1f2937');
  for (const tr of rows) {
    const cells = tr.querySelectorAll('th,td').map((c) => textOf(c));
    if (cells.length === 0) continue;
    const colW = width / cells.length;
    const isHead = tr.querySelector('th') != null;
    ensureSpace(doc, 20);
    const y = doc.y;
    cells.forEach((c, i) => {
      doc.font(isHead ? 'Helvetica-Bold' : 'Helvetica')
        .text(c, A4_MARGIN + i * colW, y, { width: colW - 6, lineGap: 1 });
    });
    doc.moveDown(0.3);
  }
  doc.moveDown(0.2);
}
