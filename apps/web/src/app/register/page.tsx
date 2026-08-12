import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Card } from '@researchtrics/ui';
import { AuthForm } from '@/components/auth-form';
import { getCurrentUser } from '@/lib/current-user';

export const metadata: Metadata = {
  title: 'Create your research profile',
  robots: { index: false, follow: false },
};

export default async function RegisterPage() {
  if (await getCurrentUser()) redirect('/dashboard');

  return (
    <div className="mx-auto flex max-w-md flex-col gap-6 px-4 py-16">
      <div>
        <h1 className="text-2xl font-semibold text-rt-text">Create your research profile</h1>
        <p className="mt-2 text-sm text-rt-muted">
          Join ResearchTrics and connect your scholarly identity.
        </p>
      </div>
      <Card className="p-6">
        <AuthForm mode="register" />
      </Card>
      <p className="text-center text-sm text-rt-muted">
        Already have an account?{' '}
        <Link href="/login" className="font-medium text-rt-blue hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
