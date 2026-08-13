import { Badge } from '@researchtrics/ui';

/**
 * Provenance source badge (addendum §29). Indicates where a piece of metadata
 * came from — never implies endorsement.
 */
const LABELS: Record<string, string> = {
  orcid: 'ORCID',
  crossref: 'Crossref',
  openalex: 'OpenAlex',
  pubmed: 'PubMed',
  datacite: 'DataCite',
  ojs: 'OJS',
  ror: 'ROR',
  manual: 'Manual',
  fixture: 'Fixture',
};

export function SourceBadge({ source }: { source: string }) {
  return <Badge variant="outline">{LABELS[source] ?? source}</Badge>;
}
