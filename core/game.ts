export type GameStatus = "playing" | "played" | "backlog" | "wishlist";

export const GAME_STATUSES: readonly GameStatus[] = [
  "playing",
  "played",
  "backlog",
  "wishlist",
] as const;

export interface Platform {
  id: number;
  name: string;
}

export interface Game {
  coverUrl?: string;
  id: number;
  /** IGDB press (aggregated) rating, 0–100. `null` when IGDB has none, absent when not fetched yet. */
  igdbCriticRating?: number | null;
  /** IGDB total rating, 0–100. `null` when IGDB has none, absent when not fetched yet. */
  igdbRating?: number | null;
  /** IGDB members' rating, 0–100. `null` when IGDB has none, absent when not fetched yet. */
  igdbUserRating?: number | null;
  name: string;
  platforms?: Platform[];
  year?: number;
}

/** The three IGDB scores as stored on a Game (null = IGDB has none). */
export type StoredRatings = Pick<
  Required<Game>,
  "igdbCriticRating" | "igdbRating" | "igdbUserRating"
>;

export const hasRatings = (game: Game) =>
  game.igdbRating !== undefined &&
  game.igdbUserRating !== undefined &&
  game.igdbCriticRating !== undefined;

export const sameRatings = (game: Game, stored: StoredRatings) =>
  game.igdbRating === stored.igdbRating &&
  game.igdbUserRating === stored.igdbUserRating &&
  game.igdbCriticRating === stored.igdbCriticRating;

export interface LibraryEntry {
  addedAt: number;
  game: Game;
  /** @deprecated kept for migration — use `platforms` */
  platform?: string;
  platforms?: string[];
  rating: number;
  status: GameStatus;
  updatedAt: number;
}

/** Consoles a library entry is filed under (migrates the legacy single field). */
export function entryPlatforms(entry: LibraryEntry): string[] {
  if (entry.platforms) {
    return entry.platforms;
  }
  return entry.platform ? [entry.platform] : [];
}

export type SortMode = "alpha" | "alpha_desc" | "igdb" | "rating" | "recent";

export const LIBRARY_SORTS: SortMode[] = [
  "alpha",
  "alpha_desc",
  "recent",
  "rating",
  "igdb",
];

export const LIST_SORTS: SortMode[] = ["alpha", "alpha_desc", "recent", "igdb"];

export interface ListItem {
  /** The "recent" sort shows the latest first. */
  addedAt: number;
  game: Game;
}

export interface GameList {
  consoles?: string[];
  createdAt: number;
  id: string;
  /** By game id. */
  items: Record<number, ListItem>;
  name: string;
  /** Lists are shown by ascending position. */
  position: number;
  /** Overrides the global list sort for this list. */
  sort?: SortMode;
  /** Last change to the list itself (name, consoles, sort, position), not to its games. */
  updatedAt: number;
}

export interface Console {
  family: string;
  id: number;
  name: string;
}
