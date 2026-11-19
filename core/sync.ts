// The sync protocol between the app and a server: one POST, a bearer token
// and a version number. The server applies the changes it receives, then
// sends back everything that changed since the client's cursor:
//
//   → { version: 1, cursor: 42, changes: { entries, lists, items } }
//   ← { cursor: 57, changes: { entries, lists, items }, more: false }
//
// Dates are milliseconds since 1970, as Date.now() gives them. A deleted
// element is sent whole, with deletedAt. Each side checks what it receives
// with the functions below.

import { isRecord } from "./backup";
import {
  changeTime,
  GAME_STATUSES,
  type Game,
  type GameStatus,
  LIST_SORTS,
  type SortMode,
} from "./game";

/** Compatible additions keep it. Anything else bumps it, and the server answers 409. */
export const SYNC_VERSION = 1;

/** What the most-recent-change rule compares. */
export interface Dated {
  /** Set once the element is deleted. updatedAt then holds the same time. */
  deletedAt?: number;
  updatedAt: number;
}

/** A library entry. */
export interface SyncEntry extends Dated {
  addedAt: number;
  game: Game;
  platforms: string[];
  /** 0 to 5 stars by halves, 0 when not rated. */
  rating: number;
  status: GameStatus;
}

export interface SyncList extends Dated {
  /** Absent: every console. */
  consoles?: string[];
  createdAt: number;
  id: string;
  name: string;
  /** Lists are shown by ascending position. */
  position: number;
  /** Absent: the general list sort. */
  sort?: SortMode;
}

/** A game in a list. */
export interface SyncItem extends Dated {
  addedAt: number;
  game: Game;
  listId: string;
}

export interface SyncChanges {
  entries: SyncEntry[];
  items: SyncItem[];
  lists: SyncList[];
}

export interface SyncRequest {
  changes: SyncChanges;
  /** Number of the last change received from the server, 0 at the first sync. */
  cursor: number;
  version: typeof SYNC_VERSION;
}

export interface SyncResponse {
  changes: SyncChanges;
  cursor: number;
  /** More changes are waiting: ask again from the new cursor. */
  more: boolean;
}

// ---------------------------------------------------------------------------
// The most recent change wins

/** Elements are keyed as the server keys its rows. */
export const entryKey = (entry: SyncEntry) => String(entry.game.id);
export const listKey = (list: SyncList) => list.id;
export const itemKey = (item: SyncItem) => `${item.listId}/${item.game.id}`;

/**
 * The most recent change wins, element by element. On a tie the element
 * already there stays, as with the server's `WHERE excluded.updated_at > …`.
 */
export function supersedes(
  incoming: Dated,
  existing: Dated | undefined
): boolean {
  return existing === undefined || incoming.updatedAt > existing.updatedAt;
}

/** Applies the rule to each incoming element. `current` is left as it is. */
export function mergeLatest<T extends Dated>(
  current: ReadonlyMap<string, T>,
  incoming: Iterable<T>,
  keyOf: (element: T) => string
): Map<string, T> {
  const merged = new Map(current);
  for (const element of incoming) {
    const key = keyOf(element);
    if (supersedes(element, merged.get(key))) {
      merged.set(key, element);
    }
  }
  return merged;
}

/**
 * A deletion is a change like any other: the element keeps its fields and
 * takes the time, after the version deleted.
 */
export function markDeleted<T extends Dated>(element: T, now: number): T {
  const time = changeTime(now, element);
  return { ...element, deletedAt: time, updatedAt: time };
}

// ---------------------------------------------------------------------------
// Validation, as strict as the server's database (its migration
// 0001_sync_schema.sql), so that bad content gets a 400 instead of a failed
// write. Unknown fields go through: a compatible addition keeps the version.

export type SyncErrorKind = "invalid" | "version";

export class SyncError extends Error {
  kind: SyncErrorKind;
  constructor(kind: SyncErrorKind, message: string) {
    super(message);
    this.kind = kind;
    this.name = "SyncError";
  }
}

const INT32_MIN = -2_147_483_648;
const INT32_MAX = 2_147_483_647;

const isInt32 = (value: unknown): value is number =>
  typeof value === "number" &&
  Number.isInteger(value) &&
  value >= INT32_MIN &&
  value <= INT32_MAX;

const isTime = (value: unknown): value is number =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= 0;

const isText = (value: unknown): value is string => typeof value === "string";

const isId = (value: unknown): value is string => isText(value) && value !== "";

const isTexts = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every(isText);

const isPlatform = (value: unknown) =>
  isRecord(value) && isInt32(value.id) && isText(value.name);

const isRating = (value: unknown) =>
  value === null || (typeof value === "number" && Number.isFinite(value));

