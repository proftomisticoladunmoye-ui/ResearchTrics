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
        allow: '/',
        disallow: ['/dashboard', '/admin', '/api/'],
      },
    ],
    sitemap: `${appUrl}/sitemap.xml`,
  };
}
