import type { Game } from "@/core/game";
import { isIgdbImage } from "@/core/igdb";
import { isGame } from "@/core/sync";

// What utils/navigation.ts writes into a route, read back. A link
// (backlog://…) can open a screen with params the app never wrote: nothing
// goes further than these checks without the shape the screens count on,
// and no image is loaded from anywhere but IGDB.

function parseJson(raw: string | undefined): unknown {
  if (!raw) {
    return;
  }
  try {
    return JSON.parse(raw);
  } catch {
    return;
  }
}

function withIgdbCover(game: Game): Game {
  if (game.coverUrl === undefined || isIgdbImage(game.coverUrl)) {
    return game;
  }
  const { coverUrl, ...withoutCover } = game;
  return withoutCover;
}

/** The game a route was opened with, or null when it is not one. */
export function readGame(raw: string | undefined): Game | null {
  const value = parseJson(raw);
  return isGame(value) ? withIgdbCover(value) : null;
}

/** The games a route was opened with; what is not a game is left out. */
export function readGames(raw: string | undefined): Game[] {
  const value = parseJson(raw);
  return Array.isArray(value) ? value.filter(isGame).map(withIgdbCover) : [];
}

/** The IGDB images a route was opened with; any other address is left out. */
export function readImages(raw: string | undefined): string[] {
  const value = parseJson(raw);
  return Array.isArray(value)
    ? value.filter(
        (url): url is string => typeof url === "string" && isIgdbImage(url)
      )
    : [];
}
