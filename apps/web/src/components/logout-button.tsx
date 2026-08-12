'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@researchtrics/ui';

export function LogoutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function onLogout() {
    setLoading(true);
    try {
      await fetch('/api/v1/auth/logout', { method: 'POST' });
      router.push('/');
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button variant="secondary" size="sm" onClick={onLogout} disabled={loading}>
      {loading ? 'Signing out…' : 'Sign out'}
    </Button>
  );
}
