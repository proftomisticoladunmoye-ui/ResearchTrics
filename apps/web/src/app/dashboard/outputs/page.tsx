import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Card } from '@researchtrics/ui';
import { getCurrentUser } from '@/lib/current-user';
import { OutputCreateForm, type OutputField } from '@/components/output-create-form';

export const metadata: Metadata = {
  title: 'Add research output',
  robots: { index: false, follow: false },
};

const PROJECT_FIELDS: OutputField[] = [
  { name: 'title', label: 'Title', required: true },
  { name: 'description', label: 'Description', type: 'textarea' },
  { name: 'objectives', label: 'Objectives', type: 'textarea' },
  { name: 'researchQuestions', label: 'Research questions', type: 'textarea' },
  { name: 'methodology', label: 'Methodology', type: 'textarea' },
  {
    name: 'status',
    label: 'Status',
    type: 'select',
    options: [
      { value: 'active', label: 'Active' },
      { value: 'proposed', label: 'Proposed' },
      { value: 'completed', label: 'Completed' },
      { value: 'suspended', label: 'Suspended' },
      { value: 'archived', label: 'Archived' },
    ],
  },
];

const DATASET_FIELDS: OutputField[] = [
  { name: 'title', label: 'Title', required: true },
  { name: 'description', label: 'Description', type: 'textarea' },
  { name: 'sample', label: 'Sample' },
  { name: 'geography', label: 'Geography' },
  { name: 'methodology', label: 'Methodology', type: 'textarea' },
  { name: 'fileFormats', label: 'File formats', placeholder: 'CSV, SPSS' },
  {
    name: 'accessLevel',
    label: 'Access level',
    type: 'select',
    options: [
      { value: 'open', label: 'Open' },
      { value: 'restricted', label: 'Restricted' },
      { value: 'request', label: 'Request access' },
      { value: 'embargoed', label: 'Embargoed' },
      { value: 'private', label: 'Private' },
    ],
  },
  { name: 'licenseCode', label: 'License', placeholder: 'CC-BY' },
  { name: 'doi', label: 'DOI' },
];

const INSTRUMENT_FIELDS: OutputField[] = [
  { name: 'title', label: 'Title', required: true },
  { name: 'construct', label: 'Construct measured' },
  { name: 'population', label: 'Population' },
  { name: 'language', label: 'Language' },
  { name: 'itemCount', label: 'Number of items', type: 'number' },
  { name: 'responseScale', label: 'Response scale' },
  { name: 'scoringMethod', label: 'Scoring method', type: 'textarea' },
  { name: 'reliability', label: 'Reliability' },
  { name: 'validityEvidence', label: 'Validity evidence', type: 'textarea' },
  { name: 'licenseCode', label: 'License' },
];

const SOFTWARE_FIELDS: OutputField[] = [
  { name: 'name', label: 'Name', required: true },
  { name: 'description', label: 'Description', type: 'textarea' },
  { name: 'version', label: 'Version' },
  { name: 'repositoryUrl', label: 'Repository URL', placeholder: 'https://github.com/…' },
  { name: 'documentationUrl', label: 'Documentation URL' },
  { name: 'licenseCode', label: 'License' },
  { name: 'doi', label: 'DOI' },
];

export default async function AddOutputPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (!user.researcher) redirect('/dashboard');

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-2xl font-semibold text-rt-text">Add a research output</h1>
      <p className="mt-1 text-sm text-rt-muted">
        Register a project, dataset, instrument, or software package. Everything you add connects to
        your profile and becomes discoverable.
      </p>

      <div className="mt-8 space-y-8">
        <Card className="p-6">
          <h2 className="text-base font-semibold text-rt-text">New project</h2>
          <div className="mt-4">
            <OutputCreateForm endpoint="/api/v1/projects" basePath="/projects" fields={PROJECT_FIELDS} submitLabel="Create project" />
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="text-base font-semibold text-rt-text">New dataset</h2>
          <div className="mt-4">
            <OutputCreateForm endpoint="/api/v1/datasets" basePath="/datasets" fields={DATASET_FIELDS} submitLabel="Create dataset" />
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="text-base font-semibold text-rt-text">New instrument</h2>
          <div className="mt-4">
            <OutputCreateForm endpoint="/api/v1/instruments" basePath="/instruments" fields={INSTRUMENT_FIELDS} submitLabel="Create instrument" />
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="text-base font-semibold text-rt-text">Register software</h2>
          <div className="mt-4">
            <OutputCreateForm endpoint="/api/v1/software" basePath="/software" fields={SOFTWARE_FIELDS} submitLabel="Register software" />
          </div>
        </Card>
      </div>
    </div>
  );
}
