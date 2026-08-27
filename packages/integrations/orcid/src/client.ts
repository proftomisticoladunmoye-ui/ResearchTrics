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
  url.searchParams.set('scope', '/authenticate');
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
