import { describe, it, expect } from 'vitest';
import { entitlementsFor, currentPeriod } from './plans';

describe('entitlementsFor', () => {
  it('free is limited: capped AI, no web/analytics/reports', () => {
    const e = entitlementsFor('free');
    expect(e.plan).toBe('free');
    expect(e.aiMonthlyLimit).toBe(15);
    expect(e.webBrowsing).toBe(false);
    expect(e.deepAnalytics).toBe(false);
    expect(e.reports).toBe(false);
  });

  it('premium unlocks web browsing, deep analytics, reports, and a higher AI limit', () => {
    const e = entitlementsFor('premium');
    expect(e.plan).toBe('premium');
    expect(e.aiMonthlyLimit).toBeGreaterThan(15);
    expect(e.webBrowsing).toBe(true);
    expect(e.deepAnalytics).toBe(true);
    expect(e.reports).toBe(true);
  });

  it('admins get premium entitlements regardless of plan', () => {
    expect(entitlementsFor('free', { admin: true }).webBrowsing).toBe(true);
  });
});

describe('currentPeriod', () => {
  it('formats YYYY-MM in UTC', () => {
    expect(currentPeriod(new Date('2026-03-05T12:00:00Z'))).toBe('2026-03');
    expect(currentPeriod(new Date('2026-12-31T23:59:59Z'))).toBe('2026-12');
  });
});
