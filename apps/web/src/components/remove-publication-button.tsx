'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Remove a publication from the researcher's profile. Confirms first; the server
 * decides whether to fully delete (sole author) or just detach the authorship
 * (shared work).
 */
export function RemovePublicationButton({ slug, title }: { slug: string; title: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function remove() {
    if (!confirm(`Remove "${title}" from your publications? If you are the only author on ResearchTrics, the record is deleted.`)) {
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/v1/publications/${slug}`, { method: 'DELETE' });
      if (res.ok) router.refresh();
      else alert('Could not remove this publication.');
    } catch {
      alert('Network error. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={remove}
      disabled={busy}
      className="text-sm font-medium text-rt-error hover:underline disabled:opacity-60"
    >
      {busy ? 'Removing…' : 'Remove'}
    </button>
  );
}
