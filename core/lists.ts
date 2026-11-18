import {
  type Game,
  type GameList,
  type ListItem,
  type SortMode,
  type StoredRatings,
  sameRatings,
} from "./game";

/** A list as stored before version 1.5, and in version 1 backups. */
export interface GameListV1 {
  consoles?: string[];
  createdAt: number;
  /** Most recently added first. */
  gameIds: number[];
  games: Record<number, Game>;
  id: string;
  name: string;
  sort?: SortMode;
}

/**
 * Converts a list from the old format and keeps the order of its games: the
 * first one added (the last of `gameIds`) is dated `createdAt`, and each later
 * one a millisecond more. A list always converts to the same result.
 */
export function upgradeList(list: GameListV1, position: number): GameList {
  const games: Game[] = [];
  const seen = new Set<number>();
  const keep = (game: Game | undefined) => {
    if (game && !seen.has(game.id)) {
      seen.add(game.id);
      games.push(game);
    }
  };
  for (const id of list.gameIds) {
    keep(list.games[id]);
  }
  // A game missing from gameIds was never shown: it is kept, as the oldest.
  for (const game of Object.values(list.games)) {
    keep(game);
  }

  const items: Record<number, ListItem> = {};
  let addedAt = list.createdAt + games.length - 1;
  for (const game of games) {
    items[game.id] = { addedAt, game };
    addedAt -= 1;
  }

  return {
    id: list.id,
    name: list.name,
    consoles: list.consoles,
    sort: list.sort,
    createdAt: list.createdAt,
    updatedAt: list.createdAt,
    position,
    items,
  };
}

/** Converts lists from the old format: their order gives their position. */
export function upgradeLists(lists: GameListV1[]): GameList[] {
  return lists.map((list, index) => upgradeList(list, index));
}

/** The list's games, most recently added first. */
export function listGames(list: GameList): Game[] {
  return Object.values(list.items)
    .sort((a, b) => b.addedAt - a.addedAt || a.game.id - b.game.id)
    .map((item) => item.game);
}

function newestAddedAt(list: GameList): number {
  let newest = Number.NEGATIVE_INFINITY;
  for (const item of Object.values(list.items)) {
    newest = Math.max(newest, item.addedAt);
  }
  return newest;
}

/**
 * Adds the games that are not in the list yet, above all the others, the
 * first one given on top. The games already there keep their date.
 */
export function withGames(
  list: GameList,
  games: Game[],
  now: number
): GameList {
  const added = new Map<number, Game>();
  for (const game of games) {
    if (!(list.items[game.id] || added.has(game.id))) {
      added.set(game.id, game);
    }
  }
  if (added.size === 0) {
    return list;
  }

  const items = { ...list.items };
  // Above the newest game even if the clock went back since it was added.
  let addedAt = Math.max(now, newestAddedAt(list) + added.size);
  for (const game of added.values()) {
    items[game.id] = { addedAt, game };
    addedAt -= 1;
  }
  return { ...list, items };
}

export function withoutGames(list: GameList, gameIds: number[]): GameList {
  const items = { ...list.items };
  for (const id of gameIds) {
    delete items[id];
  }
  return { ...list, items };
}

/** Stores IGDB ratings without touching any date: a refresh is not a change. */
export function withRatings(
  list: GameList,
  ratings: Record<number, StoredRatings>
): GameList {
  let items: Record<number, ListItem> | null = null;
  for (const [key, stored] of Object.entries(ratings)) {
    const item = list.items[Number(key)];
    if (item && !sameRatings(item.game, stored)) {
      items ??= { ...list.items };
      items[Number(key)] = { ...item, game: { ...item.game, ...stored } };
    }
  }
  return items ? { ...list, items } : list;
}

const sameConsoles = (a: string[] = [], b: string[] = []) =>
  a.length === b.length && a.every((name, index) => name === b[index]);

/** Changes the list's own fields, dated so that the latest change wins. */
export function withFields(
  list: GameList,
  fields: Partial<Pick<GameList, "consoles" | "name" | "sort">>,
  now: number
): GameList {
  const next = { ...list, ...fields };
  const changed =
    next.name !== list.name ||
    next.sort !== list.sort ||
    !sameConsoles(next.consoles, list.consoles);
  return changed ? { ...next, updatedAt: now } : list;
}

const compareIds = (a: string, b: string) => {
  if (a === b) {
    return 0;
  }
  return a < b ? -1 : 1;
};

/** Lists in display order. Equal positions are ordered by id. */
export function sortLists(lists: readonly GameList[]): GameList[] {
  return [...lists].sort(
    (a, b) => a.position - b.position || compareIds(a.id, b.id)
  );
}

/** Position for a new list, above all the others. */
export function topPosition(lists: readonly GameList[]): number {
  let position = 0;
  for (const list of lists) {
    position = Math.min(position, list.position - 1);
  }
  return position;
}

const hasDistinctPositions = (ordered: GameList[]) =>
  ordered.every(
    (list, index) =>
      index === 0 || list.position !== ordered[index - 1].position
  );

const renumbered = (ordered: GameList[], now: number) =>
  ordered.map((list, index) =>
    list.position === index
      ? list
      : { ...list, position: index, updatedAt: now }
  );

/**
 * Swaps a list with the one above or below it, in display order. Only these
 * two change, unless some positions were equal: they are renumbered first.
 */
export function reorderLists(
  lists: GameList[],
  id: string,
  direction: "down" | "up",
  now: number
): GameList[] {
  const ordered = sortLists(lists);
  const index = ordered.findIndex((list) => list.id === id);
  const target = direction === "up" ? index - 1 : index + 1;
  if (index < 0 || target < 0 || target >= ordered.length) {
    return lists;
  }
  const next = hasDistinctPositions(ordered)
    ? ordered
    : renumbered(ordered, now);
  const moved = next[index];
  const other = next[target];
  next[index] = { ...other, position: moved.position, updatedAt: now };
  next[target] = { ...moved, position: other.position, updatedAt: now };
  return next;
}
