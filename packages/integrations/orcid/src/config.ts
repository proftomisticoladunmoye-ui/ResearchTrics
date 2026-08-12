/**
 * ORCID environment configuration (Spec §13, §93).
 *
 * Endpoints follow ORCID's public 3-legged OAuth. They are pinned per
 * environment and MUST be re-verified against the official ORCID documentation
 * (https://info.orcid.org/documentation/) before production use. All values are
 * env-driven so no host is hard-coded into business logic.
 */

export type OrcidEnvironment = 'sandbox' | 'production';

export interface OrcidConfig {
  environment: OrcidEnvironment;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  authorizeUrl: string;
  tokenUrl: string;
  publicApiBase: string;
}

const HOSTS: Record<OrcidEnvironment, { oauth: string; pub: string }> = {
  sandbox: { oauth: 'https://sandbox.orcid.org', pub: 'https://pub.sandbox.orcid.org' },
  production: { oauth: 'https://orcid.org', pub: 'https://pub.orcid.org' },
};

/** Resolve ORCID config from the environment. Throws if required vars are absent. */
export function loadOrcidConfig(source: NodeJS.ProcessEnv = process.env): OrcidConfig {
  const environment: OrcidEnvironment =
    source.ORCID_ENVIRONMENT === 'production' ? 'production' : 'sandbox';
  const clientId = source.ORCID_CLIENT_ID;
  const clientSecret = source.ORCID_CLIENT_SECRET;
  const redirectUri = source.ORCID_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error(
      'ORCID integration is not configured (ORCID_CLIENT_ID, ORCID_CLIENT_SECRET, ORCID_REDIRECT_URI required)',
    );
  }

  const host = HOSTS[environment];
  return {
    environment,
    clientId,
    clientSecret,
    redirectUri,
    authorizeUrl: `${host.oauth}/oauth/authorize`,
    tokenUrl: `${host.oauth}/oauth/token`,
    publicApiBase: `${host.pub}/v3.0`,
  };
}

export function isOrcidConfigured(source: NodeJS.ProcessEnv = process.env): boolean {
  return Boolean(
    source.ORCID_CLIENT_ID && source.ORCID_CLIENT_SECRET && source.ORCID_REDIRECT_URI,
  );
}
