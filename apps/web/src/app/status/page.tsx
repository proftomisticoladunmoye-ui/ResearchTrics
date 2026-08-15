import type { Metadata } from 'next';
import Link from 'next/link';
import { ContentPage } from '@/components/content-page';

export const metadata: Metadata = {
  title: 'Status',
  description: 'ResearchTrics systems overview.',
  alternates: { canonical: '/status' },
};

const COMPONENTS = [
  { name: 'Web application', detail: 'Public pages, dashboard, and API.' },
  { name: 'Database', detail: 'Researcher, publication, and metadata records.' },
  { name: 'Background worker', detail: 'Discovery runs and journal sync.' },
  { name: 'Object storage', detail: 'Uploaded files.' },
  { name: 'Scholarly sources', detail: 'ORCID, Crossref, OpenAlex, DataCite, PubMed, ROR, OJS.' },
];

export default function StatusPage() {
  return (
    <ContentPage
      title="System status"
      intro="An overview of the components that power ResearchTrics."
    >
      <p>
        For a live health check, see <Link href="/api/v1/health">/api/v1/health</Link>. Detailed,
        per-source health of the scholarly providers is available to administrators.
      </p>
      <ul>
        {COMPONENTS.map((c) => (
          <li key={c.name}>
            <strong>{c.name}</strong> — {c.detail}
          </li>
        ))}
      </ul>
      <p>
        If something isn&rsquo;t working, please <Link href="/contact">let us know</Link>.
      </p>
    </ContentPage>
  );
}
