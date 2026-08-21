'use client';

import { Button } from '@researchtrics/ui';

/** Print / save the current page as a PDF via the browser's print dialog. */
export function PrintButton({ label = 'Download PDF' }: { label?: string }) {
  return (
    <Button onClick={() => window.print()} size="sm" className="no-print">
      {label}
    </Button>
  );
}
