import type { ResearcherDiscoveryProvider } from './types';
import { FixtureDiscoveryProvider } from './fixture-provider';
import { OpenAlexDiscoveryProvider, type OpenAlexDiscoveryConfig } from './openalex-provider';
import { CrossrefDiscoveryProvider, type CrossrefDiscoveryConfig } from './crossref-provider';

/** Names of the discovery providers available in this slice. */
export type DiscoveryProviderName = 'fixture' | 'openalex' | 'crossref';

export interface DiscoveryProviderConfig {
  openalex?: OpenAlexDiscoveryConfig | undefined;
  crossref?: CrossrefDiscoveryConfig | undefined;
  /** Injectable HTTP for tests; defaults to global fetch. */
  fetchImpl?: typeof fetch | undefined;
}

/**
 * Resolve a discovery provider by name (Discovery Engine §39). The offline
 * `fixture` provider is always available; live providers require their config
 * (e.g. a `mailto` for the polite pool) but are constructed lazily so nothing
 * calls the network until `discover()` runs.
 */
export function createDiscoveryProvider(
  name: DiscoveryProviderName,
  config: DiscoveryProviderConfig = {},
): ResearcherDiscoveryProvider {
  switch (name) {
    case 'openalex':
      return new OpenAlexDiscoveryProvider(config.openalex ?? {}, config.fetchImpl ?? fetch);
    case 'crossref':
      return new CrossrefDiscoveryProvider(config.crossref ?? {}, config.fetchImpl ?? fetch);
    case 'fixture':
    default:
      return new FixtureDiscoveryProvider();
  }
}
