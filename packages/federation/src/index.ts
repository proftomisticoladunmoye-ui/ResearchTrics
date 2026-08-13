export * from './types';
export { toNormalizedWork } from './normalize';
export { timedHealthCheck } from './health';
export { CrossrefMetadataProvider } from './crossref-provider';
export { OpenAlexMetadataProvider } from './openalex-provider';
export { DataCiteMetadataProvider, mapDataCite, type DataCiteConfig } from './datacite-provider';
export {
  createFederationProvider,
  allFederationProviders,
  type FederationProviderName,
  type FederationConfig,
} from './factory';
