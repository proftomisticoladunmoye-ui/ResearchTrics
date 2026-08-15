import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Card, Badge } from '@researchtrics/ui';
import { listFilesByUploader } from '@researchtrics/core';
import { getCurrentUser } from '@/lib/current-user';
import { FileUpload } from '@/components/file-upload';

export const metadata: Metadata = {
  title: 'Files',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

const ACCESS_BADGE: Record<string, 'success' | 'neutral' | 'warning'> = {
  public: 'success',
  restricted: 'neutral',
  request: 'neutral',
  embargoed: 'warning',
  private: 'warning',
};

export default async function DashboardFilesPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const files = await listFilesByUploader(user.id);

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-2xl font-semibold text-rt-text">Files</h1>
      <p className="mt-1 text-sm text-rt-muted">
        Upload manuscripts, datasets, or supporting files. Files are stored in object storage and
        served with access control — the bytes never live in the database.
      </p>

      <Card className="mt-6 p-6">
        <h2 className="text-base font-semibold text-rt-text">Upload a file</h2>
        <div className="mt-4">
          <FileUpload />
        </div>
      </Card>

      <Card className="mt-6 p-6">
        <h2 className="text-base font-semibold text-rt-text">
          Your files <span className="text-rt-muted">({files.length})</span>
        </h2>
        {files.length === 0 ? (
          <p className="mt-3 text-sm text-rt-muted">No files yet.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase text-rt-muted">
                  <th className="py-2">Name</th>
                  <th>Type</th>
                  <th className="text-right">Size</th>
                  <th>Access</th>
                  <th>Uploaded</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {files.map((f) => (
                  <tr key={f.id} className="border-t border-rt-border">
                    <td className="py-2 font-medium text-rt-text">{f.filename}</td>
                    <td className="text-rt-muted">{f.mimeType}</td>
                    <td className="text-right tabular-nums text-rt-muted">{formatBytes(f.sizeBytes)}</td>
                    <td>
                      <Badge variant={ACCESS_BADGE[f.accessLevel] ?? 'neutral'}>{f.accessLevel}</Badge>
                    </td>
                    <td className="text-rt-muted">{f.createdAt.toLocaleDateString('en-GB')}</td>
                    <td>
                      <Link href={f.url} className="text-rt-blue hover:underline" target="_blank">
                        Open
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
