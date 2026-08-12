import type { Metadata } from 'next';
import Link from 'next/link';
import { Card, Alert, Button } from '@researchtrics/ui';

export const metadata: Metadata = {
  title: 'Email verification',
  robots: { index: false, follow: false },
};

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const ok = status === 'ok';

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <Card className="p-6">
        {ok ? (
          <Alert variant="success" title="Email verified">
            Your email address is verified. Your profile is now at least Level&nbsp;1 (email
            verified).
          </Alert>
        ) : (
          <Alert variant="error" title="Verification failed">
            This verification link is invalid, expired, or already used. You can request a new one
            from your dashboard.
          </Alert>
        )}
        <div className="mt-4">
          <Button asChild>
            <Link href="/dashboard">Go to dashboard</Link>
          </Button>
        </div>
      </Card>
    </div>
  );
}
