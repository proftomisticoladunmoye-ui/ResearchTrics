import type { ReactNode } from 'react';

/** Shared layout for static content pages (about, legal, docs). */
export function ContentPage({
  title,
  intro,
  updated,
  children,
}: {
  title: string;
  intro?: string;
  updated?: string;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="text-3xl font-semibold tracking-tight text-rt-text">{title}</h1>
      {intro ? <p className="mt-3 text-lg text-rt-muted">{intro}</p> : null}
      {updated ? <p className="mt-2 text-xs text-rt-muted">Last updated: {updated}</p> : null}
      <div className="mt-8 space-y-6 text-sm leading-relaxed text-rt-text [&_a]:text-rt-blue [&_a:hover]:underline [&_h2]:mt-8 [&_h2]:text-lg [&_h2]:font-semibold [&_p]:text-rt-muted [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:text-rt-muted [&_li]:mt-1">
        {children}
      </div>
    </div>
  );
}
