import { describe, it, expect } from 'vitest';
import {
  buildIdentityReport,
  mayAutoAssociate,
  generateClaimToken,
  hashClaimToken,
  verifyClaimToken,
  isTokenExpired,
  FixtureDiscoveryProvider,
} from './index';

describe('buildIdentityReport (explainable, distinct from RVM — §9/§26)', () => {
  it('scores an ORCID + institution match as very high, with reasons', () => {
    const r = buildIdentityReport({
      orcidExact: true,
      institutionMatch: true,
      coauthorOverlap: 20,
      topicSimilarity: 1,
      affiliationMatch: true,
      nameSimilarity: 1,
    });
    expect(r.confidence).toBe(100);
    expect(r.tier).toBe('very_high');
    expect(r.reasons).toContain('ORCID iD matches');
    expect(r.reasons.some((x) => x.includes('co-author'))).toBe(true);
  });

  it('name similarity alone never reaches an auto-associable score', () => {
    const r = buildIdentityReport({ nameSimilarity: 1 });
    expect(r.confidence).toBeLessThan(50);
    expect(r.tier).toBe('do_not_associate');
    expect(mayAutoAssociate(r)).toBe(false);
  });

  it('refuses auto-association on name evidence alone even if weighted high', () => {
    // Even a contrived high name weight must not auto-associate on name only.
    const r = buildIdentityReport({ nameSimilarity: 1 }, {
      orcidExact: 0,
      institution: 0,
      coauthor: 0,
      topic: 0,
      affiliation: 0,
      name: 100,
    });
    expect(r.confidence).toBe(100);
    expect(mayAutoAssociate(r)).toBe(false); // only-name guard
  });

  it('maps score bands to the documented tiers (§10)', () => {
    expect(buildIdentityReport({ orcidExact: true }).tier).toBe('review'); // 50
    const moderate = buildIdentityReport({
      orcidExact: true,
      institutionMatch: true,
      affiliationMatch: true,
    });
    expect(moderate.confidence).toBe(75); // 50 + 15 + 10
    expect(moderate.tier).toBe('moderate');
    const high = buildIdentityReport({
      orcidExact: true,
      institutionMatch: true,
      affiliationMatch: true,
      topicSimilarity: 1,
      coauthorOverlap: 5,
    });
    expect(high.confidence).toBe(95); // 50 + 15 + 10 + 10 + 10
    expect(high.tier).toBe('very_high');
  });

  it('exposes per-factor points that never exceed their max', () => {
    const r = buildIdentityReport({ coauthorOverlap: 1000, topicSimilarity: 5 });
    for (const f of r.factors) expect(f.points).toBeLessThanOrEqual(f.max);
  });
});

describe('claim tokens (§32)', () => {
  it('never exposes the raw token in its hash and verifies round-trip', () => {
    const t = generateClaimToken();
    expect(t.tokenHash).not.toContain(t.token);
    expect(t.tokenHash).toBe(hashClaimToken(t.token));
    expect(verifyClaimToken(t.token, t.tokenHash)).toBe(true);
  });

  it('rejects a wrong token in constant time', () => {
    const t = generateClaimToken();
    expect(verifyClaimToken('not-the-token', t.tokenHash)).toBe(false);
  });

  it('produces unique tokens', () => {
    expect(generateClaimToken().token).not.toBe(generateClaimToken().token);
  });

  it('detects expiry', () => {
    expect(isTokenExpired(new Date(Date.now() - 1000))).toBe(true);
    expect(isTokenExpired(new Date(Date.now() + 60_000))).toBe(false);
  });
});

describe('FixtureDiscoveryProvider (offline, §67)', () => {
  it('is not an external provider', () => {
    expect(new FixtureDiscoveryProvider().external).toBe(false);
  });

  it('filters by institution and topic', async () => {
    const p = new FixtureDiscoveryProvider();
    const byInst = await p.discover({ institution: 'University X' });
    expect(byInst).toHaveLength(1);
    expect(byInst[0]!.fullName).toBe('Jane A. Smith');

    const byTopic = await p.discover({ topic: 'open science' });
    expect(byTopic[0]!.fullName).toBe('Ravi Kumar');
  });

  it('every candidate carries provenance', async () => {
    const all = await new FixtureDiscoveryProvider().discover({});
    expect(all.length).toBeGreaterThan(0);
    expect(all.every((c) => !!c.provenance.source && !!c.provenance.retrievedAt)).toBe(true);
  });
});
