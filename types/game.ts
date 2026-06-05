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
  name: string;
  platforms?: Platform[];
  year?: number;
}

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

export interface GameList {
  createdAt: number;
  gameIds: number[];
  games: Record<number, Game>;
  id: string;
  name: string;
}

export interface Console {
  family: string;
  id: number;
  name: string;
}
