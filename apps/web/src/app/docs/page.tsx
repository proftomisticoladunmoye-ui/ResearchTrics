import type { Metadata } from 'next';
import Link from 'next/link';
import { ContentPage } from '@/components/content-page';

export const metadata: Metadata = {
  title: 'Documentation',
  description: 'Key concepts for using ResearchTrics.',
  alternates: { canonical: '/docs' },
};

export default function DocsPage() {
  return (
    <ContentPage title="Documentation" intro="Key concepts and how the platform works.">
      <h2>Getting started</h2>
      <ul>
        <li>
          <Link href="/register">Create an account</Link>, then complete your profile and connect
          your ORCID iD.
        </li>
        <li>Import your publications by DOI, or let discovery surface them from public sources.</li>
        <li>
          Add other outputs — <Link href="/dashboard/outputs">projects, datasets, instruments,
          software</Link> — and upload supporting files.
        </li>
      </ul>

      <h2>Core concepts</h2>
      <ul>
        <li>
          <strong>ResearchTrics ID (RTX)</strong> — a persistent public identity that links all your
          scholarly identifiers.
        </li>
        <li>
          <strong>Provenance</strong> — every record shows where it came from; sources never
          overwrite the master record.
        </li>
        <li>
          <strong>Claiming &amp; verification</strong> — discovered profiles are unclaimed until you
          prove ownership via a verified ORCID or institutional email.
        </li>
        <li>
          <strong>RVM</strong> — the Research Visibility Metric, a transparent prototype pending
          validation, shown with all its inputs. See your{' '}
          <Link href="/dashboard/rvm">RVM dashboard</Link>.
        </li>
      </ul>

      <h2>Discovery &amp; federation</h2>
      <p>
        ResearchTrics federates metadata from ORCID, Crossref, OpenAlex, DataCite, PubMed, ROR, and
        OJS journals. Live source status is shown to administrators, and unified work records display
        each field&rsquo;s source and any conflicts openly.
      </p>

      <p>
        For programmatic access, see the <Link href="/api">API overview</Link>.
      </p>
    </ContentPage>
  );
}
