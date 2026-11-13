// Small text helpers.

/** Trims and caps free text before it goes into emails. */
export function contactSafe(value: string | null | undefined, max = 200): string | null {
  if (!value) return null;
  return (
    value
      .replace(/[\r\n]+/g, ' ')
      .trim()
      .slice(0, max) || null
  );
}

export function linkDomain(link: string | null | undefined): string | null {
  if (!link) return null;
  try {
    return new URL(link).hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return null;
  }
}
