import type { Metadata } from 'next';
import Link from 'next/link';
import { ContentPage } from '@/components/content-page';

export const metadata: Metadata = {
  title: 'Privacy',
  description: 'How ResearchTrics collects, uses, and protects data.',
  alternates: { canonical: '/privacy' },
};

export default function PrivacyPage() {
  return (
    <ContentPage
      title="Privacy Policy"
      intro="How we handle personal and scholarly data."
      updated="August 2026"
    >
      <p>
        This policy explains what data ResearchTrics processes and why. It is a plain-language
        summary; please <Link href="/contact">contact us</Link> with any questions.
      </p>

      <h2>Data we hold</h2>
      <ul>
        <li>
          <strong>Account data</strong> you provide: name, email, password (stored only as a secure
          hash), and profile details you choose to add.
        </li>
        <li>
          <strong>Scholarly metadata</strong> gathered from legitimate public sources (ORCID,
          Crossref, OpenAlex, DataCite, PubMed, ROR, OJS), each retained with its provenance.
        </li>
        <li>
          <strong>Usage analytics</strong> — bot-filtered, aggregate view counts used to compute
          public metrics. We do not sell personal data.
        </li>
      </ul>

      <h2>Discovered profiles</h2>
      <p>
        Some profiles are created from public scholarly metadata before their owner joins. These are
        clearly marked unclaimed and are never presented as verified. If a profile is about you, you
        may claim it, correct it, or request its removal at any time.
      </p>

      <h2>Connected accounts</h2>
      <p>
        If you connect ORCID, we store access tokens encrypted at rest and never expose them to the
        browser. You can disconnect at any time.
      </p>

      <h2>Your rights</h2>
      <p>
        You can access, correct, export, or delete your data. To exercise these rights, or to
        request removal of a discovered profile, <Link href="/contact">contact us</Link>.
      </p>

      <p className="text-xs">
        This is a starting policy for the platform and should be reviewed against the regulations
        applicable to your jurisdiction before relying on it.
      </p>
    </ContentPage>
  );
}
