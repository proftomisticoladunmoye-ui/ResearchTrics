import type { MetadataRoute } from 'next';

const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

/**
 * robots.txt — public scholarly content must remain crawlable by Google /
 * Google Scholar (Spec §11). Private surfaces are disallowed. Full per-type
 * sitemaps arrive in Phase 5.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        // The files route serves full-text PDFs that Google Scholar must fetch,
        // so it is allowed while the rest of /api/ stays blocked (more-specific
        // Allow wins over the broader Disallow).
        allow: ['/', '/api/v1/files/'],
        disallow: ['/dashboard', '/admin', '/api/'],
      },
    ],
    sitemap: `${appUrl}/sitemap.xml`,
  };
}
