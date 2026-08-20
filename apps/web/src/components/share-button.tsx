'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@researchtrics/ui';

/** Share a page: copy link + quick links to X, LinkedIn, and email. */
export function ShareButton({ url, title }: { url: string; title: string }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('click', onDocClick);
    return () => document.removeEventListener('click', onDocClick);
  }, []);

  const enc = encodeURIComponent;
  const links = [
    { label: 'Share on X', href: `https://twitter.com/intent/tweet?url=${enc(url)}&text=${enc(title)}` },
    { label: 'Share on LinkedIn', href: `https://www.linkedin.com/sharing/share-offsite/?url=${enc(url)}` },
    { label: 'Email', href: `mailto:?subject=${enc(title)}&body=${enc(url)}` },
  ];

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
    setOpen(false);
  }

  return (
    <div className="relative inline-block" ref={ref}>
      <Button size="sm" variant="secondary" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        {copied ? 'Link copied' : 'Share'}
      </Button>
      {open ? (
        <div className="absolute left-0 top-10 z-50 w-48 rounded-lg border border-rt-border bg-rt-white p-1 shadow-lg">
          <button
            type="button"
            onClick={copy}
            className="block w-full rounded px-3 py-2 text-left text-sm text-rt-text hover:bg-rt-blue-light"
          >
            Copy link
          </button>
          {links.map((l) => (
            <a
              key={l.label}
              href={l.href}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setOpen(false)}
              className="block rounded px-3 py-2 text-sm text-rt-text hover:bg-rt-blue-light"
            >
              {l.label}
            </a>
          ))}
        </div>
      ) : null}
    </div>
  );
}
