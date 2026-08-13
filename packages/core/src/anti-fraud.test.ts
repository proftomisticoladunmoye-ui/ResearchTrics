import { describe, it, expect } from 'vitest';
import {
  emailDomain,
  isDisposableEmail,
  isFreeWebmail,
  looksInstitutional,
  assess,
  type RiskSignal,
} from './anti-fraud';

describe('email classification (§33)', () => {
  it('extracts the domain', () => {
    expect(emailDomain('Jane.Doe@Uni.EDU')).toBe('uni.edu');
    expect(emailDomain('no-at-sign')).toBe('');
  });

  it('detects disposable providers', () => {
    expect(isDisposableEmail('x@mailinator.com')).toBe(true);
    expect(isDisposableEmail('x@uni.edu')).toBe(false);
  });

  it('detects free webmail', () => {
    expect(isFreeWebmail('x@gmail.com')).toBe(true);
    expect(isFreeWebmail('x@mit.edu')).toBe(false);
  });

  it('treats non-disposable, non-webmail domains as institutional', () => {
    expect(looksInstitutional('a@ox.ac.uk')).toBe(true);
    expect(looksInstitutional('a@gmail.com')).toBe(false);
    expect(looksInstitutional('a@mailinator.com')).toBe(false);
    expect(looksInstitutional('bad-email')).toBe(false);
  });
});

describe('assess (§33)', () => {
  it('is low risk with no signals', () => {
    const a = assess([]);
    expect(a.level).toBe('low');
    expect(a.score).toBe(0);
    expect(a.requiresReview).toBe(false);
  });

  it('escalates to elevated (review) on a mid-weight signal', () => {
    const signals: RiskSignal[] = [{ code: 'rapid_claim_velocity', detail: 'x', weight: 0.5 }];
    const a = assess(signals);
    expect(a.level).toBe('elevated');
    expect(a.requiresReview).toBe(true);
  });

  it('escalates to high when weights accumulate past 0.7', () => {
    const a = assess([
      { code: 'disposable_email', detail: 'x', weight: 0.7 },
      { code: 'contested_profile', detail: 'y', weight: 0.4 },
    ]);
    expect(a.level).toBe('high');
    expect(a.score).toBe(1); // clamped
    expect(a.requiresReview).toBe(true);
  });

  it('a single low-weight webmail signal stays low risk', () => {
    const a = assess([{ code: 'free_webmail', detail: 'x', weight: 0.2 }]);
    expect(a.level).toBe('low');
    expect(a.requiresReview).toBe(false);
  });
});
