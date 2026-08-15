import type { Metadata } from 'next';
import Link from 'next/link';
import { ContentPage } from '@/components/content-page';

export const metadata: Metadata = {
  title: 'About',
  description:
    'ResearchTrics is a global research visibility and scholarly metadata federation platform, built provenance-first on legitimate scholarly sources.',
  alternates: { canonical: '/about' },
};

export default function AboutPage() {
  return (
    <ContentPage
      title="About ResearchTrics"
      intro="A global platform for research visibility and scholarly metadata federation — built provenance-first."
    >
      <h2>What we do</h2>
      <p>
        ResearchTrics gives researchers a persistent identity and a complete, standards-based public
        profile that search engines and scholars can find. We federate scholarly metadata from
        legitimate sources, help researchers claim and verify their work, and surface discovery and
        collaboration opportunities.
      </p>

      <h2>How we source data</h2>
      <p>
        Every record carries its provenance. We integrate only legitimate scholarly APIs — ORCID,
        Crossref, OpenAlex, DataCite, PubMed, ROR, and OJS-based journals — and we never scrape
        services such as ResearchGate, Academia.edu, Google Scholar, or LinkedIn, nor harvest
        private email addresses. A discovered profile is clearly labelled unclaimed and is never
        presented as verified until its owner proves ownership.
      </p>

      <h2>The Research Visibility Metric (RVM)</h2>
      <p>
        The RVM is a transparent, explainable framework for describing how discoverable a
        researcher&rsquo;s work is. It is a prototype pending empirical validation, is always shown
        with its inputs, and is kept distinct from identity confidence. It is not a measure of
        research quality or impact.
      </p>

      <h2>Our principles</h2>
      <ul>
        <li>Provenance on everything — no fabricated data.</li>
        <li>Identity is never asserted as &ldquo;you&rdquo; until verified.</li>
        <li>Only legitimate scholarly sources, reviewed for terms before integration.</li>
        <li>Transparency over black boxes — recommendations always explain themselves.</li>
      </ul>

      <p>
        Explore <Link href="/discover">discovery</Link>, browse{' '}
        <Link href="/researchers">researchers</Link>, or read our{' '}
        <Link href="/terms">terms</Link> and <Link href="/privacy">privacy policy</Link>.
      </p>
    </ContentPage>
  );
}
