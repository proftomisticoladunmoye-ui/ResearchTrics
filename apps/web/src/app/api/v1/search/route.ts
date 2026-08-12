import { NextResponse, type NextRequest } from 'next/server';
import { PostgresSearchIndex, parseSearchParams } from '@researchtrics/search';
import { fail } from '@/lib/api';

export const dynamic = 'force-dynamic';

const index = new PostgresSearchIndex();

/** Global search across researchers, publications, institutions, journals (Spec §17). */
export async function GET(req: NextRequest) {
  try {
    const query = parseSearchParams(new URL(req.url).searchParams);
    const result = await index.search(query);
    return NextResponse.json({ data: result });
  } catch (err) {
    return fail(err);
  }
}
