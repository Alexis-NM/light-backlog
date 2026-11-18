// The app's side of the sync protocol (see sync.ts): what to send, in which
// batches, and how what comes back merges into the local data. It works on
// plain data and takes the transport as a parameter, so it runs the same in
// the app and in tests.

import { isRecord } from "./backup";
import {
  entryPlatforms,
  type Game,
  type GameList,
  hasRatings,
  type LibraryEntry,
  type ListItem,
} from "./game";
import { sortLists } from "./lists";
import {
  type Dated,
  entryKey,
  isSyncEntry,
  isSyncItem,
  isSyncList,
  itemKey,
  listKey,
  markDeleted,
  mergeLatest,
  parseSyncResponse,
  SYNC_VERSION,
  type SyncChanges,
  type SyncEntry,
  SyncError,
  type SyncItem,
  type SyncList,
  type SyncRequest,
  type SyncResponse,
  supersedes,
} from "./sync";

/** What the app syncs: the library and the lists, with their games. */
export interface LocalData {
  library: Record<number, LibraryEntry>;
  lists: GameList[];
}

/** For each element, the updatedAt of the version the server has. */
export interface SyncedVersions {
  entries: Record<string, number>;
  items: Record<string, number>;
  lists: Record<string, number>;
}

export interface SyncState {
  /** Number of the last change received. */
  cursor: number;
  lastSyncedAt?: number;
  synced: SyncedVersions;
  /** Deletions the server has not received yet. */
  tombstones: SyncChanges;
}

/** Elements per request, far below Vercel's 4.5 MB. */
export const BATCH_SIZE = 250;

export const noChanges = (): SyncChanges => ({
  entries: [],
  lists: [],
  items: [],
});

export const newSyncState = (): SyncState => ({
  cursor: 0,
  synced: { entries: {}, lists: {}, items: {} },
  tombstones: noChanges(),
});

const countChanges = (changes: SyncChanges) =>
  changes.entries.length + changes.lists.length + changes.items.length;

/** One element per key: the most recent one. */
const latest = <T extends Dated>(
  elements: T[],
  keyOf: (element: T) => string
): T[] => [...mergeLatest(new Map(), elements, keyOf).values()];

const byKey = <T>(elements: T[], keyOf: (element: T) => string) =>
  new Map(elements.map((element) => [keyOf(element), element]));

// ---------------------------------------------------------------------------
// Local data as sent

const isPlatform = (value: unknown) =>
  isRecord(value) &&
  Number.isInteger(value.id) &&
  typeof value.name === "string";

const isRating = (value: unknown) =>
  value === null || (typeof value === "number" && Number.isFinite(value));

/** The game as sent: known fields only, an invalid optional one left out. */
export function cleanGame(game: Game): Game {
  const clean: Game = { id: game.id, name: game.name };
  if (typeof game.coverUrl === "string") {
    clean.coverUrl = game.coverUrl;
  }
  if (Number.isInteger(game.year)) {
    clean.year = game.year;
  }
  if (Array.isArray(game.platforms) && game.platforms.every(isPlatform)) {
    clean.platforms = game.platforms.map(({ id, name }) => ({ id, name }));
  }
  const ratings = [game.igdbRating, game.igdbUserRating, game.igdbCriticRating];
  if (hasRatings(game) && ratings.every(isRating)) {
    clean.igdbRating = game.igdbRating;
    clean.igdbUserRating = game.igdbUserRating;
    clean.igdbCriticRating = game.igdbCriticRating;
  }
  return clean;
}

export const toSyncEntry = (entry: LibraryEntry): SyncEntry => ({
  game: cleanGame(entry.game),
  status: entry.status,
  rating: entry.rating,
  platforms: entryPlatforms(entry),
  addedAt: entry.addedAt,
  updatedAt: entry.updatedAt,
});

export function toSyncList(list: GameList): SyncList {
  const sent: SyncList = {
    id: list.id,
    name: list.name,
    position: list.position,
    createdAt: list.createdAt,
    updatedAt: list.updatedAt,
  };
  if (list.consoles !== undefined) {
    sent.consoles = list.consoles;
  }
  if (list.sort !== undefined) {
    sent.sort = list.sort;
  }
  return sent;
}

/** A game in a list has nothing to change: it is dated when added. */
export const toSyncItem = (listId: string, item: ListItem): SyncItem => ({
  listId,
  game: cleanGame(item.game),
  addedAt: item.addedAt,
  updatedAt: item.addedAt,
});

