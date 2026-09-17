import { getDocumentAsync } from "expo-document-picker";
import { Directory, File } from "expo-file-system";
import {
  LIBRARY_SORTS,
  LIST_SORTS,
  type SortMode,
} from "@/contexts/SortContext";
import { type Language, translations } from "@/i18n/translations";
import type { IgdbAuth } from "@/services/igdb";
import {
  type Console,
  GAME_STATUSES,
  type GameList,
  type LibraryEntry,
} from "@/types/game";

// A backup is one JSON document holding everything the app persists. JSON is
// what the app already stores internally, so exporting needs no conversion and
// the file stays readable and diffable by the user.

export const BACKUP_APP = "backlog";
export const BACKUP_VERSION = 1;
const MIME_TYPE = "application/json";

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

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isGame = (value: unknown) =>
  isRecord(value) &&
  typeof value.id === "number" &&
  typeof value.name === "string";

const isList = (value: unknown): value is GameList =>
  isRecord(value) &&
  typeof value.id === "string" &&
  typeof value.name === "string" &&
  Array.isArray(value.gameIds) &&
  isRecord(value.games) &&
  Object.values(value.games).every(isGame);

const isEntry = (value: unknown): value is LibraryEntry =>
  isRecord(value) &&
  isGame(value.game) &&
  typeof value.rating === "number" &&
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

export function backupFileName(date = new Date()) {
  return `${BACKUP_APP}-backup-${date.toISOString().slice(0, 10)}.json`;
}

export function serializeBackup(backup: Backup) {
  return JSON.stringify(backup, null, 2);
}

/** Validates everything a restore relies on; unknown or malformed settings are dropped. */
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
      data.version === BACKUP_VERSION &&
      Array.isArray(data.lists) &&
      data.lists.every(isList) &&
      isRecord(data.library) &&
      Object.values(data.library).every(isEntry) &&
      isRecord(data.settings)
    )
  ) {
    throw new BackupError("invalid", "Not a Backlog backup.");
  }
  return {
    app: BACKUP_APP,
    version: BACKUP_VERSION,
    exportedAt: typeof data.exportedAt === "string" ? data.exportedAt : "",
    lists: data.lists,
    library: data.library as Record<number, LibraryEntry>,
    settings: parseSettings(data.settings),
    credentials: isCredentials(data.credentials) ? data.credentials : undefined,
  };
}

const isPickerCancelled = (error: unknown) =>
  isRecord(error) && error.code === "ERR_PICKER_CANCELLED";

/** Lets the user pick a folder, then writes the backup there. Resolves to the file name. */
export async function writeBackupFile(backup: Backup): Promise<string> {
  let directory: Directory;
  try {
    directory = await Directory.pickDirectoryAsync();
  } catch (error) {
    if (isPickerCancelled(error)) {
      throw new BackupError("cancelled", "Folder picker cancelled.");
    }
    throw new BackupError("write", "Could not open the folder.");
  }
  const name = backupFileName();
  try {
    const file = directory.createFile(name, MIME_TYPE);
    file.write(serializeBackup(backup));
  } catch {
    throw new BackupError("write", "Could not write the backup file.");
  }
  return name;
}

/** Lets the user pick a backup file and returns its parsed content. */
export async function readBackupFile(): Promise<Backup> {
  // Not every file provider labels .json files as application/json, and the
  // parser rejects anything else anyway, so the picker is left unfiltered.
  const result = await getDocumentAsync({
    type: "*/*",
    copyToCacheDirectory: true,
  });
  const asset = result.assets?.[0];
  if (result.canceled || !asset) {
    throw new BackupError("cancelled", "File picker cancelled.");
  }
  let text: string;
  try {
    text = await new File(asset.uri).text();
  } catch {
    throw new BackupError("read", "Could not read the file.");
  }
  return parseBackup(text);
}
