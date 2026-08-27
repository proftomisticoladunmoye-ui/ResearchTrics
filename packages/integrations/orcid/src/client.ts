import { z } from 'zod';
import type { OrcidConfig } from './config';

/**
 * Low-level ORCID OAuth + public-record client. Pure URL building is separated
 * from network calls so it can be unit-tested without hitting ORCID.
 */

/** Build the authorization redirect URL. `state` is CSRF protection (Spec §35). */
export function buildAuthUrl(config: OrcidConfig, state: string): string {
  const url = new URL(config.authorizeUrl);
  url.searchParams.set('client_id', config.clientId);
  url.searchParams.set('response_type', 'code');
  // Scope widens to include /activities/update when work push-back is enabled.
  url.searchParams.set('scope', config.scope);
  url.searchParams.set('redirect_uri', config.redirectUri);
  url.searchParams.set('state', state);
  return url.toString();
}

const tokenResponseSchema = z.object({
  access_token: z.string(),
  token_type: z.string().optional(),
  refresh_token: z.string().optional(),
  expires_in: z.number().optional(),
  scope: z.string().optional(),
  name: z.string().nullable().optional(),
  orcid: z.string(),
});

export interface OrcidToken {
  accessToken: string;
  refreshToken?: string;
  expiresInSeconds?: number;
  scope?: string;
  name?: string;
  orcid: string;
}

/** Exchange an authorization code for tokens + the authenticated ORCID iD. */
export async function exchangeCode(
  config: OrcidConfig,
  code: string,
  fetchImpl: typeof fetch = fetch,
): Promise<OrcidToken> {
  const body = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    grant_type: 'authorization_code',
    code,
    redirect_uri: config.redirectUri,
  });

  const res = await fetchImpl(config.tokenUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' },
    body,
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    // Include ORCID's own error (e.g. redirect_uri mismatch, invalid client) so a
    // misconfiguration is diagnosable rather than an opaque failure.
    throw new Error(`ORCID token exchange failed (${res.status})${detail ? ` — ${detail.slice(0, 300)}` : ''}`);
  }
  const json = tokenResponseSchema.parse(await res.json());
  return {
    accessToken: json.access_token,
    ...(json.refresh_token ? { refreshToken: json.refresh_token } : {}),
    ...(json.expires_in !== undefined ? { expiresInSeconds: json.expires_in } : {}),
    ...(json.scope ? { scope: json.scope } : {}),
    ...(json.name ? { name: json.name } : {}),
    orcid: json.orcid,
  };
}

/** Our output types → ORCID work `type` (v3.0 enum). */
export function orcidWorkType(outputType: string): string {
  const map: Record<string, string> = {
    journal_article: 'journal-article',
    conference_paper: 'conference-paper',
    conference_proceeding: 'conference-paper',
    book: 'book',
    book_chapter: 'book-chapter',
    thesis: 'dissertation-thesis',
    dissertation: 'dissertation-thesis',
    preprint: 'preprint',
    postprint: 'preprint',
    working_paper: 'working-paper',
    technical_report: 'report',
    research_report: 'report',
    research_brief: 'report',
    policy_brief: 'report',
    dataset: 'data-set',
    software: 'software',
    systematic_review: 'journal-article',
    meta_analysis: 'journal-article',
    registered_report: 'journal-article',
    poster: 'conference-poster',
    presentation: 'lecture-speech',
  };
  return map[outputType] ?? 'other';
}

export interface OrcidWorkInput {
  title: string;
  outputType: string;
  publishedYear: number | null;
  journalName: string | null;
  doi: string | null;
  landingUrl: string;
}

/**
 * Build an ORCID v3.0 `work` payload (JSON). Always carries a self external-id
 * (the DOI when present, otherwise the ResearchTrics landing URL) so ORCID can
 * de-duplicate and we can re-find the record. Pure + unit-tested.
 */
