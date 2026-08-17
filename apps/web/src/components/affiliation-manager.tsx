'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Input, Field, Badge, Alert } from '@researchtrics/ui';

export interface AffiliationItem {
  id: string;
  institution: string;
  country: string | null;
  role: string;
  isPrimary: boolean;
  verified: boolean;
}

const ROLES: Array<{ value: string; label: string }> = [
  { value: 'faculty', label: 'Faculty' },
  { value: 'postdoc', label: 'Postdoc' },
  { value: 'phd_student', label: 'PhD student' },
  { value: 'masters_student', label: "Master's student" },
  { value: 'research_staff', label: 'Research staff' },
  { value: 'visiting', label: 'Visiting' },
  { value: 'emeritus', label: 'Emeritus' },
  { value: 'other', label: 'Other' },
];

const ROLE_LABEL = Object.fromEntries(ROLES.map((r) => [r.value, r.label]));

/** Dashboard control to add/remove a researcher's institutional affiliations (§7). */
export function AffiliationManager({ affiliations }: { affiliations: AffiliationItem[] }) {
  const router = useRouter();
  const [status, setStatus] = useState<'idle' | 'saving' | 'error'>('idle');
  const [message, setMessage] = useState<string | null>(null);

  async function onAdd(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    const institution = String(fd.get('institution') ?? '').trim();
    if (institution.length < 2) {
      setStatus('error');
      setMessage('Enter your institution name.');
      return;
    }
    setStatus('saving');
    setMessage(null);
    try {
      const res = await fetch('/api/v1/affiliations', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          institution,
          country: fd.get('country') || undefined,
          role: fd.get('role') || undefined,
          isPrimary: fd.get('isPrimary') === 'on',
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
        setStatus('error');
        setMessage(body.error?.message ?? 'Could not add affiliation.');
        return;
      }
      form.reset();
      setStatus('idle');
      router.refresh();
    } catch {
      setStatus('error');
      setMessage('Network error.');
    }
  }

  async function onRemove(id: string) {
    await fetch(`/api/v1/affiliations/${id}`, { method: 'DELETE' }).catch(() => {});
    router.refresh();
  }

  const inputClass = 'w-full rounded border border-rt-border bg-rt-white px-3 py-2 text-sm text-rt-text';

  return (
    <div className="space-y-5">
      {affiliations.length > 0 ? (
        <ul className="space-y-2">
          {affiliations.map((a) => (
            <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 rounded border border-rt-border px-3 py-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium text-rt-text">{a.institution}</span>
                <span className="text-xs text-rt-muted">{ROLE_LABEL[a.role] ?? a.role}</span>
                {a.isPrimary ? <Badge variant="gold">Primary</Badge> : null}
                <Badge variant={a.verified ? 'success' : 'neutral'}>
                  {a.verified ? 'Verified' : 'Unverified'}
                </Badge>
              </div>
              <Button type="button" variant="ghost" size="sm" onClick={() => onRemove(a.id)}>
                Remove
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-rt-muted">No affiliations yet. Add your institution below.</p>
      )}

      <form onSubmit={onAdd} className="space-y-3 border-t border-rt-border pt-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Institution / university" htmlFor="institution">
            <Input id="institution" name="institution" required maxLength={200} placeholder="e.g. Makerere University" />
          </Field>
          <Field label="Country (optional)" htmlFor="country">
            <Input id="country" name="country" maxLength={80} placeholder="e.g. Uganda" />
          </Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Role" htmlFor="role">
            <select id="role" name="role" className={inputClass} defaultValue="faculty">
              {ROLES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </Field>
          <label className="flex items-end gap-2 pb-2 text-sm text-rt-text">
            <input type="checkbox" name="isPrimary" defaultChecked className="h-4 w-4" />
            Set as primary
          </label>
        </div>
        <Button type="submit" disabled={status === 'saving'}>
          {status === 'saving' ? 'Adding…' : 'Add affiliation'}
        </Button>
        <p className="text-xs text-rt-muted">
          Self-declared affiliations show as <strong>Unverified</strong> until confirmed by the institution.
        </p>
        {message ? <Alert variant="error">{message}</Alert> : null}
      </form>
    </div>
  );
}
