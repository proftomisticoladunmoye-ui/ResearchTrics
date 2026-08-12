/** DOI validation & normalization (Spec §61). DOIs are validated, never invented. */

const DOI_RE = /^10\.\d{4,9}\/[-._;()/:A-Z0-9]+$/i;

/** Strip resolver prefixes and lowercase. Does not validate. */
export function normalizeDoi(input: string): string {
  return input
    .trim()
    .replace(/^https?:\/\/(dx\.)?doi\.org\//i, '')
    .replace(/^doi:/i, '')
    .toLowerCase();
}

/** True if the (normalized) string is a syntactically valid DOI. */
export function isValidDoi(input: string): boolean {
  return DOI_RE.test(normalizeDoi(input));
}

/** Normalize + validate, throwing a readable error on invalid input. */
export function assertValidDoi(input: string): string {
  const doi = normalizeDoi(input);
  if (!DOI_RE.test(doi)) throw new Error(`Invalid DOI: ${input}`);
  return doi;
}
