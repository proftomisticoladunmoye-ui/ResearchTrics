import type { Metadata } from 'next';
import Link from 'next/link';
import { ContentPage } from '@/components/content-page';

export const metadata: Metadata = {
  title: 'Terms',
  description: 'Terms of use for the ResearchTrics platform.',
  alternates: { canonical: '/terms' },
};

export default function TermsPage() {
  return (
    <ContentPage title="Terms of Use" intro="The agreement for using ResearchTrics." updated="August 2026">
      <p>
        By using ResearchTrics you agree to these terms. If you do not agree, please do not use the
        service.
      </p>

      <h2>Using the platform</h2>
      <ul>
        <li>You are responsible for the accuracy of the information you add to your profile.</li>
        <li>You may claim only profiles that represent you, using genuine verification.</li>
        <li>
          You may not misuse the service — no scraping, automated abuse, attempts to
          misrepresent identity, or interference with other users.
        </li>
      </ul>

      <h2>Scholarly metadata</h2>
      <p>
        Metadata displayed here is aggregated from third-party scholarly sources and shown with its
        provenance. We strive for accuracy but cannot guarantee third-party data is complete or
        error-free. The master record for any work is never overwritten by a single source.
      </p>

      <h2>The Research Visibility Metric</h2>
      <p>
        The RVM is a transparent prototype pending validation. It is provided for informational
        purposes, is not a measure of research quality, and must not be presented as an official
        impact score.
      </p>

      <h2>Content &amp; conduct</h2>
      <p>
        You retain rights to content you upload and grant us the licence needed to display it on the
        platform. You must have the right to share anything you upload. See our{' '}
        <Link href="/copyright">copyright policy</Link>.
      </p>

      <h2>Availability</h2>
      <p>
        The service is provided &ldquo;as is&rdquo;. We may change or discontinue features, and we
        are not liable for indirect damages arising from use of the platform.
      </p>

      <p className="text-xs">
        These are starting terms for the platform and should be reviewed by counsel before you rely
        on them.
      </p>
    </ContentPage>
  );
}
