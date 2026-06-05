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
  platform?: string;
  rating: number;
  status: GameStatus;
  updatedAt: number;
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
