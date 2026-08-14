import { describe, it, expect } from 'vitest';
import {
  isAllowedUploadMime,
  sha256,
  pdfLikelyHasText,
  withinUploadSizeLimit,
  canAccessFile,
  MAX_UPLOAD_BYTES,
} from './storage';

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

describe('withinUploadSizeLimit', () => {
  it('rejects empty and oversized, accepts in-range', () => {
    expect(withinUploadSizeLimit(0)).toBe(false);
    expect(withinUploadSizeLimit(1)).toBe(true);
    expect(withinUploadSizeLimit(MAX_UPLOAD_BYTES)).toBe(true);
    expect(withinUploadSizeLimit(MAX_UPLOAD_BYTES + 1)).toBe(false);
  });
});

describe('canAccessFile (§36)', () => {
  const owner = { id: 'u1' };
  const other = { id: 'u2' };
  it('public is readable by anyone, even anonymous', () => {
    expect(canAccessFile('public', { uploaderId: 'u1' }, null)).toBe(true);
  });
  it('restricted/request require any authenticated user', () => {
    expect(canAccessFile('restricted', { uploaderId: 'u1' }, null)).toBe(false);
    expect(canAccessFile('restricted', { uploaderId: 'u1' }, other)).toBe(true);
    expect(canAccessFile('request', { uploaderId: 'u1' }, other)).toBe(true);
  });
  it('private/embargoed are uploader-only', () => {
    expect(canAccessFile('private', { uploaderId: 'u1' }, owner)).toBe(true);
    expect(canAccessFile('private', { uploaderId: 'u1' }, other)).toBe(false);
    expect(canAccessFile('embargoed', { uploaderId: 'u1' }, other)).toBe(false);
    expect(canAccessFile('embargoed', { uploaderId: 'u1' }, owner)).toBe(true);
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
