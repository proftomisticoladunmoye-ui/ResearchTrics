import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  target: 'node20',
  platform: 'node',
  clean: true,
  sourcemap: true,
  // Bundle workspace TS packages; keep runtime + native deps external.
  noExternal: [/^@researchtrics\//],
  external: [
    'bullmq',
    'ioredis',
    'pino',
    '@prisma/client',
    '.prisma/client',
    '@node-rs/argon2',
    'fast-xml-parser',
  ],
});
