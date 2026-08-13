import type { CrossrefConfig } from '@researchtrics/integration-crossref';
import type { OpenAlexConfig } from '@researchtrics/integration-openalex';
import type { ScholarlyMetadataProvider } from './types';
import { CrossrefMetadataProvider } from './crossref-provider';
import { OpenAlexMetadataProvider } from './openalex-provider';
import { DataCiteMetadataProvider, type DataCiteConfig } from './datacite-provider';

/** Federation providers available so far (more adapters land in F3–F4). */
export type FederationProviderName = 'crossref' | 'openalex' | 'datacite';

export interface FederationConfig {
  crossref?: CrossrefConfig | undefined;
  openalex?: OpenAlexConfig | undefined;
  datacite?: DataCiteConfig | undefined;
  /** Injectable HTTP for tests; defaults to global fetch. */
  fetchImpl?: typeof fetch | undefined;
}

/**
 * Resolve a scholarly-metadata provider by name (addendum §2, §45). Constructed
 * lazily — nothing calls the network until a method runs. Future adapters
 * (DataCite, PubMed, ROR, …) register here behind the same interface.
 */
export function createFederationProvider(
  name: FederationProviderName,
  config: FederationConfig = {},
): ScholarlyMetadataProvider {
  const fetchImpl = config.fetchImpl ?? fetch;
  switch (name) {
    case 'openalex':
      return new OpenAlexMetadataProvider(config.openalex ?? { baseUrl: 'https://api.openalex.org' }, fetchImpl);
    case 'datacite':
      return new DataCiteMetadataProvider(config.datacite ?? {}, fetchImpl);
    case 'crossref':
    default:
      return new CrossrefMetadataProvider(config.crossref ?? { baseUrl: 'https://api.crossref.org' }, fetchImpl);
  }
}

/** All configured providers — the seed of the source-health dashboard (§34). */
export function allFederationProviders(config: FederationConfig = {}): ScholarlyMetadataProvider[] {
  return [
    createFederationProvider('crossref', config),
    createFederationProvider('openalex', config),
    createFederationProvider('datacite', config),
  ];
}
