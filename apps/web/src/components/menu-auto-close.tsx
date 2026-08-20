'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

/**
 * Closes the header's CSS-only <details> menus (hamburger, "+ Add", account)
 * after a menu item is chosen. Native <details> stays open across Next.js
 * client-side navigations, which leaves the dropdown hanging open — this resets
 * it both on the click and on the resulting route change.
 */
function closeHeaderMenus(): void {
  document.querySelectorAll('header details[open]').forEach((d) => d.removeAttribute('open'));
}

export function MenuAutoClose() {
  const pathname = usePathname();

  // Close on the click of any link/button inside a header dropdown (immediate).
  useEffect(() => {
    function onClick(e: MouseEvent) {
      const el = e.target as HTMLElement | null;
      const actionable = el?.closest('a[href], button');
      if (!actionable) return;
      const details = actionable.closest('details[open]');
      if (details && details.closest('header')) details.removeAttribute('open');
    }
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, []);

  // Belt-and-braces: also close whenever the route actually changes.
  useEffect(() => {
    closeHeaderMenus();
  }, [pathname]);

  return null;
}
