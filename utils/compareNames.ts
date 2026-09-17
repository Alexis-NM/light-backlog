const collator = new Intl.Collator();

/** Locale-aware name comparison; reuses one collator, which matters for large lists. */
export const compareNames = (a: string, b: string) => collator.compare(a, b);
