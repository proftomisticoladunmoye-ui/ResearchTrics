import { z } from 'zod';

/**
 * Centralized, validated environment schema (Spec §94, §95).
 * Integration secrets are optional in Phase 1 and validated lazily when
 * their integration is actually used (Phase 2+).
 */
const serverEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  // Core
  NEXT_PUBLIC_APP_URL: z.string().url().default('http://localhost:3000'),

  // Database
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  DIRECT_URL: z.string().optional(),

  // Redis
  REDIS_URL: z.string().min(1, 'REDIS_URL is required').default('redis://localhost:6379'),

  // Security
  SESSION_SECRET: z.string().min(32, 'SESSION_SECRET must be at least 32 characters'),
  TOKEN_ENCRYPTION_KEY: z
    .string()
    .min(1, 'TOKEN_ENCRYPTION_KEY is required for encrypting OAuth tokens at rest'),

  // Object storage (optional until file features land)
  OBJECT_STORAGE_ENDPOINT: z.string().optional(),
  OBJECT_STORAGE_BUCKET: z.string().optional(),
  OBJECT_STORAGE_KEY: z.string().optional(),
  OBJECT_STORAGE_SECRET: z.string().optional(),

  // AI Research Intelligence (Spec §29, §48). Grounded, provider-agnostic.
  // Defaults to the on-platform provider — no key needed, no data leaves.
  AI_PROVIDER: z.enum(['local', 'claude']).default('local'),
  AI_API_KEY: z.string().optional(),
  AI_MODEL: z.string().default('claude-opus-5'),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

let cached: ServerEnv | null = null;

/**
 * Parse and cache server environment. Throws a readable error listing every
 * invalid/missing variable. Call this once at process startup.
 */
export function loadServerEnv(source: NodeJS.ProcessEnv = process.env): ServerEnv {
  if (cached) return cached;
  const parsed = serverEnvSchema.safeParse(source);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  cached = parsed.data;
  return cached;
}

/** For tests: reset the memoized env. */
export function resetServerEnvCache(): void {
  cached = null;
}