export function buildWorkPayload(input: OrcidWorkInput): Record<string, unknown> {
  const externalIds: Array<Record<string, unknown>> = [];
  if (input.doi) {
    externalIds.push({
      'external-id-type': 'doi',
      'external-id-value': input.doi,
      'external-id-relationship': 'self',
    });
  }
  externalIds.push({
    'external-id-type': 'uri',
    'external-id-value': input.landingUrl,
    'external-id-relationship': 'self',
  });

  const work: Record<string, unknown> = {
    title: { title: { value: input.title } },
    type: orcidWorkType(input.outputType),
    'external-ids': { 'external-id': externalIds },
    url: { value: input.landingUrl },
  };
  if (input.journalName) work['journal-title'] = { value: input.journalName };
  if (input.publishedYear) {
    work['publication-date'] = { year: { value: String(input.publishedYear) } };
  }
  return work;
}

/**
 * Push a work into a researcher's ORCID record (member API, needs the
 * `/activities/update` scope). Returns the ORCID put-code so we can avoid
 * duplicates and update/delete later.
 */
export async function pushWork(
  config: OrcidConfig,
  orcid: string,
  accessToken: string,
  work: Record<string, unknown>,
  fetchImpl: typeof fetch = fetch,
): Promise<string> {
  const res = await fetchImpl(`${config.memberApiBase}/${orcid}/work`, {
    method: 'POST',
    headers: {
      'content-type': 'application/vnd.orcid+json',
      accept: 'application/vnd.orcid+json',
      authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(work),
  });
  if (res.status !== 201) {
    const detail = await res.text().catch(() => '');
    throw new Error(`ORCID work push failed (${res.status})${detail ? ` — ${detail.slice(0, 300)}` : ''}`);
  }
  // ORCID returns the new record's location; the put-code is its last path segment.
  const location = res.headers.get('location') ?? '';
  const putCode = location.split('/').filter(Boolean).pop() ?? '';
  if (!putCode) throw new Error('ORCID did not return a put-code for the pushed work');
  return putCode;
}

export interface OrcidPublicProfile {
  givenNames?: string;
  familyName?: string;
  creditName?: string;
  biography?: string;
  keywords: string[];
}

/** Fetch and normalize the public ORCID record. Robust to missing sections. */
export async function fetchPublicProfile(
  config: OrcidConfig,
  orcid: string,
  accessToken: string,
  fetchImpl: typeof fetch = fetch,
): Promise<OrcidPublicProfile> {
  const res = await fetchImpl(`${config.publicApiBase}/${orcid}/record`, {
    headers: { accept: 'application/json', authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`ORCID record fetch failed (${res.status})`);
  return normalizeRecord(await res.json());
}

/**
 * Extract the handful of fields we import, tolerating ORCID's deeply nested,
 * loosely-typed record shape. `any` is used deliberately for defensive access
 * into untyped third-party JSON; every extracted value is type-checked below.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
export function normalizeRecord(record: unknown): OrcidPublicProfile {
  const r = record as Record<string, any>;
  const person = r?.person ?? {};
  const name = person?.name ?? {};
  const keywords: string[] = Array.isArray(person?.keywords?.keyword)
    ? person.keywords.keyword
        .map((k: any) => (typeof k?.content === 'string' ? k.content : undefined))
        .filter((v: unknown): v is string => typeof v === 'string')
    : [];

  const profile: OrcidPublicProfile = { keywords };
  const given = name?.['given-names']?.value;
  const family = name?.['family-name']?.value;
  const credit = name?.['credit-name']?.value;
  const bio = person?.biography?.content;
  if (typeof given === 'string') profile.givenNames = given;
  if (typeof family === 'string') profile.familyName = family;
  if (typeof credit === 'string') profile.creditName = credit;
  if (typeof bio === 'string') profile.biography = bio;
  return profile;
}
/* eslint-enable @typescript-eslint/no-explicit-any */
