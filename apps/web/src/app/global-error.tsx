'use client';

import { useEffect } from 'react';

/**
 * Last-resort boundary for errors thrown in the root layout itself (where the
 * normal error.tsx can't render). It replaces the whole document, so it ships
 * its own <html>/<body> and uses inline styles — the stylesheet may not have
 * loaded if the layout failed.
 */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('[global error boundary]', { message: error.message, digest: error.digest, stack: error.stack });
  }, [error]);

  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: 'system-ui, sans-serif', background: '#f7f9fc', color: '#172033' }}>
        <div style={{ maxWidth: 640, margin: '0 auto', padding: '96px 16px', textAlign: 'center' }}>
          <h1 style={{ fontSize: 28, fontWeight: 600, margin: 0 }}>Something went wrong</h1>
          <p style={{ color: '#5e6878', marginTop: 12 }}>
            ResearchTrics hit an unexpected error. Please try again in a moment.
          </p>
          <button
            onClick={() => reset()}
            style={{
              marginTop: 24,
              background: '#0b3a82',
              color: '#fff',
              border: 0,
              borderRadius: 8,
              padding: '10px 18px',
              fontSize: 14,
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
