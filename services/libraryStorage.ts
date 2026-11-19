import AsyncStorage from "@react-native-async-storage/async-storage";
import type { LibraryEntry } from "@/core/game";

/** The library, by game id. */
export type Library = Record<number, LibraryEntry>;

// Each entry lives under its own key, so that a change only rewrites that
// entry, and the library never hits the 2 MB Android can read back from a
// single key: about 4,000 games, under the single key of version 1.9.
const LEGACY_KEY = "library";
const ENTRY_PREFIX = "entry:";
const entryKey = (entry: LibraryEntry) => `${ENTRY_PREFIX}${entry.game.id}`;

const toRows = (entries: LibraryEntry[]): [string, string][] =>
  entries.map((entry) => [entryKey(entry), JSON.stringify(entry)]);

async function storedKeys() {
  const keys = await AsyncStorage.getAllKeys();
  return keys.filter((key) => key.startsWith(ENTRY_PREFIX));
}

/**
 * Moves the library of version 1.9 and older to one key per entry. Its key
 * goes last: interrupted, the conversion starts over at the next launch.
 */
async function convertLegacy() {
  const legacy = await AsyncStorage.getItem(LEGACY_KEY);
  if (legacy === null) {
    return;
  }
  const library: Library = JSON.parse(legacy);
  await AsyncStorage.multiSet(toRows(Object.values(library)));
  await AsyncStorage.removeItem(LEGACY_KEY);
}

/**
 * Loads the library. Rejects when it is there but cannot be read: it is then
 * left as it is in storage, never taken for an empty one.
 */
export async function loadLibrary(): Promise<Library> {
  await convertLegacy();
  const rows = await AsyncStorage.multiGet(await storedKeys());
  const library: Library = {};
  for (const [, raw] of rows) {
    if (raw !== null) {
      const entry: LibraryEntry = JSON.parse(raw);
      library[entry.game.id] = entry;
    }
  }
  return library;
}

/** Writes the entries that changed and removes the ones gone. */
export async function saveLibraryChanges(before: Library, after: Library) {
  const changed = Object.values(after).filter(
    (entry) => before[entry.game.id] !== entry
  );
  const gone = Object.values(before).filter(
    (entry) => !(entry.game.id in after)
  );
  await Promise.all([
    changed.length > 0 && AsyncStorage.multiSet(toRows(changed)),
    gone.length > 0 && AsyncStorage.multiRemove(gone.map(entryKey)),
  ]);
}

/** Puts a library in place of whatever is stored, even what cannot be read. */
export async function replaceLibrary(library: Library) {
  await AsyncStorage.multiRemove([LEGACY_KEY, ...(await storedKeys())]);
  await AsyncStorage.multiSet(toRows(Object.values(library)));
}
