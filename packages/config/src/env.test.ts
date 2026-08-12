import { describe, it, expect, beforeEach } from 'vitest';
import { loadServerEnv, resetServerEnvCache } from './env';
import { cssVariablesBlock } from './tokens';

const validEnv = {
  NODE_ENV: 'test',
  DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
  REDIS_URL: 'redis://localhost:6379',
  SESSION_SECRET: 'x'.repeat(32),
  TOKEN_ENCRYPTION_KEY: 'y'.repeat(44),
} as unknown as NodeJS.ProcessEnv;

describe('loadServerEnv', () => {
  beforeEach(() => resetServerEnvCache());

  it('parses a valid environment', () => {
    const env = loadServerEnv(validEnv);
    expect(env.DATABASE_URL).toContain('postgresql://');
    expect(env.NEXT_PUBLIC_APP_URL).toBe('http://localhost:3000');
  });

  it('throws with readable message when SESSION_SECRET is too short', () => {
    resetServerEnvCache();
    expect(() =>
      loadServerEnv({ ...validEnv, SESSION_SECRET: 'short' } as NodeJS.ProcessEnv),
    ).toThrow(/SESSION_SECRET/);
  });
});

describe('brand tokens', () => {
  it('emits the --rt-* CSS variable contract', () => {
    const block = cssVariablesBlock();
    expect(block).toContain('--rt-blue: #0B3A82;');
    expect(block).toContain('--rt-gold: #C9A227;');
  });
});