const listItems = (list: GameList) =>
  Object.values(list.items).map((item) => toSyncItem(list.id, item));

// ---------------------------------------------------------------------------
// Deletions, recorded only while sync is on

export const deletedEntries = (
  entries: LibraryEntry[],
  now: number
): Partial<SyncChanges> => ({
  entries: entries.map((entry) => markDeleted(toSyncEntry(entry), now)),
});

/** A deleted list takes its games with it: only the list is marked. */
export const deletedLists = (
  lists: GameList[],
  now: number
): Partial<SyncChanges> => ({
  lists: lists.map((list) => markDeleted(toSyncList(list), now)),
});

export const deletedItems = (
  list: GameList,
  gameIds: number[],
  now: number
): Partial<SyncChanges> => ({
  items: gameIds
    .map((id) => list.items[id])
    .filter((item): item is ListItem => item !== undefined)
    .map((item) => markDeleted(toSyncItem(list.id, item), now)),
});

/** Adds deletion markers; for an element deleted twice, the latest stays. */
export function addTombstones(
  tombstones: SyncChanges,
  deleted: Partial<SyncChanges>
): SyncChanges {
  return {
    entries: latest(
      [...tombstones.entries, ...(deleted.entries ?? [])],
      entryKey
    ),
    lists: latest([...tombstones.lists, ...(deleted.lists ?? [])], listKey),
    items: latest([...tombstones.items, ...(deleted.items ?? [])], itemKey),
  };
}

// ---------------------------------------------------------------------------
// What to send

/** Live elements first, so that one deleted and added again goes out alive. */
const toSend = <T extends Dated>(
  live: T[],
  deleted: T[],
  versions: Record<string, number>,
  keyOf: (element: T) => string
) =>
  latest([...live, ...deleted], keyOf).filter(
    (element) =>
      element.deletedAt !== undefined ||
      versions[keyOf(element)] !== element.updatedAt
  );

/**
 * What the server does not have yet: every element whose version differs from
 * the one it has, and every deletion marker. An invalid element is left out,
 * so that it cannot block the rest, and so are the games of an invalid list.
 */
export function pendingChanges(
  local: LocalData,
  state: SyncState
): { changes: SyncChanges; skipped: number } {
  const { synced, tombstones } = state;
  let skipped = 0;
  const valid = <T>(elements: T[], isValid: (value: unknown) => value is T) =>
    elements.filter((element) => {
      if (isValid(element)) {
        return true;
      }
      skipped += 1;
      return false;
    });

  const invalidLists = new Set(
    local.lists
      .filter((list) => !isSyncList(toSyncList(list)))
      .map((list) => list.id)
  );
  const sendable = local.lists.filter((list) => !invalidLists.has(list.id));

  const changes: SyncChanges = {
    entries: valid(
      toSend(
        Object.values(local.library).map(toSyncEntry),
        tombstones.entries,
        synced.entries,
        entryKey
      ),
      isSyncEntry
    ),
    lists: valid(
      toSend(
        local.lists.map(toSyncList),
        tombstones.lists,
        synced.lists,
        listKey
      ),
      isSyncList
    ),
    items: valid(
      toSend(
        sendable.flatMap(listItems),
        tombstones.items.filter((item) => !invalidLists.has(item.listId)),
        synced.items,
        itemKey
      ),
      isSyncItem
    ),
  };
  return { changes, skipped };
}

/** Whether anything waits to be sent: a change, or a deletion. */
export const hasPendingChanges = (local: LocalData, state: SyncState) =>
  countChanges(pendingChanges(local, state).changes) > 0;

/**
 * Splits the changes into requests of at most `size` elements. Every list
 * goes in the first one: the server refuses a game whose list it lacks.
 */
export function toBatches(changes: SyncChanges, size: number): SyncChanges[] {
  const batches: SyncChanges[] = [];
  let batch: SyncChanges = { ...noChanges(), lists: [...changes.lists] };
  let count = batch.lists.length;
  const makeRoom = () => {
    if (count >= size) {
      batches.push(batch);
      batch = noChanges();
      count = 0;
    }
    count += 1;
  };
  for (const entry of changes.entries) {
    makeRoom();
    batch.entries.push(entry);
  }
  for (const item of changes.items) {
    makeRoom();
    batch.items.push(item);
  }
  if (count > 0) {
    batches.push(batch);
  }
  return batches;
}

