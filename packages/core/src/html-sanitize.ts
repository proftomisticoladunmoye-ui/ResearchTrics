import sanitizeHtml from 'sanitize-html';

/**
 * Sanitize rich scholarly HTML for a Research Bulletin body (§8, §44). Runs on
 * SAVE so stored content is always safe to render server-side. Allows the
 * semantic elements a scholarly article needs (headings, tables, figures,
 * blockquotes, footnotes, code) plus images and — narrowly — YouTube/Vimeo
 * iframes for embeds. Everything else (scripts, event handlers, arbitrary
 * iframes, javascript: URLs) is stripped. Treat all input as untrusted (admin
 * HTML today, DOCX-imported HTML in Phase 2).
 */
const YOUTUBE_VIMEO = /^https:\/\/(www\.)?(youtube\.com\/embed\/|player\.vimeo\.com\/video\/)/i;

export function sanitizeBulletinHtml(dirty: string): string {
  return sanitizeHtml(dirty, {
    allowedTags: [
      'h2', 'h3', 'h4', 'h5', 'h6',
      'p', 'br', 'hr', 'blockquote', 'pre', 'code',
      'strong', 'b', 'em', 'i', 'u', 's', 'sup', 'sub', 'mark', 'small',
      'ul', 'ol', 'li',
      'a', 'img',
      'figure', 'figcaption',
      'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'caption', 'colgroup', 'col',
      'section', 'aside', 'div', 'span',
      'iframe',
    ],
    allowedAttributes: {
      a: ['href', 'title', 'id', 'rel', 'target'],
      img: ['src', 'alt', 'title', 'width', 'height', 'loading'],
      iframe: ['src', 'title', 'width', 'height', 'allow', 'allowfullscreen', 'frameborder'],
      th: ['colspan', 'rowspan', 'scope'],
      td: ['colspan', 'rowspan'],
      col: ['span'],
      colgroup: ['span'],
      '*': ['id', 'class'],
    },
    // Only http(s)/mailto links and data/https images; no javascript: etc.
    allowedSchemes: ['http', 'https', 'mailto'],
    allowedSchemesByTag: { img: ['http', 'https', 'data'] },
    allowProtocolRelative: false,
    transformTags: {
      // External links open safely.
      a: (tagName, attribs) => {
        const out: Record<string, string> = { ...attribs };
        if (out.href && /^https?:/i.test(out.href)) {
          out.rel = 'noopener noreferrer nofollow';
          out.target = '_blank';
        }
        return { tagName, attribs: out };
      },
    },
    exclusiveFilter: (frame) =>
      // Drop any iframe whose src isn't a known video embed host.
      frame.tag === 'iframe' && !(frame.attribs.src && YOUTUBE_VIMEO.test(frame.attribs.src)),
  });
}

/** Extract plain text from sanitized HTML (for search, word count, previews). */
export function htmlToPlainText(html: string): string {
  return sanitizeHtml(html, { allowedTags: [], allowedAttributes: {} })
    .replace(/\s+/g, ' ')
    .trim();
}
