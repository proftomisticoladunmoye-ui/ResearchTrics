import type { Metadata } from 'next';
import { requireAdmin } from '@/lib/admin';
import { BulletinEditor } from '@/components/bulletin-editor';

export const metadata: Metadata = { title: 'New bulletin — Admin', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

export default async function NewBulletinPage() {
  await requireAdmin();
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-2xl font-semibold text-rt-text">New Research Bulletin</h1>
      <p className="mt-1 text-sm text-rt-muted">Save a draft, then publish when the readiness checks pass.</p>
      <div className="mt-6">
        <BulletinEditor />
      </div>
    </div>
  );
}