// ---------------------------------------------------------------------------
// The exchange

export type SyncTransport = (request: SyncRequest) => Promise<SyncResponse>;

export type SyncFailureKind =
  | "network"
  | "rejected"
  | "server"
  | "token"
  | "version";

export class SyncFailure extends Error {
  kind: SyncFailureKind;
  constructor(kind: SyncFailureKind, message: string) {
    super(message);
    this.kind = kind;
    this.name = "SyncFailure";
  }
}

/** A failure that may pass on its own: no network, or a server failing or waking up. */
export const isTransient = (kind: SyncFailureKind) =>
  kind === "network" || kind === "server";

/** The latest version of each element among several responses. */
const mergeChanges = (pages: SyncChanges[]): SyncChanges => ({
  entries: latest(
    pages.flatMap((page) => page.entries),
    entryKey
  ),
  lists: latest(
    pages.flatMap((page) => page.lists),
    listKey
  ),
  items: latest(
    pages.flatMap((page) => page.items),
    itemKey
  ),
});

/**
 * Sends the batches one after the other, then asks again while the server has
 * more to send. Each request carries the cursor of the previous answer.
 */
export async function exchange(
  pending: SyncChanges,
  cursor: number,
  post: SyncTransport,
  batchSize = BATCH_SIZE
): Promise<{ cursor: number; received: SyncChanges }> {
  const batches = toBatches(pending, batchSize);
  const pages: SyncChanges[] = [];
  let position = cursor;
  let more = true;
  for (let index = 0; index < batches.length || more; index += 1) {
    const response = await post({
      version: SYNC_VERSION,
      cursor: position,
      changes: batches[index] ?? noChanges(),
    });
    if (response.more && response.cursor <= position) {
      throw new SyncFailure("server", "The server did not move its cursor.");
    }
    pages.push(response.changes);
    position = response.cursor;
    more = response.more;
  }
  return { cursor: position, received: mergeChanges(pages) };
}

// ---------------------------------------------------------------------------
// Merging what comes back

/** Fields the server does not send stay as known, like on the server. */
const mergeGames = (known: Game | undefined, received: Game): Game => ({
  ...known,
  ...received,
});

const fromSyncEntry = (
  entry: SyncEntry,
  known: LibraryEntry | undefined
): LibraryEntry => ({
  game: mergeGames(known?.game, entry.game),
  status: entry.status,
  rating: entry.rating,
  platforms: entry.platforms,
  addedAt: entry.addedAt,
  updatedAt: entry.updatedAt,
});

const fromSyncList = (
  list: SyncList,
  known: GameList | undefined
): GameList => ({
  id: list.id,
  name: list.name,
  consoles: list.consoles,
  sort: list.sort,
  position: list.position,
  createdAt: list.createdAt,
  updatedAt: list.updatedAt,
  items: known?.items ?? {},
});

function mergeEntries(
  library: LocalData["library"],
  deleted: Map<string, SyncEntry>,
  incoming: SyncEntry[]
) {
  // Copied once, at the first change.
  let next = library;
  for (const entry of incoming) {
    const key = entryKey(entry);
    const known = next[entry.game.id];
    if (supersedes(entry, deleted.get(key) ?? (known && toSyncEntry(known)))) {
      deleted.delete(key);
      if (next === library) {
        next = { ...library };
      }
      if (entry.deletedAt === undefined) {
        next[entry.game.id] = fromSyncEntry(entry, known);
      } else {
        delete next[entry.game.id];
      }
    }
  }
  return next;
}

function mergeLists(
  lists: Map<string, GameList>,
  deleted: Map<string, SyncList>,
  incoming: SyncList[]
) {
  let changed = false;
  for (const list of incoming) {
    const known = lists.get(list.id);
    if (
      supersedes(list, deleted.get(list.id) ?? (known && toSyncList(known)))
    ) {
      deleted.delete(list.id);
      changed = true;
      if (list.deletedAt === undefined) {
        lists.set(list.id, fromSyncList(list, known));
      } else {
        lists.delete(list.id);
      }
    }
  }
  return changed;
}

