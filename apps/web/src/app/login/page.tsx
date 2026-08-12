import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Card } from '@researchtrics/ui';
import { AuthForm } from '@/components/auth-form';
import { getCurrentUser } from '@/lib/current-user';

export const metadata: Metadata = {
  title: 'Sign in',
  robots: { index: false, follow: false },
};

export default async function LoginPage() {
  if (await getCurrentUser()) redirect('/dashboard');

  return (
    <div className="mx-auto flex max-w-md flex-col gap-6 px-4 py-16">
      <div>
        <h1 className="text-2xl font-semibold text-rt-text">Sign in</h1>
        <p className="mt-2 text-sm text-rt-muted">Welcome back to ResearchTrics.</p>
      </div>
      <Card className="p-6">
        <AuthForm mode="login" />
      </Card>
      <p className="text-center text-sm text-rt-muted">
        New to ResearchTrics?{' '}
        <Link href="/register" className="font-medium text-rt-blue hover:underline">
          Create a research profile
        </Link>
      </p>
    </div>
  );
}
