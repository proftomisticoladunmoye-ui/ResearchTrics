import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { canPostOpportunity } from '@researchtrics/core';
import { Card } from '@researchtrics/ui';
import { getCurrentUser } from '@/lib/current-user';
import { OutputCreateForm, type OutputField } from '@/components/output-create-form';

export const metadata: Metadata = {
  title: 'Post an opportunity',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

const FIELDS: OutputField[] = [
  { name: 'title', label: 'Title', required: true, placeholder: 'e.g. Early-Career Research Fellowship' },
  {
    name: 'type',
    label: 'Type',
    type: 'select',
    options: [
      { value: 'grant', label: 'Grant' },
      { value: 'fellowship', label: 'Fellowship' },
      { value: 'call_for_papers', label: 'Call for papers' },
      { value: 'conference', label: 'Conference' },
      { value: 'position', label: 'Position' },
      { value: 'award', label: 'Award' },
      { value: 'training', label: 'Training' },
      { value: 'collaboration', label: 'Collaboration' },
      { value: 'other', label: 'Other' },
    ],
  },
  { name: 'organization', label: 'Organization', placeholder: 'Posting body' },
  { name: 'country', label: 'Country', placeholder: 'e.g. United Kingdom' },
  { name: 'deadline', label: 'Application deadline', placeholder: 'YYYY-MM-DD' },
  {
    name: 'disciplines',
    label: 'Disciplines / topics',
    placeholder: 'Comma-separated, e.g. psychometrics, education',
  },
  { name: 'url', label: 'Link to apply / details', placeholder: 'https://…' },
  { name: 'sourceUrl', label: 'Original source URL (provenance)', placeholder: 'https://…' },
  { name: 'summary', label: 'Summary', type: 'textarea', placeholder: 'A short description of the opportunity.' },
];

export default async function NewOpportunityPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  // Only funders, employers, research administrators, and admins may post.
  if (!canPostOpportunity(user.actor)) redirect('/opportunities');

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="text-2xl font-semibold text-rt-text">Post an opportunity</h1>
      <p className="mt-1 text-sm text-rt-muted">
        Listings are public and attributed to you. Always link to the original source so applicants
        can verify the details.
      </p>
      <Card className="mt-6 p-6">
        <OutputCreateForm
          endpoint="/api/v1/opportunities"
          basePath="/opportunities"
          fields={FIELDS}
          submitLabel="Publish opportunity"
        />
      </Card>
    </div>
  );
}
