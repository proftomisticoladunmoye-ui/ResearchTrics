import { logger } from './logger';

/**
 * Email provider abstraction (Spec §40, §48). Swappable so the transport
 * (Resend/Postmark/SES) is not hard-coded. Phase 2 ships the console provider.
 */

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export interface EmailProvider {
  send(message: EmailMessage): Promise<void>;
}

/** Dev provider: logs the email instead of sending. Never used in production. */
export class ConsoleEmailProvider implements EmailProvider {
  async send(message: EmailMessage): Promise<void> {
    logger.info(
      { to: message.to, subject: message.subject },
      `[email:console] ${message.subject}\n${message.text}`,
    );
  }
}

let provider: EmailProvider = new ConsoleEmailProvider();

/** Override the active provider (e.g. wire a real transport at startup). */
export function setEmailProvider(next: EmailProvider): void {
  provider = next;
}

export function getEmailProvider(): EmailProvider {
  return provider;
}

export interface ResendConfig {
  apiKey: string;
  from: string;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
}

/** Real transport via Resend's HTTP API (a common, simple provider). */
export class ResendEmailProvider implements EmailProvider {
  constructor(private readonly config: ResendConfig) {}
  async send(message: EmailMessage): Promise<void> {
    const res = await (this.config.fetchImpl ?? fetch)(
      `${(this.config.baseUrl ?? 'https://api.resend.com').replace(/\/$/, '')}/emails`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${this.config.apiKey}` },
        body: JSON.stringify({
          from: this.config.from,
          to: message.to,
          subject: message.subject,
          html: message.html,
          text: message.text,
        }),
      },
    );
    if (!res.ok) throw new Error(`Resend send failed: ${res.status}`);
  }
}

/** Select an email transport from the environment (console by default). */
export function emailProviderFromEnv(env: NodeJS.ProcessEnv = process.env): EmailProvider {
  if (env.EMAIL_PROVIDER === 'resend' && env.EMAIL_API_KEY) {
    return new ResendEmailProvider({
      apiKey: env.EMAIL_API_KEY,
      from: env.EMAIL_FROM ?? 'ResearchTrics <no-reply@researchtrics.com>',
    });
  }
  return new ConsoleEmailProvider();
}

// --- Minimal transactional templates (Spec §40) ---

export function emailVerificationTemplate(verifyUrl: string): Omit<EmailMessage, 'to'> {
  return {
    subject: 'Verify your ResearchTrics email',
    text: `Welcome to ResearchTrics.\n\nVerify your email:\n${verifyUrl}\n\nThis link expires in 24 hours.`,
    html: `<p>Welcome to ResearchTrics.</p><p><a href="${verifyUrl}">Verify your email address</a></p><p>This link expires in 24 hours.</p>`,
  };
}
