import { NextResponse, type NextRequest } from 'next/server';
import {
  getPublicationBySlug,
  buildCitationData,
  formatCitation,
  CITATION_FORMATS,
  type CitationFormat,
} from '@researchtrics/core';
import { fail } from '@/lib/api';
import { notFound } from '@researchtrics/core';

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
