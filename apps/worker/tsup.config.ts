import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  target: 'node20',
  platform: 'node',
  clean: true,
  sourcemap: true,
  // Bundle workspace TS packages + pure-JS deps; keep only native / heavy
  // runtime packages external (they are declared as worker dependencies so
  // pnpm installs them where the bundle can resolve them at runtime).
  noExternal: [/^@researchtrics\//],
  external: [
    'bullmq',
    'ioredis',
    'pino',
    '@prisma/client',
    '.prisma/client',
    '@node-rs/argon2',
  ],
});
