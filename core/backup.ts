import {
  type Console,
  GAME_STATUSES,
  type Game,
  type GameList,
  LIBRARY_SORTS,
  LIST_SORTS,
  type LibraryEntry,
  type ListItem,
  type SortMode,
} from "./game";
import type { IgdbAuth } from "./igdb";
import { type GameListV1, upgradeLists } from "./lists";
import { type Language, translations } from "./translations";

// A backup is one JSON document holding everything the app persists. JSON is
// what the app already stores internally, so exporting needs no conversion and
// the file stays readable and diffable by the user.

export const BACKUP_APP = "backlog";
/** Version 2 dates lists and their games. Version 1 files are still read. */
export const BACKUP_VERSION = 2;

export interface BackupSettings {
  gamesFullscreen: boolean;
  invertColors: boolean;
  language: Language;
  libraryFullscreen: boolean;
  librarySort: SortMode;
  listFullscreen: boolean;
  listSort: SortMode;
  selectedConsole: Console | null;
}

export interface Backup {
  app: typeof BACKUP_APP;
  credentials?: IgdbAuth;
  exportedAt: string;
  library: Record<number, LibraryEntry>;
  lists: GameList[];
  /** Partial on read: a file may predate a setting, which then keeps its current value. */
  settings: Partial<BackupSettings>;
  version: typeof BACKUP_VERSION;
}

export type BackupErrorKind = "cancelled" | "invalid" | "read" | "write";

export class BackupError extends Error {
  kind: BackupErrorKind;
  constructor(kind: BackupErrorKind, message: string) {
    super(message);
    this.kind = kind;
    this.name = "BackupError";
  }
}

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isGame = (value: unknown): value is Game =>
  isRecord(value) &&
  typeof value.id === "number" &&
  typeof value.name === "string";

/** With its dates: the app has always written them, and sorts and syncs by them. */
const isEntry = (value: unknown): value is LibraryEntry =>
  isRecord(value) &&
  isGame(value.game) &&
  typeof value.rating === "number" &&
  typeof value.addedAt === "number" &&
  typeof value.updatedAt === "number" &&
  GAME_STATUSES.includes(value.status as LibraryEntry["status"]);

const isCredentials = (value: unknown): value is IgdbAuth =>
  isRecord(value) &&
  typeof value.clientId === "string" &&
  typeof value.clientSecret === "string";

const isConsole = (value: unknown): value is Console =>
  isRecord(value) &&
  typeof value.id === "number" &&
  typeof value.name === "string" &&
  typeof value.family === "string";

const asBoolean = (value: unknown) =>
  typeof value === "boolean" ? value : undefined;

const asLanguage = (value: unknown) =>
  typeof value === "string" && value in translations
    ? (value as Language)
    : undefined;

const asSort = (value: unknown, allowed: SortMode[]) =>
  allowed.includes(value as SortMode) ? (value as SortMode) : undefined;

function parseSettings(raw: Record<string, unknown>): Partial<BackupSettings> {
  return {
    gamesFullscreen: asBoolean(raw.gamesFullscreen),
    invertColors: asBoolean(raw.invertColors),
    language: asLanguage(raw.language),
    libraryFullscreen: asBoolean(raw.libraryFullscreen),
    librarySort: asSort(raw.librarySort, LIBRARY_SORTS),
    listFullscreen: asBoolean(raw.listFullscreen),
    listSort: asSort(raw.listSort, LIST_SORTS),
    selectedConsole:
      raw.selectedConsole === null || isConsole(raw.selectedConsole)
        ? raw.selectedConsole
        : undefined,
  };
}

const isConsoleNames = (value: unknown): value is string[] =>
  Array.isArray(value) &&
  value.length > 0 &&
  value.every((name) => typeof name === "string");

/** A list's own settings: kept when valid, dropped otherwise. */
const listOptions = (raw: Record<string, unknown>) => ({
  consoles: isConsoleNames(raw.consoles) ? raw.consoles : undefined,
  sort: asSort(raw.sort, LIST_SORTS),
});

/** As lenient as version 1 was: only what the conversion needs is checked. */
function parseListV1(value: unknown): GameListV1 | undefined {
  if (
    !(
      isRecord(value) &&
      typeof value.id === "string" &&
      typeof value.name === "string" &&
      Array.isArray(value.gameIds) &&
      isRecord(value.games) &&
      Object.values(value.games).every(isGame)
    )
  ) {
    return;
  }
  return {
    id: value.id,
    name: value.name,
    gameIds: value.gameIds,
    games: value.games as Record<number, Game>,
    // The app always wrote it; without it, the list counts as the oldest.
    createdAt: typeof value.createdAt === "number" ? value.createdAt : 0,
    ...listOptions(value),
  };
}

