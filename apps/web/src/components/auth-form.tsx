'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Input, Field, Alert } from '@researchtrics/ui';

type Mode = 'login' | 'register';

interface ProblemBody {
  error?: { message?: string };
}

export function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const form = new FormData(e.currentTarget);
    const payload =
      mode === 'register'
        ? {
            displayName: String(form.get('displayName') ?? ''),
            email: String(form.get('email') ?? ''),
            password: String(form.get('password') ?? ''),
          }
        : {
            email: String(form.get('email') ?? ''),
            password: String(form.get('password') ?? ''),
          };

    try {
      const res = await fetch(`/api/v1/auth/${mode}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as ProblemBody;
        setError(body.error?.message ?? 'Something went wrong. Please try again.');
        return;
      }
      router.push('/dashboard');
      router.refresh();
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      {error ? <Alert variant="error">{error}</Alert> : null}

      {mode === 'register' ? (
        <Field label="Display name" htmlFor="displayName">
          <Input id="displayName" name="displayName" autoComplete="name" required minLength={2} />
        </Field>
      ) : null}

      <Field label="Email" htmlFor="email">
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </Field>

      <Field label="Password" htmlFor="password">
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
          required
          minLength={mode === 'register' ? 10 : undefined}
        />
      </Field>

      {mode === 'register' ? (
        <p className="text-xs text-rt-muted">
          Use at least 10 characters. You will receive a persistent ResearchTrics ID.
        </p>
      ) : null}

      <Button type="submit" disabled={loading} className="mt-2">
        {loading
          ? 'Please wait…'
          : mode === 'register'
            ? 'Create research profile'
            : 'Sign in'}
      </Button>
    </form>
  );
}
