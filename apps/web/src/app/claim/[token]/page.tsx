import type { Metadata } from 'next';
import Link from 'next/link';
import { resolveInvitation, markInvitationViewed } from '@researchtrics/core';
import { Card, Badge, Button, Alert, Logo } from '@researchtrics/ui';

export const metadata: Metadata = {
  title: 'Claim your research profile',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function ClaimByTokenPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const invitation = await resolveInvitation(token);
  if (invitation && !invitation.expired && !invitation.consumed) {
    await markInvitationViewed(token);
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-16">
      <div className="mb-6">
        <Logo />
      </div>

      {!invitation ? (
        <Alert variant="warning" title="Invitation not found">
          This claim link is invalid. It may have been mistyped.
        </Alert>
      ) : invitation.consumed ? (
        <Alert variant="info" title="Already claimed">
          This profile has already been claimed.{' '}
          <Link href={`/researchers/${invitation.researcher.slug}`} className="text-rt-blue underline">
            View the profile
          </Link>
          .
        </Alert>
      ) : invitation.expired ? (
        <Alert variant="warning" title="Invitation expired">
          This claim link has expired. You can still claim the profile directly from its page.{' '}
          <Link href={`/researchers/${invitation.researcher.slug}`} className="text-rt-blue underline">
            Open profile
          </Link>
          .
        </Alert>
      ) : (
        <Card className="p-6">
          <Badge variant="gold">Unclaimed profile</Badge>
          <p className="mt-3 text-sm text-rt-muted">
            We found a scholarly profile in public research metadata that may belong to you.
          </p>
          <h1 className="mt-2 text-2xl font-semibold text-rt-text">
            {invitation.researcher.displayName}
          </h1>

          <div className="mt-6 flex flex-wrap gap-3">
            <Button asChild>
              <Link href={`/researchers/${invitation.researcher.slug}/claim`}>Claim my profile</Link>
            </Button>
            <Button asChild variant="ghost">
              <Link href={`/researchers/${invitation.researcher.slug}/claim?not_me=1`}>
                This isn&rsquo;t me
              </Link>
            </Button>
          </div>
          <p className="mt-4 text-xs text-rt-muted">
            Your scholarly research already exists. ResearchTrics helps you bring it together,
            verify it, and make it more discoverable — it never claims to know this is you until you
            verify ownership.
          </p>
        </Card>
      )}
    </div>
  );
}
