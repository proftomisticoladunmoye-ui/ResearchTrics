import { describe, it, expect } from 'vitest';
import { isAllowedUploadMime, sha256, pdfLikelyHasText } from './storage';

describe('upload validation', () => {
  it('allows known scholarly MIME types and rejects others', () => {
    expect(isAllowedUploadMime('application/pdf')).toBe(true);
    expect(isAllowedUploadMime('image/png')).toBe(true);
    expect(isAllowedUploadMime('application/x-msdownload')).toBe(false);
  });

  it('computes a stable sha256', () => {
    const a = sha256(new TextEncoder().encode('hello'));
    const b = sha256(new TextEncoder().encode('hello'));
    expect(a).toBe(b);
    expect(a).toHaveLength(64);
  });
});

describe('pdfLikelyHasText', () => {
  it('accepts a PDF with text operators', () => {
    const pdf = new TextEncoder().encode('%PDF-1.7\n... BT /F1 12 Tf (Hello) Tj ET ... /Font');
    expect(pdfLikelyHasText(pdf)).toBe(true);
  });

  it('rejects a non-PDF and an image-only PDF', () => {
    expect(pdfLikelyHasText(new TextEncoder().encode('not a pdf'))).toBe(false);
    const imageOnly = new TextEncoder().encode('%PDF-1.7\n/XObject /Image only, no fonts');
    expect(pdfLikelyHasText(imageOnly)).toBe(false);
  });
});
