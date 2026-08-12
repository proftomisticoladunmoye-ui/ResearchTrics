import type { Metadata } from 'next';
import './globals.css';
import { SiteHeader } from '@/components/site-header';
import { SiteFooter } from '@/components/site-footer';

const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: {
    default: 'ResearchTrics — Make Research Visible',
    template: '%s · ResearchTrics',
  },
  description:
    'ResearchTrics is a global research visibility platform: researcher identity, scholarly outputs, discovery, collaboration, and the Research Visibility Metric (RVM).',
  applicationName: 'ResearchTrics',
  openGraph: {
    type: 'website',
    siteName: 'ResearchTrics',
    title: 'ResearchTrics — Make Research Visible',
    description: 'Make Research Visible. Discoverable. Connected. Measurable.',
    url: appUrl,
    images: [{ url: '/logo.png', width: 512, height: 512, alt: 'ResearchTrics' }],
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-rt-blue focus:px-3 focus:py-2 focus:text-rt-white"
        >
          Skip to content
        </a>
        <SiteHeader />
        <main id="main">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
