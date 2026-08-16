import type { OpportunityType } from '@researchtrics/db';

/** Human-readable labels for opportunity types (shared across pages). */
export const TYPE_LABELS: Record<OpportunityType, string> = {
  grant: 'Grant',
  fellowship: 'Fellowship',
  call_for_papers: 'Call for papers',
  conference: 'Conference',
  position: 'Job / Position',
  award: 'Award',
  training: 'Training',
  collaboration: 'Collaboration',
  other: 'Opportunity',
};
