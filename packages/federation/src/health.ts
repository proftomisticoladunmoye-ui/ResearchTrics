import type { ProviderHealth, HealthStatus } from './types';

/**
 * Timed liveness probe for a provider endpoint (addendum §34). Classifies as
 * healthy / warning / down from HTTP status and latency. HTTP is injectable so
 * this is unit-tested offline.
 */
export async function timedHealthCheck(
  provider: string,
  url: string,
  fetchImpl: typeof fetch = fetch,
  warnLatencyMs = 3000,
): Promise<ProviderHealth> {
  const startedAt = Date.now();
  const checkedAt = () => new Date().toISOString();
  try {
    const res = await fetchImpl(url, { method: 'GET' });
    const latencyMs = Date.now() - startedAt;
    let status: HealthStatus;
    if (!res.ok) status = res.status >= 500 ? 'down' : 'warning';
    else status = latencyMs > warnLatencyMs ? 'warning' : 'healthy';
    return {
      provider,
      status,
      latencyMs,
      checkedAt: checkedAt(),
      error: res.ok ? undefined : `HTTP ${res.status}`,
    };
  } catch (err) {
    return { provider, status: 'down', checkedAt: checkedAt(), error: (err as Error).message };
  }
}
