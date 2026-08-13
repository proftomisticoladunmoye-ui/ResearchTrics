export * from './types';
export * from './identity';
export * from './tokens';
export { FixtureDiscoveryProvider, DEFAULT_FIXTURE } from './fixture-provider';
export {
  OpenAlexDiscoveryProvider,
  mapOpenAlexAuthor,
  buildOpenAlexAuthorsUrl,
  type OpenAlexDiscoveryConfig,
} from './openalex-provider';
export {
  CrossrefDiscoveryProvider,
  extractCrossrefAuthors,
  buildCrossrefWorksUrl,
  type CrossrefDiscoveryConfig,
} from './crossref-provider';
export {
  createDiscoveryProvider,
  type DiscoveryProviderName,
  type DiscoveryProviderConfig,
} from './factory';
