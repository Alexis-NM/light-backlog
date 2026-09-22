import type { Game } from "@/types/game";

const collator = new Intl.Collator();

/** Locale-aware name comparison; reuses one collator, which matters for large lists. */
export const compareNames = (a: string, b: string) => collator.compare(a, b);

/** Best IGDB rating first; unrated games last, ties broken by name. */
export const compareIgdbRating = (a: Game, b: Game) =>
  (b.igdbRating ?? -1) - (a.igdbRating ?? -1) || compareNames(a.name, b.name);
