import type { Metadata } from 'next';
import Link from 'next/link';
import { ContentPage } from '@/components/content-page';

export const metadata: Metadata = {
  title: 'Copyright',
  description: 'Copyright and takedown policy for ResearchTrics.',
  alternates: { canonical: '/copyright' },
};

export default function CopyrightPage() {
  return (
    <ContentPage title="Copyright &amp; Takedowns" intro="Respecting the rights of authors and publishers." updated="August 2026">
      <h2>Scholarly metadata</h2>
      <p>
        ResearchTrics displays bibliographic metadata (titles, authors, abstracts where licensed,
        identifiers) sourced from legitimate providers, each shown with its provenance. Bibliographic
        facts are surfaced for discovery and always link back to the authoritative source.
      </p>

      <h2>Uploaded files</h2>
      <p>
        You may upload files only if you hold the necessary rights or a licence that permits sharing.
        You are responsible for the copyright status of anything you upload, and for setting an
        appropriate access level.
      </p>

      <h2>Reporting infringement</h2>
      <p>
        If you believe content on ResearchTrics infringes your copyright, please{' '}
        <Link href="/contact">contact us</Link> with: the material in question and its URL, a
        description of the original work, your contact details, and a statement of good-faith belief
        that the use is unauthorised. We review valid reports promptly and will remove or restrict
        access to infringing material.
      </p>

      <h2>Counter-notice</h2>
      <p>
        If content you posted was removed and you believe that was in error, you may submit a
        counter-notice via <Link href="/contact">contact</Link>.
      </p>
    </ContentPage>
  );
}
