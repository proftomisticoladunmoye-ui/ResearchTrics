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
        // These API paths serve public scholarly full text + citation metadata
        // that Google Scholar must fetch (uploaded file PDFs, and the Research
        // Bulletin PDF/citation routes referenced by citation_pdf_url). They are
        // allowed while the rest of /api/ stays blocked — a more-specific Allow
        // wins over the broader Disallow.
        allow: ['/', '/api/v1/files/', '/api/v1/research-bulletin/'],
        disallow: ['/dashboard', '/admin', '/api/'],
      },
    ],
    sitemap: `${appUrl}/sitemap.xml`,
  };
}
