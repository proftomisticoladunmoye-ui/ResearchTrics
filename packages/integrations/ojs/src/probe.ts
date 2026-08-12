import type { OjsStrategy } from '@researchtrics/db';
import { oaiCandidates } from './config';
import { oaiIdentify } from './oai';

/**
 * Capability probe (Spec §12). Inspects a live OJS install to detect its OAI
 * endpoint, best-effort version, and whether a native REST API is present —
 * then selects a harvest strategy. Nothing about the version is assumed.
 */
export interface ProbeResult {
  oaiUrl?: string;
  versionDetected?: string;
  restApiAvailable: boolean;
  strategy: OjsStrategy;
  repositoryName?: string;
}

export async function probeOjs(
  baseUrl: string,
  fetchImpl: typeof fetch = fetch,
): Promise<ProbeResult> {
  let oaiUrl: string | undefined;
  let versionDetected: string | undefined;
  let repositoryName: string | undefined;

  // 1) Find a working OAI-PMH endpoint (universally available on OJS).
  for (const candidate of oaiCandidates(baseUrl)) {
    try {
      const identify = await oaiIdentify(candidate, fetchImpl);
      oaiUrl = candidate;
      versionDetected = identify.detectedVersion;
      repositoryName = identify.repositoryName;
      break;
    } catch {
      // try the next candidate
    }
  }

  // 2) Best-effort native REST availability check (informational only).
  const restApiAvailable = await checkRest(baseUrl, fetchImpl);

  const result: ProbeResult = {
    // Prefer OAI-PMH: standardized, version-agnostic, and verifiable.
    restApiAvailable,
    strategy: 'oai_pmh',
  };
  if (oaiUrl) result.oaiUrl = oaiUrl;
  if (versionDetected) result.versionDetected = versionDetected;
  if (repositoryName) result.repositoryName = repositoryName;
  return result;
}

async function checkRest(baseUrl: string, fetchImpl: typeof fetch): Promise<boolean> {
  const url = `${baseUrl.replace(/\/$/, '')}/api/v1/contexts`;
  try {
    const res = await fetchImpl(url, { method: 'GET' });
    // 200 (public) or 401/403 (exists but needs auth) → the REST API is present.
    return res.status === 200 || res.status === 401 || res.status === 403;
  } catch {
    return false;
  }
}
