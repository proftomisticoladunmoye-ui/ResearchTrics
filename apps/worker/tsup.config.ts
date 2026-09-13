import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  target: 'node20',
  platform: 'node',
  clean: true,
  sourcemap: true,
  // `@researchtrics/core` bundles CommonJS deps (mammoth, pdfkit/fontkit,
  // sanitize-html) that call require("fs") / require("path") at load time. In an
  // ESM bundle esbuild has no `require`, so those become "Dynamic require of X is
  // not supported" and crash the worker on boot. Inject a real require via
  // createRequire so bundled CJS can resolve Node builtins at runtime.
  banner: {
    js: "import { createRequire as __rtCreateRequire } from 'module'; import { fileURLToPath as __rtFileURLToPath } from 'url'; import { dirname as __rtDirname } from 'path'; const require = __rtCreateRequire(import.meta.url); const __filename = __rtFileURLToPath(import.meta.url); const __dirname = __rtDirname(__filename);",
  },
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
