import { describe, it, expect } from 'vitest';
import { engagementDigestTemplate, type EngagementDigest } from './email-digest';
import { ResendEmailProvider, emailProviderFromEnv, ConsoleEmailProvider } from './email';

const digest: EngagementDigest = {
  researcherId: 'r1',
  displayName: 'Dr Ada',
  email: 'ada@example.org',
  sinceDays: 7,
  total: 13,
  reads: 10,
  downloads: 2,
  recommends: 1,
  countries: ['Germany', 'Nigeria'],
  topPublications: [{ title: 'On Engines', slug: 'on-engines-1', count: 9 }],
};

describe('engagementDigestTemplate', () => {
  it('summarizes counts + countries with no personal data', () => {
    const t = engagementDigestTemplate(digest, 'https://www.researchtrics.com');
    expect(t.subject).toContain('13');
    expect(t.text).toContain('10 reads');
    expect(t.text).toContain('including from Germany, Nigeria');
    expect(t.text).toContain('On Engines — 9');
    expect(t.html).toContain('<strong>');
    expect(t.html).toContain('/notifications');
    // No IPs or reader identities anywhere.
    expect(t.text).not.toMatch(/\d+\.\d+\.\d+\.\d+/);
  });

  it('escapes HTML in publication titles', () => {
    const t = engagementDigestTemplate(
      { ...digest, topPublications: [{ title: '<script>x</script>', slug: 's', count: 1 }] },
      'https://x',
    );
    expect(t.html).toContain('&lt;script&gt;');
    expect(t.html).not.toContain('<script>x</script>');
  });
});

describe('email provider selection', () => {
  it('defaults to console', () => {
    expect(emailProviderFromEnv({} as NodeJS.ProcessEnv)).toBeInstanceOf(ConsoleEmailProvider);
  });
  it('uses Resend when configured', () => {
    const p = emailProviderFromEnv({ EMAIL_PROVIDER: 'resend', EMAIL_API_KEY: 'k' } as NodeJS.ProcessEnv);
    expect(p).toBeInstanceOf(ResendEmailProvider);
  });
  it('Resend posts to the emails endpoint with a bearer token', async () => {
    let url = '';
    let auth = '';
    const fakeFetch = (async (u: string, init?: RequestInit) => {
      url = u;
      auth = String((init?.headers as Record<string, string>).authorization);
      return { ok: true };
    }) as unknown as typeof fetch;
    await new ResendEmailProvider({ apiKey: 'secret', from: 'a@b.c', fetchImpl: fakeFetch }).send({
      to: 'x@y.z',
      subject: 's',
      html: '<p>h</p>',
      text: 't',
    });
    expect(url).toContain('/emails');
    expect(auth).toBe('Bearer secret');
  });
});
