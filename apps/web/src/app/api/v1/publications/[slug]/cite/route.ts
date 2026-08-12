import { NextResponse, type NextRequest } from 'next/server';
import {
  getPublicationBySlug,
  buildCitationData,
  formatCitation,
  recordEvent,
  CITATION_FORMATS,
  notFound,
  type CitationFormat,
} from '@researchtrics/core';
import { fail } from '@/lib/api';

export const dynamic = 'force-dynamic';

const FORMATS = Object.keys(CITATION_FORMATS) as CitationFormat[];

/** Download a citation in the requested format (Spec §10). */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await params;
    const format = (new URL(req.url).searchParams.get('format') ?? 'bibtex') as CitationFormat;
    if (!FORMATS.includes(format)) {
      return NextResponse.json({ error: { code: 'BAD_REQUEST', message: 'Unknown format' } }, { status: 400 });
    }

    const pub = await getPublicationBySlug(slug);
    if (!pub) throw notFound('Publication not found');

    await recordEvent({
      eventType: 'citation_export',
      entityType: 'publication',
      entityId: pub.id,
      userAgent: req.headers.get('user-agent'),
      ip: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
      referrer: req.headers.get('referer'),
      dedupeWindowMinutes: 0,
    }).catch(() => undefined);

    const body = formatCitation(buildCitationData(pub), format);
    const meta = CITATION_FORMATS[format];
    return new NextResponse(body, {
      headers: {
        'content-type': `${meta.mime}; charset=utf-8`,
        'content-disposition': `attachment; filename="${pub.slug}.${meta.extension}"`,
      },
    });
  } catch (err) {
    return fail(err);
  }
}