function mergeItems(
  lists: Map<string, GameList>,
  deleted: Map<string, SyncItem>,
  incoming: SyncItem[]
) {
  // Each list changed is copied once, with its games.
  const copied = new Set<string>();
  for (const item of incoming) {
    let list = lists.get(item.listId);
    if (!list) {
      continue;
    }
    const key = itemKey(item);
    const known = list.items[item.game.id];
    if (
      supersedes(
        item,
        deleted.get(key) ?? (known && toSyncItem(list.id, known))
      )
    ) {
      deleted.delete(key);
      if (!copied.has(list.id)) {
        list = { ...list, items: { ...list.items } };
        lists.set(list.id, list);
        copied.add(list.id);
      }
      if (item.deletedAt === undefined) {
        list.items[item.game.id] = {
          addedAt: item.addedAt,
          game: mergeGames(known?.game, item.game),
        };
      } else {
        delete list.items[item.game.id];
      }
    }
  }
  return copied.size > 0;
}

/**
 * Merges what the server sent into the local data, element by element, with
 * the most-recent-change rule. A deletion not sent yet counts as the local
 * version. A game of a list the app does not have is ignored. Whatever does
 * not change keeps its object.
 */
export function applyIncoming(
  local: LocalData,
  tombstones: SyncChanges,
  incoming: SyncChanges
): { local: LocalData; tombstones: SyncChanges } {
  const deleted = {
    entries: byKey(tombstones.entries, entryKey),
    lists: byKey(tombstones.lists, listKey),
    items: byKey(tombstones.items, itemKey),
  };
  const library = mergeEntries(
    local.library,
    deleted.entries,
    incoming.entries
  );
  const lists = new Map(local.lists.map((list) => [list.id, list]));
  const listsChanged = mergeLists(lists, deleted.lists, incoming.lists);
  const itemsChanged = mergeItems(lists, deleted.items, incoming.items);
  return {
    local: {
      library,
      lists:
        listsChanged || itemsChanged
          ? sortLists([...lists.values()])
          : local.lists,
    },
    tombstones: {
      entries: [...deleted.entries.values()],
      lists: [...deleted.lists.values()],
      items: [...deleted.items.values()],
    },
  };
}

/** Keys of what the app has, as the server keys its rows. */
const localKeys = (local: LocalData) => ({
  entries: Object.values(local.library).map((entry) => String(entry.game.id)),
  lists: local.lists.map((list) => list.id),
  items: local.lists.flatMap((list) => listItems(list).map(itemKey)),
});

function knownVersions<T extends Dated>(
  known: Record<string, number>,
  keys: string[],
  sent: T[],
  received: T[],
  keyOf: (element: T) => string
) {
  const versions = { ...known };
  for (const element of [...sent, ...received]) {
    versions[keyOf(element)] = element.updatedAt;
  }
  // Only what the app still has needs a known version.
  const kept: Record<string, number> = {};
  for (const key of keys) {
    if (key in versions) {
      kept[key] = versions[key];
    }
  }
  return kept;
}

/** Markers still to send: not delivered yet, and for an element still gone. */
function stillDeleted<T extends Dated>(
  markers: T[],
  sent: T[],
  present: string[],
  keyOf: (element: T) => string
) {
  const delivered = byKey(sent, keyOf);
  const here = new Set(present);
  return markers.filter((marker) => {
    const key = keyOf(marker);
    const done = delivered.get(key);
    return !here.has(key) && (!done || marker.updatedAt > done.updatedAt);
  });
}

/**
 * The state after an exchange: the new cursor, the version the server now has
 * of each element, and the deletions still to send. A deletion made during
 * the exchange is newer than what was sent, so it stays.
 */
export function settle(
  state: SyncState,
  merged: { local: LocalData; tombstones: SyncChanges },
  exchanged: { cursor: number; received: SyncChanges; sent: SyncChanges },
  now: number
): SyncState {
  const keys = localKeys(merged.local);
  const { received, sent } = exchanged;
  return {
    cursor: exchanged.cursor,
    lastSyncedAt: now,
    synced: {
      entries: knownVersions(
        state.synced.entries,
        keys.entries,
        sent.entries,
        received.entries,
        entryKey
      ),
      lists: knownVersions(
        state.synced.lists,
        keys.lists,
        sent.lists,
        received.lists,
        listKey
      ),
      items: knownVersions(
        state.synced.items,
        keys.items,
        sent.items,
        received.items,
        itemKey
      ),
    },
    tombstones: {
      entries: stillDeleted(
        merged.tombstones.entries,
        sent.entries,
        keys.entries,
        entryKey
      ),
      lists: stillDeleted(
        merged.tombstones.lists,
        sent.lists,
        keys.lists,
        listKey
      ),
      items: stillDeleted(
        merged.tombstones.items,
        sent.items,
        keys.items,
        itemKey
      ),
    },
  };
}

