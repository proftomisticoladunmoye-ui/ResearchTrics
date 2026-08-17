import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getResearcherByUserId } from '@researchtrics/core';
import { Card, Alert, Button, Badge, OrcidBadge, VerificationBadge } from '@researchtrics/ui';
import { getCurrentUser } from '@/lib/current-user';
import { ProfileEditForm } from '@/components/profile-edit-form';
import { PhotoUpload } from '@/components/photo-upload';
import { AffiliationManager } from '@/components/affiliation-manager';

export const metadata: Metadata = {
  title: 'Edit profile',
  robots: { index: false, follow: false },
};

const ORCID_MESSAGES: Record<string, { variant: 'success' | 'error' | 'warning'; text: string }> = {
  connected: { variant: 'success', text: 'ORCID connected. Your profile is now ORCID-verified (Level 3).' },
  denied: { variant: 'warning', text: 'ORCID authorization was cancelled.' },
  invalid_state: { variant: 'error', text: 'ORCID sign-in could not be verified. Please try again.' },
  error: { variant: 'error', text: 'Something went wrong connecting ORCID. Please try again.' },
  unconfigured: { variant: 'warning', text: 'ORCID integration is not configured on this server yet.' },
};

export default async function DashboardProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ orcid?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const researcher = await getResearcherByUserId(user.id);
  if (!researcher) redirect('/dashboard');

  const { orcid } = await searchParams;
  const orcidMsg = orcid ? ORCID_MESSAGES[orcid] : undefined;
  const connectedOrcid =
    researcher.orcidConnection?.orcid ??
    researcher.identifiers.find((i) => i.scheme === 'orcid')?.value;

  const initial = {
    displayName: researcher.displayName,
    givenNames: researcher.givenNames ?? '',
    familyName: researcher.familyName ?? '',
    preferredName: researcher.preferredName ?? '',
    academicRank: researcher.academicRank ?? '',
    country: researcher.country ?? '',
    city: researcher.city ?? '',
    website: researcher.website ?? '',
    biography: researcher.biography ?? '',
    profileVisibility: researcher.profileVisibility,
    interests: researcher.interests.map((i) => i.label).join(', '),
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-rt-text">Edit profile</h1>
        <div className="flex items-center gap-2">
          <VerificationBadge level={researcher.verificationLevel} />
          <Button asChild variant="ghost" size="sm">
            <Link href={`/researchers/${researcher.slug}`}>View public profile</Link>
          </Button>
        </div>
      </div>

      {orcidMsg ? (
        <div className="mt-4">
          <Alert variant={orcidMsg.variant}>{orcidMsg.text}</Alert>
        </div>
      ) : null}

      {/* Scholarly identity connections (Spec §7, §13) */}
      <Card className="mt-6 p-5">
        <h2 className="text-base font-semibold text-rt-text">Scholarly identity</h2>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <Badge variant="gold" className="font-mono">
            {researcher.researchtricsId}
          </Badge>
          {connectedOrcid ? (
            <OrcidBadge orcid={connectedOrcid} />
          ) : (
            <Button asChild size="sm" variant="secondary">
              <a href="/api/v1/integrations/orcid/connect">Connect ORCID</a>
            </Button>
          )}
        </div>
      </Card>

      <Card className="mt-6 p-5">
        <h2 className="text-base font-semibold text-rt-text">Profile photo</h2>
        <div className="mt-4">
          <PhotoUpload name={researcher.displayName} currentUrl={researcher.photoUrl} />
        </div>
      </Card>

      <Card className="mt-6 p-5">
        <h2 className="text-base font-semibold text-rt-text">Affiliations</h2>
        <p className="mt-1 text-xs text-rt-muted">
          Your university or research institution. This appears on your public profile.
        </p>
        <div className="mt-4">
          <AffiliationManager
            affiliations={researcher.affiliations.map((a) => ({
              id: a.id,
              institution: a.institution.name,
              country: a.institution.country,
              role: a.role,
              isPrimary: a.isPrimary,
              verified: a.verified,
            }))}
          />
        </div>
      </Card>

      <Card className="mt-6 p-6">
        <ProfileEditForm initial={initial} />
      </Card>
    </div>
  );
}
