import type { Metadata } from 'next';
import Link from 'next/link';
import { ContentPage } from '@/components/content-page';

export const metadata: Metadata = {
  title: 'API',
  description: 'The ResearchTrics HTTP API overview.',
  alternates: { canonical: '/api' },
};

export default function ApiPage() {
  return (
    <ContentPage
      title="API"
      intro="A versioned HTTP API under /api/v1. Responses use a consistent JSON envelope."
    >
      <h2>Conventions</h2>
      <ul>
        <li>Base path: <code>/api/v1</code></li>
        <li>Success: <code>{'{ "data": ... }'}</code>; errors: <code>{'{ "error": { "code", "message" } }'}</code></li>
        <li>Auth uses a secure session cookie; sensitive endpoints are rate-limited.</li>
      </ul>

      <h2>Public endpoints</h2>
      <ul>
        <li><code>GET /api/v1/health</code> — service health.</li>
        <li><code>GET /api/v1/search?q=…</code> — global scholarly search.</li>
        <li><code>GET /api/v1/discovery/researchers</code> — provenance-bearing discovered profiles.</li>
        <li><code>GET /api/v1/files/&lt;key&gt;</code> — access-controlled file serving.</li>
      </ul>

      <p>
        The API is evolving alongside the platform. Try the live search on the{' '}
        <Link href="/discover">discover page</Link>, and see the{' '}
        <Link href="/docs">documentation</Link> for core concepts.
      </p>
    </ContentPage>
  );
}
