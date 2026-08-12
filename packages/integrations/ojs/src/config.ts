/**
 * OJS source configuration (Spec §12). No version is assumed; the probe detects
 * capabilities at runtime. All hosts are data, never hard-coded.
 */
export interface OjsSourceConfig {
  baseUrl: string;
  oaiUrl?: string | undefined;
  siteId?: string | undefined;
  apiToken?: string | undefined;
}

/** Default single-source config from the environment (docker-compose OJS). */
export function loadOjsConfigFromEnv(source: NodeJS.ProcessEnv = process.env): OjsSourceConfig | null {
  if (!source.OJS_BASE_URL) return null;
  return {
    baseUrl: source.OJS_BASE_URL,
    siteId: source.OJS_SITE_ID,
    apiToken: source.OJS_API_KEY,
  };
}

/** Candidate site-wide OAI endpoints to try during probing. */
export function oaiCandidates(baseUrl: string): string[] {
  const base = baseUrl.replace(/\/$/, '');
  return [`${base}/index.php/index/oai`, `${base}/index/oai`, `${base}/oai`];
}
