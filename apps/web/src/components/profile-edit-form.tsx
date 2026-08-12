'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Input, Field, Alert } from '@researchtrics/ui';

export interface ProfileInitial {
  displayName: string;
  givenNames: string;
  familyName: string;
  preferredName: string;
  academicRank: string;
  country: string;
  city: string;
  website: string;
  biography: string;
  profileVisibility: 'public' | 'researchers' | 'institution' | 'private';
  interests: string;
}

const inputClass =
  'w-full rounded border border-rt-border bg-rt-white px-3 py-2 text-sm text-rt-text placeholder:text-rt-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rt-blue-royal';

export function ProfileEditForm({ initial }: { initial: ProfileInitial }) {
  const router = useRouter();
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [message, setMessage] = useState<string | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus('saving');
    setMessage(null);
    const f = new FormData(e.currentTarget);
    const payload = {
      displayName: String(f.get('displayName') ?? ''),
      givenNames: String(f.get('givenNames') ?? ''),
      familyName: String(f.get('familyName') ?? ''),
      preferredName: String(f.get('preferredName') ?? ''),
      academicRank: String(f.get('academicRank') ?? ''),
      country: String(f.get('country') ?? ''),
      city: String(f.get('city') ?? ''),
      website: String(f.get('website') ?? ''),
      biography: String(f.get('biography') ?? ''),
      profileVisibility: String(f.get('profileVisibility') ?? 'public'),
      interests: String(f.get('interests') ?? '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    };

    try {
      const res = await fetch('/api/v1/researchers/me', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        setStatus('error');
        setMessage('Could not save your profile. Please check the fields and try again.');
        return;
      }
      setStatus('saved');
      setMessage('Profile saved.');
      router.refresh();
    } catch {
      setStatus('error');
      setMessage('Network error. Please try again.');
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5" noValidate>
      {status === 'saved' && message ? <Alert variant="success">{message}</Alert> : null}
      {status === 'error' && message ? <Alert variant="error">{message}</Alert> : null}

      <Field label="Display name" htmlFor="displayName">
        <Input id="displayName" name="displayName" defaultValue={initial.displayName} required />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Given names" htmlFor="givenNames">
          <Input id="givenNames" name="givenNames" defaultValue={initial.givenNames} />
        </Field>
        <Field label="Family name" htmlFor="familyName">
          <Input id="familyName" name="familyName" defaultValue={initial.familyName} />
        </Field>
        <Field label="Preferred name" htmlFor="preferredName">
          <Input id="preferredName" name="preferredName" defaultValue={initial.preferredName} />
        </Field>
        <Field label="Academic rank" htmlFor="academicRank">
          <Input id="academicRank" name="academicRank" defaultValue={initial.academicRank} />
        </Field>
        <Field label="Country" htmlFor="country">
          <Input id="country" name="country" defaultValue={initial.country} />
        </Field>
        <Field label="City" htmlFor="city">
          <Input id="city" name="city" defaultValue={initial.city} />
        </Field>
      </div>

      <Field label="Website" htmlFor="website">
        <Input id="website" name="website" type="url" placeholder="https://…" defaultValue={initial.website} />
      </Field>

      <Field label="Biography" htmlFor="biography">
        <textarea
          id="biography"
          name="biography"
          rows={5}
          className={inputClass}
          defaultValue={initial.biography}
        />
      </Field>

      <Field label="Research interests (comma-separated)" htmlFor="interests">
        <Input id="interests" name="interests" defaultValue={initial.interests} placeholder="psychometrics, measurement invariance" />
      </Field>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="profileVisibility" className="text-sm font-medium text-rt-text">
          Profile visibility
        </label>
        <select
          id="profileVisibility"
          name="profileVisibility"
          defaultValue={initial.profileVisibility}
          className={inputClass}
        >
          <option value="public">Public</option>
          <option value="researchers">Researchers only</option>
          <option value="institution">Institution only</option>
          <option value="private">Private</option>
        </select>
      </div>

      <div>
        <Button type="submit" disabled={status === 'saving'}>
          {status === 'saving' ? 'Saving…' : 'Save profile'}
        </Button>
      </div>
    </form>
  );
}