/** IGDB ratings come together: all absent (not fetched yet), or all there (null when IGDB has none). */
const hasRatingsTogether = (game: Record<string, unknown>) => {
  const ratings = [game.igdbRating, game.igdbUserRating, game.igdbCriticRating];
  return (
    ratings.every((rating) => rating === undefined) || ratings.every(isRating)
  );
};

export const isGame = (value: unknown): value is Game =>
  isRecord(value) &&
  isInt32(value.id) &&
  value.id > 0 &&
  isText(value.name) &&
  (value.coverUrl === undefined || isText(value.coverUrl)) &&
  (value.year === undefined || isInt32(value.year)) &&
  (value.platforms === undefined ||
    (Array.isArray(value.platforms) && value.platforms.every(isPlatform))) &&
  hasRatingsTogether(value);

/** A deletion dates the element too, so deletedAt is never after updatedAt. */
const isDated = (value: Record<string, unknown>) =>
  isTime(value.updatedAt) &&
  (value.deletedAt === undefined ||
    (isTime(value.deletedAt) && value.deletedAt <= value.updatedAt));

/** 0 to 5 stars by halves. */
const isStars = (value: unknown) =>
  typeof value === "number" &&
  value >= 0 &&
  value <= 5 &&
  Number.isInteger(value * 2);

export const isSyncEntry = (value: unknown): value is SyncEntry =>
  isRecord(value) &&
  isGame(value.game) &&
  GAME_STATUSES.includes(value.status as GameStatus) &&
  isStars(value.rating) &&
  isTexts(value.platforms) &&
  isTime(value.addedAt) &&
  isDated(value);

export const isSyncList = (value: unknown): value is SyncList =>
  isRecord(value) &&
  isId(value.id) &&
  isText(value.name) &&
  (value.consoles === undefined ||
    (isTexts(value.consoles) && value.consoles.length > 0)) &&
  (value.sort === undefined || LIST_SORTS.includes(value.sort as SortMode)) &&
  isInt32(value.position) &&
  isTime(value.createdAt) &&
  isDated(value);

export const isSyncItem = (value: unknown): value is SyncItem =>
  isRecord(value) &&
  isId(value.listId) &&
  isGame(value.game) &&
  isTime(value.addedAt) &&
  isDated(value);

const isCursor = (value: unknown): value is number =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= 0;

function parseElements<T>(
  value: unknown,
  name: keyof SyncChanges,
  isValid: (value: unknown) => value is T,
  keyOf: (element: T) => string
): T[] {
  if (!Array.isArray(value)) {
    throw new SyncError("invalid", `changes.${name} is missing.`);
  }
  // A batch holds the latest version of each element, so each comes once.
  const keys = new Set<string>();
  for (const [index, element] of value.entries()) {
    if (!isValid(element)) {
      throw new SyncError("invalid", `changes.${name}[${index}] is invalid.`);
    }
    const key = keyOf(element);
    if (keys.has(key)) {
      throw new SyncError(
        "invalid",
        `changes.${name}[${index}] repeats ${key}.`
      );
    }
    keys.add(key);
  }
  return value;
}

function parseChanges(value: unknown): SyncChanges {
  if (!isRecord(value)) {
    throw new SyncError("invalid", "changes is missing.");
  }
  return {
    entries: parseElements(value.entries, "entries", isSyncEntry, entryKey),
    lists: parseElements(value.lists, "lists", isSyncList, listKey),
    items: parseElements(value.items, "items", isSyncItem, itemKey),
  };
}

/**
 * Checks a request body, once parsed from JSON. Throws a SyncError of kind
 * "version" for another protocol version (answer 409), "invalid" otherwise
 * (answer 400).
 */
export function parseSyncRequest(body: unknown): SyncRequest {
  if (!(isRecord(body) && typeof body.version === "number")) {
    throw new SyncError("invalid", "Not a sync request.");
  }
  if (body.version !== SYNC_VERSION) {
    throw new SyncError(
      "version",
      `Sync version ${body.version} is not supported.`
    );
  }
  if (!isCursor(body.cursor)) {
    throw new SyncError("invalid", "cursor is invalid.");
  }
  return {
    version: SYNC_VERSION,
    cursor: body.cursor,
    changes: parseChanges(body.changes),
  };
}

/** Checks a response body, once parsed from JSON. Throws a SyncError of kind "invalid". */
export function parseSyncResponse(body: unknown): SyncResponse {
  if (
    !(isRecord(body) && isCursor(body.cursor) && typeof body.more === "boolean")
  ) {
    throw new SyncError("invalid", "Not a sync response.");
  }
  return {
    cursor: body.cursor,
    more: body.more,
    changes: parseChanges(body.changes),
  };
}
