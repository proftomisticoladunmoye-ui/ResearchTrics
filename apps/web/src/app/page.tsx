import type { Metadata } from 'next';
import Link from 'next/link';
import { Button, Card, Badge } from '@researchtrics/ui';
import { NetworkHero } from '@/components/network-hero';

const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

export const metadata: Metadata = {
  // Canonical to the homepage on the primary domain — prevents the Render
  // *.onrender.com mirror from being indexed as duplicate content.
  alternates: { canonical: '/' },
};

// Organization + WebSite structured data (schema.org). The WebSite SearchAction
// makes the site eligible for a Google sitelinks search box.
const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization',
      name: 'ResearchTrics',
      url: appUrl,
      logo: `${appUrl}/logo.png`,
      description:
        'A global research visibility platform: researcher identity, scholarly outputs, discovery, collaboration, and the Research Visibility Metric (RVM).',
    },
    {
      '@type': 'WebSite',
      name: 'ResearchTrics',
      url: appUrl,
      potentialAction: {
        '@type': 'SearchAction',
        target: { '@type': 'EntryPoint', urlTemplate: `${appUrl}/discover?q={search_term_string}` },
        'query-input': 'required name=search_term_string',
      },
    },
  ],
};

const CAPABILITIES = [
  {
    title: 'Researcher identity',
    body: 'A persistent ResearchTrics ID connects every scholarly identifier — ORCID, OpenAlex, Scopus — into one authoritative profile.',
  },
  {
    title: 'Research visibility',
    body: 'Make outputs discoverable with complete, standards-based scholarly metadata and public, crawlable landing pages.',
  },
  {
    title: 'Research discovery',
    body: 'Search across researchers, publications, institutions, datasets, and instruments with scholarly filters.',
  },
  {
    title: 'Research collaboration',
    body: 'Find complementary collaborators with recommendations that always explain why.',
  },
  {
    title: 'Institutional intelligence',
    body: 'Understand research output, collaboration, and visibility across departments and groups.',
  },
  {
    title: 'Scholarly integrations',
    body: 'ORCID, Crossref, OpenAlex, and OJS interoperate through a provenance-first data model.',
  },
];

const RVM_DIMENSIONS = [
  'Discoverability',
  'Accessibility',
  'Engagement',
  'Citation Influence',
  'Collaboration',
  'Open Science',
  'Knowledge Translation',
  'International Reach',
  'Digital Presence',
];

export default function HomePage() {
  return (
    <div>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      {/* Hero */}
      <section className="border-b border-rt-border bg-gradient-to-b from-rt-blue-light to-rt-white">
        <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 py-20 md:grid-cols-2">
          <div>
            <Badge variant="gold">Research visibility infrastructure</Badge>
            <h1 className="mt-4 text-4xl font-semibold leading-tight tracking-tight text-rt-text md:text-5xl">
              Make Research Visible.
              <br />
              Discoverable. Connected. Measurable.
            </h1>
            <p className="mt-5 max-w-xl text-lg text-rt-muted">
              ResearchTrics is a global platform for scholarly identity, research outputs, and
              research intelligence — built so no research output ever exists as an isolated PDF.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link href="/register">Create Research Profile</Link>
              </Button>
              <Button asChild size="lg" variant="secondary">
                <Link href="/discover">Discover Research</Link>
              </Button>
            </div>
          </div>
          <div className="flex justify-center">
            <NetworkHero className="h-auto w-full max-w-md" />
          </div>
        </div>
      </section>

      {/* What ResearchTrics does */}
      <section className="mx-auto max-w-7xl px-4 py-20">
        <h2 className="text-2xl font-semibold text-rt-text">What ResearchTrics does</h2>
        <p className="mt-2 max-w-2xl text-rt-muted">
          One connected model of researchers, outputs, projects, datasets, instruments, and
          institutions — with provenance and trust built in.
        </p>
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {CAPABILITIES.map((c) => (
            <Card key={c.title} className="p-6">
              <h3 className="text-base font-semibold text-rt-text">{c.title}</h3>
              <p className="mt-2 text-sm text-rt-muted">{c.body}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* RVM */}
      <section className="border-y border-rt-border bg-rt-white">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-20 md:grid-cols-2">
          <div>
            <Badge variant="gold">RVM</Badge>
            <h2 className="mt-4 text-2xl font-semibold text-rt-text">
              The Research Visibility Metric
            </h2>
            <p className="mt-3 max-w-xl text-rt-muted">
              A transparent, configurable framework across ten dimensions of scholarly visibility.
              Every score shows its inputs, weighting, and confidence — visibility is measured, not
              guessed.
            </p>
            <p className="mt-3 max-w-xl text-sm text-rt-muted">
              RVM is a ResearchTrics proprietary research visibility framework, presented as
              pending empirical validation. It measures visibility — not impact, and not quality.
            </p>
          </div>
          <ul className="flex flex-wrap content-start gap-2">
            {RVM_DIMENSIONS.map((d) => (
              <li key={d}>
                <Badge variant="neutral">{d}</Badge>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Trust / CTA */}
      <section className="mx-auto max-w-7xl px-4 py-20">
        <Card className="flex flex-col items-center gap-4 bg-rt-blue p-10 text-center">
          <h2 className="text-2xl font-semibold text-rt-white">
            Connect your scholarly identity
          </h2>
          <p className="max-w-2xl text-rt-blue-light">
            Improve discoverability, increase research visibility, and measure it — with a platform
            built as long-term research infrastructure.
          </p>
          <Button asChild size="lg" variant="accent">
            <Link href="/register">Create Research Profile</Link>
          </Button>
        </Card>
      </section>
    </div>
  );
}
