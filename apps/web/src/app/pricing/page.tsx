import type { Metadata } from 'next';
import Link from 'next/link';
import { Card, Button, Badge } from '@researchtrics/ui';

const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

export const metadata: Metadata = {
  title: 'Pricing',
  description:
    'ResearchTrics is free to make your research visible. Premium adds more AI, web-browsing drafts, deep analytics, and impact reports.',
  alternates: { canonical: `${appUrl}/pricing` },
};

const FREE = [
  'Public researcher profile & publications',
  'Discovery, following, saving & feed',
  'Google / Scholar indexing (sitemaps, structured data)',
  'Opportunity matching & alerts',
  '15 AI Assistant generations / month',
];

const PREMIUM = [
  'Everything in Free, plus:',
  '500 AI Assistant generations / month',
  'AI web browsing — drafts with real, cited sources',
  'Deep analytics — reader geography, trends & RVM history',
  'Downloadable impact reports (tenure / promotion / grants)',
  'Priority opportunity matching',
];

export default function PricingPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <h1 className="text-3xl font-semibold text-rt-text">Simple, fair pricing</h1>
      <p className="mt-2 max-w-2xl text-rt-muted">
        Making your research visible is <strong>always free</strong> — that&rsquo;s the whole point.
        Premium adds depth: more AI, web-browsing drafts, deeper analytics, and reports.
      </p>

      <div className="mt-8 grid gap-6 sm:grid-cols-2">
        <Card className="p-6">
          <h2 className="text-lg font-semibold text-rt-text">Free</h2>
          <p className="mt-1 text-3xl font-semibold text-rt-text">$0</p>
          <p className="text-sm text-rt-muted">Everything you need to be found.</p>
          <ul className="mt-4 space-y-2 text-sm text-rt-text">
            {FREE.map((f) => (
              <li key={f} className="flex gap-2"><span className="text-rt-success">✓</span> {f}</li>
            ))}
          </ul>
          <Button asChild variant="secondary" size="sm" className="mt-6">
            <Link href="/register">Create your profile</Link>
          </Button>
        </Card>

        <Card className="border-rt-gold p-6">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-rt-text">Premium</h2>
            <Badge variant="gold">Best for active authors</Badge>
          </div>
          <p className="mt-1 text-3xl font-semibold text-rt-text">Coming soon</p>
          <p className="text-sm text-rt-muted">Depth for researchers who publish often.</p>
          <ul className="mt-4 space-y-2 text-sm text-rt-text">
            {PREMIUM.map((f) => (
              <li key={f} className="flex gap-2"><span className="text-rt-gold">★</span> {f}</li>
            ))}
          </ul>
          <Button asChild size="sm" className="mt-6">
            <Link href="/contact">Register interest</Link>
          </Button>
        </Card>
      </div>

      <p className="mt-8 text-sm text-rt-muted">
        For universities and research offices, an <strong>institutional plan</strong> with
        aggregate analytics and reporting is in the works —{' '}
        <Link href="/contact" className="text-rt-blue hover:underline">get in touch</Link>.
      </p>
    </div>
  );
}
