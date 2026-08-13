import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { LocalFsStorageProvider, registerStorageEnvFactory, type StorageProvider } from './storage';
import { logger } from './logger';

/**
 * S3-compatible object storage (Spec §46). Works with Cloudflare R2, AWS S3,
 * MinIO — anything that speaks the S3 API. R2 is the intended production target:
 * set the endpoint to `https://<accountid>.r2.cloudflarestorage.com`, region
 * `auto`, and force path-style.
 *
 * The provider is only constructed when object-storage env vars are present
 * (see {@link storageFromEnv}); otherwise the app falls back to local-fs, so
 * nothing here presumes a live bucket — the same offline-first pattern as the
 * search and federation providers.
 */

export interface S3StorageConfig {
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  forcePathStyle: boolean;
  /**
   * Optional public base URL for objects served directly (an R2 custom domain
   * or the r2.dev subdomain). When set, {@link S3StorageProvider.urlFor} returns
   * `${publicBaseUrl}/${key}`. When absent, objects are served through the app's
   * own file route so access control can be enforced.
   */
  publicBaseUrl?: string;
}

/** Minimal surface of the S3 client we use — lets tests inject a fake. */
export interface S3Like {
  send(command: unknown): Promise<unknown>;
}

export class S3StorageProvider implements StorageProvider {
  readonly name = 's3';
  private readonly client: S3Like;

  constructor(
    private readonly config: S3StorageConfig,
    client?: S3Like,
  ) {
    this.client =
      client ??
      new S3Client({
        endpoint: config.endpoint,
        region: config.region,
        forcePathStyle: config.forcePathStyle,
        credentials: {
          accessKeyId: config.accessKeyId,
          secretAccessKey: config.secretAccessKey,
        },
        // R2 rejected the AWS SDK's default flexible checksums for a long time;
        // only add them when a command explicitly requires one.
        requestChecksumCalculation: 'WHEN_REQUIRED',
        responseChecksumValidation: 'WHEN_REQUIRED',
      });
  }

  async put(key: string, data: Uint8Array, contentType: string): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.config.bucket,
        Key: key,
        Body: data,
        ContentType: contentType,
      }),
    );
  }

  /**
   * A stable reference for the object. Public bucket → direct public URL;
   * otherwise the app's access-controlled file route. Synchronous by contract
   * (the interface); use {@link signedGetUrl} when a time-limited direct link
   * to a private object is needed.
   */
  urlFor(key: string): string {
    if (this.config.publicBaseUrl) {
      return `${this.config.publicBaseUrl.replace(/\/$/, '')}/${key}`;
    }
    return `/api/v1/files/${key}`;
  }

  /** Presigned, time-limited GET URL for a private object (default 5 min). */
  async signedGetUrl(key: string, expiresInSeconds = 300): Promise<string> {
    return getSignedUrl(
      this.client as S3Client,
      new GetObjectCommand({ Bucket: this.config.bucket, Key: key }),
      { expiresIn: expiresInSeconds },
    );
  }

  /** True if the object exists (used by the live connectivity check). */
  async exists(key: string): Promise<boolean> {
    try {
      await this.client.send(
        new HeadObjectCommand({ Bucket: this.config.bucket, Key: key }),
      );
      return true;
    } catch {
      return false;
    }
  }

  async delete(key: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.config.bucket, Key: key }),
    );
  }
}

/**
 * Build the config from environment, or `null` when object storage is not
 * configured (all four required vars must be present).
 */
export function s3ConfigFromEnv(env: NodeJS.ProcessEnv = process.env): S3StorageConfig | null {
  const endpoint = env.OBJECT_STORAGE_ENDPOINT;
  const bucket = env.OBJECT_STORAGE_BUCKET;
  const accessKeyId = env.OBJECT_STORAGE_KEY;
  const secretAccessKey = env.OBJECT_STORAGE_SECRET;
  if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) return null;
  return {
    endpoint,
    bucket,
    accessKeyId,
    secretAccessKey,
    region: env.OBJECT_STORAGE_REGION ?? 'auto',
    forcePathStyle: (env.OBJECT_STORAGE_FORCE_PATH_STYLE ?? 'true') !== 'false',
    publicBaseUrl: env.OBJECT_STORAGE_PUBLIC_URL || undefined,
  };
}

/**
 * Select a storage provider from the environment: an S3/R2 provider when object
 * storage is configured, else the local-fs provider for development. This is the
 * single decision point the app boots from.
 */
export function storageFromEnv(env: NodeJS.ProcessEnv = process.env): StorageProvider {
  const config = s3ConfigFromEnv(env);
  if (config) {
    logger.info({ endpoint: config.endpoint, bucket: config.bucket }, 'Using S3-compatible object storage');
    return new S3StorageProvider(config);
  }
  logger.info('Object storage not configured — using local filesystem provider');
  return new LocalFsStorageProvider();
}

// Register with storage.ts so getStorageProvider() selects S3/R2 from the
// environment on first use, without storage.ts importing this SDK-bearing module.
registerStorageEnvFactory(storageFromEnv);
