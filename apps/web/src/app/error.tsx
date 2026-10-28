'use client';

import { useEffect } from 'react';
import Link from 'next/link';

/**
 * Route-level error boundary. Catches render/data errors in any page so visitors
 * see a branded recovery screen instead of Next's raw "Application error", and
 * the failure is logged to the server/browser console (captured in Render logs)
 * — lightweight observability until a monitoring service is wired in.
 */
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('[app error boundary]', { message: error.message, digest: error.digest, stack: error.stack });
  }, [error]);

  return (
    <div className="mx-auto max-w-2xl px-4 py-24 text-center">
      <p className="font-mono text-sm font-semibold text-rt-gold">Error</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight text-rt-text">Something went wrong</h1>
      <p className="mt-3 text-rt-muted">
        A temporary problem stopped this page from loading. You can try again, or return to the homepage.
      </p>
      {error.digest ? <p className="mt-2 font-mono text-xs text-rt-muted">Reference: {error.digest}</p> : null}

      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <button
          onClick={() => reset()}
          className="rounded-lg bg-rt-blue px-4 py-2 text-sm font-medium text-white"
        >
          Try again
        </button>
        <Link
          href="/"
          className="rounded-lg border border-rt-border bg-rt-white px-4 py-2 text-sm font-medium text-rt-text hover:bg-rt-blue-light"
        >
          Go home
        </Link>
      </div>
    </div>
  );
}
