import { describe, it, expect } from 'vitest';
import { isBotUserAgent, visitorHash, referrerHost } from './analytics';

describe('isBotUserAgent', () => {
  it('flags known bots and empty UAs', () => {
    expect(isBotUserAgent('Googlebot/2.1 (+http://www.google.com/bot.html)')).toBe(true);
    expect(isBotUserAgent('Mozilla/5.0 (compatible; bingbot/2.0)')).toBe(true);
    expect(isBotUserAgent('curl/8.1.2')).toBe(true);
    expect(isBotUserAgent('')).toBe(true);
    expect(isBotUserAgent(undefined)).toBe(true);
  });

  it('treats real browsers as human', () => {
    expect(
      isBotUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36'),
    ).toBe(false);
  });
});

describe('visitorHash', () => {
  it('is deterministic within a day and rotates across days', () => {
    const a = visitorHash('1.2.3.4', 'ua', '2026-08-12');
    const b = visitorHash('1.2.3.4', 'ua', '2026-08-12');
    const c = visitorHash('1.2.3.4', 'ua', '2026-08-13');
    expect(a).toBe(b);
    expect(a).not.toBe(c);
    expect(a).toHaveLength(64);
    expect(a).not.toContain('1.2.3.4'); // never reveals the IP
  });
});

describe('referrerHost', () => {
  it('extracts host or null', () => {
    expect(referrerHost('https://scholar.google.com/x?y=1')).toBe('scholar.google.com');
    expect(referrerHost('not a url')).toBeNull();
    expect(referrerHost(null)).toBeNull();
  });
});
