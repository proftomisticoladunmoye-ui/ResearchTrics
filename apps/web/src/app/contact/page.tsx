import type { Metadata } from 'next';
import { ContentPage } from '@/components/content-page';

export const metadata: Metadata = {
  title: 'Contact',
  description: 'Get in touch with the ResearchTrics team.',
  alternates: { canonical: '/contact' },
};

const CONTACT_EMAIL = 'contact@researchtrics.com';

export default function ContactPage() {
  return (
    <ContentPage title="Contact" intro="We&rsquo;d like to hear from you.">
      <h2>General enquiries</h2>
      <p>
        Email us at{' '}
        <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> and we&rsquo;ll get back to you.
      </p>

      <h2>Claim, correct, or remove a profile</h2>
      <p>
        If a discovered profile is about you, you can claim it from the profile page. To request a
        correction or removal, email us with the profile link and we&rsquo;ll help.
      </p>

      <h2>Report a problem</h2>
      <p>
        For copyright concerns see our copyright policy; for anything else — a bug, a data-quality
        issue, or a security report — email us with as much detail as you can.
      </p>

      <p className="text-xs">
        Set up the {CONTACT_EMAIL} inbox (or change this address) once your mail is configured.
      </p>
    </ContentPage>
  );
}
