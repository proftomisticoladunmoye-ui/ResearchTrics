import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@researchtrics/db';
import {
  SITEMAP_TYPES,
  SITEMAP_MAX_URLS,
  renderUrlset,
  XML_HEADERS,
  type SitemapType,
  type SitemapEntry,
} from '@/lib/sitemap';

export const dynamic = 'force-dynamic';

const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

/** Per-type sitemap of PUBLIC content only (Spec §42, §71). */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ type: string }> },
): Promise<NextResponse> {
  const { type } = await params;
  if (!SITEMAP_TYPES.includes(type as SitemapType)) {
    return new NextResponse('Not found', { status: 404 });
  }

  const entries = await buildEntries(type as SitemapType);
  return new NextResponse(renderUrlset(entries), { headers: XML_HEADERS });
}

async function buildEntries(type: SitemapType): Promise<SitemapEntry[]> {
  const take = SITEMAP_MAX_URLS;
  switch (type) {
    case 'researchers': {
      const rows = await prisma.researcher.findMany({
        where: { deletedAt: null, profileVisibility: 'public' },
        select: { slug: true, updatedAt: true },
        take,
      });
      return rows.map((r) => ({ loc: `${appUrl}/researchers/${r.slug}`, lastmod: r.updatedAt.toISOString() }));
    }
    case 'publications': {
      const rows = await prisma.publication.findMany({
        where: { deletedAt: null, visibility: 'public' },
        select: { slug: true, updatedAt: true },
        take,
      });
      return rows.map((p) => ({ loc: `${appUrl}/publications/${p.slug}`, lastmod: p.updatedAt.toISOString() }));
    }
    case 'institutions': {
      const rows = await prisma.institution.findMany({
        where: { deletedAt: null },
        select: { slug: true, updatedAt: true },
        take,
      });
      return rows.map((i) => ({ loc: `${appUrl}/institutions/${i.slug}`, lastmod: i.updatedAt.toISOString() }));
    }
    case 'journals': {
      const rows = await prisma.journal.findMany({ select: { slug: true, updatedAt: true }, take });
      return rows.map((j) => ({ loc: `${appUrl}/journals/${j.slug}`, lastmod: j.updatedAt.toISOString() }));
    }
  }
}
