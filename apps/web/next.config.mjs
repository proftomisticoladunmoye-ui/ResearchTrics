/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Workspace packages ship TypeScript source; Next transpiles them.
  transpilePackages: [
    '@researchtrics/ui',
    '@researchtrics/core',
    '@researchtrics/config',
    '@researchtrics/db',
    '@researchtrics/integration-orcid',
    '@researchtrics/integration-crossref',
    '@researchtrics/integration-openalex',
    '@researchtrics/integration-shared',
    '@researchtrics/integration-ojs',
    '@researchtrics/search',
  ],
  // Native / server-only modules must not be bundled.
  serverExternalPackages: [
    '@node-rs/argon2',
    '@prisma/client',
    'pino',
    'bullmq',
    'ioredis',
    '@aws-sdk/client-s3',
    '@aws-sdk/s3-request-presigner',
  ],
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Keep the native argon2 addon (a .node binary) out of the webpack graph;
      // it is required at runtime from node_modules instead.
      config.externals = [...(config.externals ?? []), '@node-rs/argon2'];
    }
    return config;
  },
  eslint: {
    // Linting runs via the workspace `lint` task (root flat config), not here.
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
};

export default nextConfig;