const isItem = (value: unknown): value is ListItem =>
  isRecord(value) && typeof value.addedAt === "number" && isGame(value.game);

function parseList(value: unknown): GameList | undefined {
  if (
    !(
      isRecord(value) &&
      typeof value.id === "string" &&
      typeof value.name === "string" &&
      typeof value.createdAt === "number" &&
      typeof value.updatedAt === "number" &&
      typeof value.position === "number" &&
      isRecord(value.items) &&
      Object.entries(value.items).every(
        ([key, item]) => isItem(item) && key === String(item.game.id)
      )
    )
  ) {
    return;
  }
  return {
    id: value.id,
    name: value.name,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
    position: value.position,
    items: value.items as Record<number, ListItem>,
    ...listOptions(value),
  };
}

const isDefined = <T>(value: T | undefined): value is T => value !== undefined;

function parseLists(version: unknown, raw: unknown[]): GameList[] | undefined {
  if (version === 1) {
    const lists = raw.map(parseListV1);
    return lists.every(isDefined) ? upgradeLists(lists) : undefined;
  }
  if (version === BACKUP_VERSION) {
    const lists = raw.map(parseList);
    return lists.every(isDefined) ? lists : undefined;
  }
  return;
}

/**
 * The same elements, oldest first: the most recent one dated `now`, each one
 * before it a millisecond earlier.
 */
function datedUpTo<T>(
  elements: T[],
  timeOf: (element: T) => number,
  withTime: (element: T, time: number) => T,
  now: number
): T[] {
  const oldestFirst = [...elements].sort((a, b) => timeOf(a) - timeOf(b));
  const first = now - oldestFirst.length + 1;
  return oldestFirst.map((element, rank) => withTime(element, first + rank));
}

/**
 * What a backup holds, dated at the restore, in the same order. With its own
 * dates, restored data loses to whatever a sync server changed or deleted
 * since the backup: on the next connection, a library cleared by mistake
 * would be cleared again. An entry keeps the date it was added.
 */
export function redated(
  { library, lists }: Pick<Backup, "library" | "lists">,
  now: number
): Pick<Backup, "library" | "lists"> {
  const entries = datedUpTo(
    Object.values(library),
    (entry) => entry.updatedAt,
    (entry, updatedAt) => ({ ...entry, updatedAt }),
    now
  );
  return {
    library: Object.fromEntries(entries.map((entry) => [entry.game.id, entry])),
    lists: lists.map((list) => ({
      ...list,
      updatedAt: now,
      items: Object.fromEntries(
        datedUpTo(
          Object.values(list.items),
          (item) => item.addedAt,
          (item, addedAt) => ({ ...item, addedAt }),
          now
        ).map((item) => [item.game.id, item])
      ),
    })),
  };
}

export function backupFileName(date = new Date()) {
  return `${BACKUP_APP}-backup-${date.toISOString().slice(0, 10)}.json`;
}

export function serializeBackup(backup: Backup) {
  return JSON.stringify(backup, null, 2);
}

/**
 * Validates everything a restore relies on; unknown or malformed settings are
 * dropped. A version 1 file comes out in the current format.
 */
export function parseBackup(text: string): Backup {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new BackupError("invalid", "Not valid JSON.");
  }
  if (
    !(
      isRecord(data) &&
      data.app === BACKUP_APP &&
      Array.isArray(data.lists) &&
      isRecord(data.library) &&
      Object.entries(data.library).every(
        ([key, entry]) => isEntry(entry) && key === String(entry.game.id)
      ) &&
      isRecord(data.settings)
    )
  ) {
    throw new BackupError("invalid", "Not a Backlog backup.");
  }
  const lists = parseLists(data.version, data.lists);
  if (!lists) {
    throw new BackupError("invalid", "Not a Backlog backup.");
  }
  return {
    app: BACKUP_APP,
    version: BACKUP_VERSION,
    exportedAt: typeof data.exportedAt === "string" ? data.exportedAt : "",
    lists,
    library: data.library as Record<number, LibraryEntry>,
    settings: parseSettings(data.settings),
    credentials: isCredentials(data.credentials) ? data.credentials : undefined,
  };
}
