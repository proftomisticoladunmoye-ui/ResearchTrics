/**
 * ORCID normalization (§20). DOI registrars (Zenodo, DataCite) and ORCID's own
 * API reject a malformed or URL-wrapped identifier, so every ORCID is reduced to
 * the canonical bare form `0000-0000-0000-000X` before it is stored or
 * transmitted. Lives in its own module so both the bulletin service and the
 * DataCite minter can use it without a circular import.
 */
export function normalizeOrcid(value?: string | null): string | undefined {
  if (!value) return undefined;
  // Pull out 15 digits + a final digit-or-X, ignoring URL, spaces or hyphens.
  const compact = String(value).toUpperCase().replace(/[^0-9X]/g, '');
  const m = /^(\d{15}[\dX])$/.exec(compact);
  if (!m) return undefined;
  const d = m[1]!;
  return `${d.slice(0, 4)}-${d.slice(4, 8)}-${d.slice(8, 12)}-${d.slice(12, 16)}`;
}
