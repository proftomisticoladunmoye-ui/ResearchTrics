import { badRequest } from './errors';
import { logger } from './logger';

/**
 * Zenodo DOI minting (§20). Zenodo (operated by CERN/OpenAIRE) issues real,
 * citable DOIs for free — no membership or prefix required — and hosts the
 * deposited file as a recognized scholarly record, adding genuine discovery
 * value. A deposition must contain at least one file before it can be published,
 * so we upload the bulletin PDF. Publishing is irreversible (a published Zenodo
 * record cannot be deleted), same as a findable DataCite DOI.
 *
 * Requires a Zenodo personal access token (scopes: deposit:write,
 * deposit:actions). Dependency-free (fetch, injectable for tests).
 */

export interface ZenodoConfig {
  /** `https://zenodo.org/api` (production) or `https://sandbox.zenodo.org/api`. */
  baseUrl: string;
  token: string;
}

export function zenodoConfigFromEnv(env: NodeJS.ProcessEnv = process.env): ZenodoConfig | null {
  const token = env.ZENODO_TOKEN?.trim();
  if (!token) return null;
  const sandbox = env.ZENODO_ENVIRONMENT?.trim() !== 'production';
  return { baseUrl: sandbox ? 'https://sandbox.zenodo.org/api' : 'https://zenodo.org/api', token };
}

export function isZenodoConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  return zenodoConfigFromEnv(env) !== null;
}

export interface ZenodoCreator {
  name: string; // "Family, Given"
  affiliation?: string | undefined;
  orcid?: string | undefined;
}

export interface ZenodoDepositInput {
  title: string;
  description: string; // HTML allowed by Zenodo
  creators: ZenodoCreator[];
  publicationDate?: string | undefined; // YYYY-MM-DD
  keywords?: string[] | undefined;
  /** The canonical landing URL, recorded as a related identifier. */
  url: string;
  /** The file to deposit (bulletin PDF) and its filename. */
  file: Uint8Array;
  filename: string;
  /** Zenodo publication_type (default `article`). */
  publicationType?: string | undefined;
}

/**
 * Create → describe → upload → publish a Zenodo deposition, returning the minted
 * DOI. Each step surfaces Zenodo's own error text on failure.
 */
export async function mintZenodoDoi(
  config: ZenodoConfig,
  input: ZenodoDepositInput,
  fetchImpl: typeof fetch = fetch,
): Promise<{ doi: string; recordUrl: string; state: string }> {
  const auth = { authorization: `Bearer ${config.token}` };

  async function ensureOk(res: Awaited<ReturnType<typeof fetch>>, step: string): Promise<unknown> {
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      logger.error({ step, status: res.status, detail: detail.slice(0, 300) }, 'Zenodo request failed');
      throw badRequest(`Zenodo ${step} failed (${res.status}). ${detail.slice(0, 200)}`);
    }
    return res.json().catch(() => ({}));
  }

  // 1) Create an empty deposition.
  const created = (await ensureOk(
    await fetchImpl(`${config.baseUrl}/deposit/depositions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...auth },
      body: JSON.stringify({}),
    }),
    'create',
  )) as { id?: number; links?: { bucket?: string } };
  const id = created.id;
  const bucket = created.links?.bucket;
  if (!id || !bucket) throw badRequest('Zenodo did not return a deposition id/bucket.');

  // 2) Attach metadata.
  const metadata: Record<string, unknown> = {
    upload_type: 'publication',
    publication_type: input.publicationType ?? 'article',
    title: input.title,
    description: input.description,
    creators: input.creators.map((c) => ({
      name: c.name,
      ...(c.affiliation ? { affiliation: c.affiliation } : {}),
      ...(c.orcid ? { orcid: c.orcid } : {}),
    })),
    ...(input.publicationDate ? { publication_date: input.publicationDate } : {}),
    ...(input.keywords && input.keywords.length ? { keywords: input.keywords } : {}),
    related_identifiers: [{ relation: 'isIdenticalTo', identifier: input.url, scheme: 'url' }],
  };
  await ensureOk(
    await fetchImpl(`${config.baseUrl}/deposit/depositions/${id}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json', ...auth },
      body: JSON.stringify({ metadata }),
    }),
    'metadata',
  );

  // 3) Upload the file to the deposition bucket (required before publish).
  const put = await fetchImpl(`${bucket}/${encodeURIComponent(input.filename)}`, {
    method: 'PUT',
    headers: { 'content-type': 'application/octet-stream', ...auth },
    // fetch accepts a Uint8Array body at runtime; cast is type-only (core's lib
    // has no DOM BodyInit type).
    body: input.file as unknown as string,
  });
  await ensureOk(put, 'file upload');

  // 4) Publish → the DOI becomes registered/findable.
  const published = (await ensureOk(
    await fetchImpl(`${config.baseUrl}/deposit/depositions/${id}/actions/publish`, { method: 'POST', headers: auth }),
    'publish',
  )) as { doi?: string; links?: { record_html?: string }; state?: string };
  if (!published.doi) throw badRequest('Zenodo did not return a DOI on publish.');
  return { doi: published.doi, recordUrl: published.links?.record_html ?? '', state: published.state ?? 'done' };
}
