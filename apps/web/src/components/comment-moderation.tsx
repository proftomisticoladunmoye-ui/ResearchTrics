'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@researchtrics/ui';

/** Admin approve/reject/delete actions for one comment. */
export function CommentModerationActions({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function decide(decision: 'approved' | 'rejected') {
    setBusy(true);
    await fetch(`/api/v1/admin/research-bulletin/comments/${id}`, {
      method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ decision }),
    }).catch(() => {});
    setBusy(false);
    router.refresh();
  }

  async function remove() {
    if (!window.confirm('Permanently delete this comment?')) return;
    setBusy(true);
    await fetch(`/api/v1/admin/research-bulletin/comments/${id}`, { method: 'DELETE' }).catch(() => {});
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="flex items-center gap-2">
      {status !== 'approved' ? (
        <Button onClick={() => decide('approved')} size="sm" variant="accent" disabled={busy}>Approve</Button>
      ) : null}
      {status !== 'rejected' ? (
        <Button onClick={() => decide('rejected')} size="sm" variant="ghost" disabled={busy}>Reject</Button>
      ) : null}
      <button type="button" onClick={remove} disabled={busy} className="text-xs text-rt-error hover:underline">Delete</button>
    </div>
  );
}
