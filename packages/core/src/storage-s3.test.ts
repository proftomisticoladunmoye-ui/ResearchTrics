import { describe, it, expect } from 'vitest';
import { S3StorageProvider, s3ConfigFromEnv, storageFromEnv, type S3Like } from './storage-s3';

const baseEnv = {
  OBJECT_STORAGE_ENDPOINT: 'https://acct.r2.cloudflarestorage.com',
  OBJECT_STORAGE_BUCKET: 'researchtrics',
  OBJECT_STORAGE_KEY: 'key',
  OBJECT_STORAGE_SECRET: 'secret',
} as NodeJS.ProcessEnv;

describe('s3ConfigFromEnv', () => {
  it('returns null when required vars are missing', () => {
    expect(s3ConfigFromEnv({} as NodeJS.ProcessEnv)).toBeNull();
    expect(
      s3ConfigFromEnv({ OBJECT_STORAGE_ENDPOINT: 'x', OBJECT_STORAGE_BUCKET: 'b' } as NodeJS.ProcessEnv),
    ).toBeNull();
  });

  it('defaults region to auto and path-style to true (R2 defaults)', () => {
    const cfg = s3ConfigFromEnv(baseEnv)!;
    expect(cfg.region).toBe('auto');
    expect(cfg.forcePathStyle).toBe(true);
    expect(cfg.publicBaseUrl).toBeUndefined();
  });

  it('honours explicit region, path-style=false, and public URL', () => {
    const cfg = s3ConfigFromEnv({
      ...baseEnv,
      OBJECT_STORAGE_REGION: 'us-east-1',
      OBJECT_STORAGE_FORCE_PATH_STYLE: 'false',
      OBJECT_STORAGE_PUBLIC_URL: 'https://cdn.example.org',
    } as NodeJS.ProcessEnv)!;
    expect(cfg.region).toBe('us-east-1');
    expect(cfg.forcePathStyle).toBe(false);
    expect(cfg.publicBaseUrl).toBe('https://cdn.example.org');
  });
});

describe('storageFromEnv', () => {
  it('selects the S3 provider when configured', () => {
    expect(storageFromEnv(baseEnv).name).toBe('s3');
  });
  it('falls back to local-fs when not configured', () => {
    expect(storageFromEnv({} as NodeJS.ProcessEnv).name).toBe('local');
  });
});

describe('S3StorageProvider.urlFor', () => {
  const cfg = s3ConfigFromEnv(baseEnv)!;
  const fakeClient: S3Like = { send: async () => ({}) };

  it('routes through the app file route when no public URL', () => {
    const p = new S3StorageProvider(cfg, fakeClient);
    expect(p.urlFor('ab/abcdef')).toBe('/api/v1/files/ab/abcdef');
  });

  it('returns a direct public URL when a public base is set (no double slash)', () => {
    const p = new S3StorageProvider({ ...cfg, publicBaseUrl: 'https://cdn.example.org/' }, fakeClient);
    expect(p.urlFor('ab/abcdef')).toBe('https://cdn.example.org/ab/abcdef');
  });
});

describe('S3StorageProvider.put', () => {
  it('sends a PutObject-shaped command with the bucket + key', async () => {
    const sent: unknown[] = [];
    const fakeClient: S3Like = {
      send: async (cmd) => {
        sent.push(cmd);
        return {};
      },
    };
    const p = new S3StorageProvider(s3ConfigFromEnv(baseEnv)!, fakeClient);
    await p.put('ab/abc', new Uint8Array([1, 2, 3]), 'application/pdf');
    expect(sent).toHaveLength(1);
    const input = (sent[0] as { input: { Bucket: string; Key: string; ContentType: string } }).input;
    expect(input.Bucket).toBe('researchtrics');
    expect(input.Key).toBe('ab/abc');
    expect(input.ContentType).toBe('application/pdf');
  });
});
