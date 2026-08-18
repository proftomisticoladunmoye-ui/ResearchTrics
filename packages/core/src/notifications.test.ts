import { describe, it, expect } from 'vitest';
import { describeNotification } from './notifications';

describe('describeNotification', () => {
  it('renders an engagement event with country only', () => {
    const s = describeNotification({
      type: 'publication_read',
      country: 'Germany',
      publicationTitle: 'On Engines',
    });
    expect(s).toBe('Someone read “On Engines” from Germany.');
  });

  it('falls back to "your work" and omits location when absent', () => {
    const s = describeNotification({
      type: 'publication_download',
      country: null,
      publicationTitle: null,
    });
    expect(s).toBe('Someone downloaded your work.');
  });

  it('renders an opportunity match with a humanized type label', () => {
    const s = describeNotification({
      type: 'opportunity_match',
      country: null,
      publicationTitle: null,
      opportunityTitle: 'Marie Curie Fellowship',
      opportunityType: 'call_for_papers',
    });
    expect(s).toBe('A new call for papers matches your interests: “Marie Curie Fellowship”.');
  });

  it('handles an opportunity match with no title/type gracefully', () => {
    const s = describeNotification({ type: 'opportunity_match', country: null, publicationTitle: null });
    expect(s).toBe('A new opportunity matches your interests.');
  });
});