export interface SyncSession {
  /** Called once the exchange is over, with everything to store at once. */
  commit: (local: LocalData, state: SyncState) => void;
  /** Read before and after the exchange: the user may change things meanwhile. */
  getLocal: () => LocalData;
  /** null once sync is turned off. */
  getState: () => SyncState | null;
  now?: () => number;
  post: SyncTransport;
}

/**
 * One sync: sends what the server lacks, receives what changed since the
 * cursor, merges it into the data as it is by then, and commits it all at
 * once, in the same tick as the merge.
 */
export async function syncOnce(
  session: SyncSession,
  batchSize = BATCH_SIZE
): Promise<{ received: number; sent: number; skipped: number }> {
  const before = session.getState();
  if (!before) {
    return { received: 0, sent: 0, skipped: 0 };
  }
  const { changes: sent, skipped } = pendingChanges(session.getLocal(), before);
  const { cursor, received } = await exchange(
    sent,
    before.cursor,
    session.post,
    batchSize
  );
  const state = session.getState();
  if (!state) {
    return { received: 0, sent: 0, skipped };
  }
  const merged = applyIncoming(session.getLocal(), state.tombstones, received);
  const now = session.now?.() ?? Date.now();
  session.commit(
    merged.local,
    settle(state, merged, { cursor, received, sent }, now)
  );
  return {
    received: countChanges(received),
    sent: countChanges(sent),
    skipped,
  };
}

// ---------------------------------------------------------------------------
// HTTP

const HTTPS = "https://";
const TRAILING_SLASHES = /\/+$/;
const API_PATH = "/api/sync";
const REQUEST_TIMEOUT_MS = 30_000;

/** What the transport needs of fetch. */
export type FetchLike = (
  url: string,
  init: RequestInit
) => Promise<Pick<Response, "status" | "text">>;

/** The sync endpoint of a server address, or undefined when it is not HTTPS. */
export function syncEndpoint(address: string): string | undefined {
  const base = address.trim().replace(TRAILING_SLASHES, "");
  const root = base.endsWith(API_PATH) ? base.slice(0, -API_PATH.length) : base;
  if (
    !root.toLowerCase().startsWith(HTTPS) ||
    root.length <= HTTPS.length ||
    root.includes(" ")
  ) {
    return;
  }
  return `${root}${API_PATH}`;
}

const errorOf = (body: string) => {
  try {
    const parsed: unknown = JSON.parse(body);
    return isRecord(parsed) && typeof parsed.error === "string"
      ? parsed.error
      : body;
  } catch {
    return body;
  }
};

function failureFor(status: number, body: string): SyncFailure {
  if (status === 401) {
    return new SyncFailure("token", "The server refused the token.");
  }
  if (status === 409) {
    return new SyncFailure("version", "The server needs another app version.");
  }
  if (status === 400) {
    return new SyncFailure("rejected", errorOf(body));
  }
  return new SyncFailure("server", `The server answered ${status}.`);
}

/** POSTs to the sync endpoint and checks the answer. Throws a SyncFailure. */
export function createTransport(
  endpoint: string,
  token: string,
  fetchImpl: FetchLike = fetch,
  timeoutMs = REQUEST_TIMEOUT_MS
): SyncTransport {
  return async (request) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let status: number;
    let body: string;
    try {
      const response = await fetchImpl(endpoint, {
        method: "POST",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(request),
        signal: controller.signal,
      });
      status = response.status;
      body = await response.text();
    } catch {
      throw new SyncFailure("network", "The server could not be reached.");
    } finally {
      clearTimeout(timer);
    }
    if (status < 200 || status >= 300) {
      throw failureFor(status, body);
    }
    try {
      return parseSyncResponse(JSON.parse(body));
    } catch (error) {
      const detail = error instanceof SyncError ? ` ${error.message}` : "";
      throw new SyncFailure("server", `Invalid answer.${detail}`);
    }
  };
}

/**
 * Checks the address and the token without exchanging anything: no change
 * comes after the largest cursor.
 */
export async function checkConnection(post: SyncTransport): Promise<void> {
  await post({
    version: SYNC_VERSION,
    cursor: Number.MAX_SAFE_INTEGER,
    changes: noChanges(),
  });
}
