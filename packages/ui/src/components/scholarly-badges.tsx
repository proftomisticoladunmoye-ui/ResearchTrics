import { Badge } from './badge';
import { cn } from '../utils/cn';

/**
 * Scholarly identity badges (Spec §5). Each is honestly labelled — verification
 * badges must not mislead (Spec §38) — and every badge carries a text label,
 * not color alone (Spec §51).
 */

/** ORCID iD badge; links to the resolver when an iD is provided. */
export function OrcidBadge({ orcid, className }: { orcid?: string; className?: string }) {
  const content = (
    <Badge variant="success" className={cn('font-mono', className)}>
      <span aria-hidden="true">iD</span>
      <span>ORCID{orcid ? ` ${orcid}` : ''}</span>
    </Badge>
  );
  if (!orcid) return content;
  return (
    <a
      href={`https://orcid.org/${orcid}`}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`ORCID iD ${orcid}`}
    >
      {content}
    </a>
  );
}

/** DOI badge; resolves via doi.org. */
export function DoiBadge({ doi, className }: { doi: string; className?: string }) {
  return (
    <a
      href={`https://doi.org/${doi}`}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`DOI ${doi}`}
    >
      <Badge variant="neutral" className={cn('font-mono', className)}>
        DOI {doi}
      </Badge>
    </a>
  );
}

const VERIFICATION_LABELS: Record<number, string> = {
  0: 'Unverified',
  1: 'Email verified',
  2: 'Institution verified',
  3: 'ORCID verified',
  4: 'Output verified',
  5: 'Professional researcher verified',
};

/** Verification badge — explicit level label, gold only at higher trust levels. */
export function VerificationBadge({ level, className }: { level: number; className?: string }) {
  const label = VERIFICATION_LABELS[level] ?? 'Unverified';
  if (level === 0) {
    return (
      <Badge variant="outline" className={className}>
        {label}
      </Badge>
    );
  }
  return (
    <Badge variant={level >= 3 ? 'gold' : 'blue'} className={className} title={label}>
      <span aria-hidden="true">✓</span>
      {label}
    </Badge>
  );
}

/** Open-access badge (Spec §5). */
export function OpenAccessBadge({ className }: { className?: string }) {
  return (
    <Badge variant="success" className={className}>
      Open Access
    </Badge>
  );
}
