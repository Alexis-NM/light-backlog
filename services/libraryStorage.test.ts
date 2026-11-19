import { beforeEach, describe, expect, mock, test } from "bun:test";
import type { LibraryEntry } from "@/core/game";

// In-memory AsyncStorage: the real one needs React Native.
const store = new Map<string, string>();
/** Each write and removal, as asked. */
let calls: [string, string[]][] = [];
let failWrites = false;
let unreadable: string | null = null;

const read = (key: string) => {
  if (key === unreadable) {
    throw new Error("Row too big to fit into CursorWindow");
  }
  return store.get(key) ?? null;
};
const fakeStorage = {
  getItem: async (key: string) => read(key),
  getAllKeys: () => Promise.resolve([...store.keys()]),
  multiGet: async (keys: string[]) => keys.map((key) => [key, read(key)]),
  multiSet: (pairs: [string, string][]) => {
    calls.push(["set", pairs.map(([key]) => key)]);
    if (failWrites) {
      return Promise.reject(new Error("Disk full"));
    }
    for (const [key, value] of pairs) {
      store.set(key, value);
    }
    return Promise.resolve();
  },
  multiRemove: (keys: string[]) => {
    calls.push(["remove", keys]);
    for (const key of keys) {
      store.delete(key);
    }
    return Promise.resolve();
  },
  removeItem: (key: string) => {
    store.delete(key);
    return Promise.resolve();
  },
};
mock.module("@react-native-async-storage/async-storage", () => ({
  default: fakeStorage,
}));

const { loadLibrary, replaceLibrary, saveLibraryChanges } = await import(
  "./libraryStorage"
);

const entry = (
  id: number,
  extra: Partial<LibraryEntry> = {}
): LibraryEntry => ({
  game: { id, name: `Game ${id}` },
  status: "backlog",
  rating: 0,
  platforms: [],
  addedAt: 1000,
  updatedAt: 2000,
  ...extra,
});

const libraryOf = (...entries: LibraryEntry[]) =>
  Object.fromEntries(entries.map((one) => [one.game.id, one]));

const stored = (key: string) => JSON.parse(store.get(key) ?? "null");

/** As stored by version 1.9 and older: the whole library under one key. */
const storeOldLibrary = (...entries: LibraryEntry[]) =>
  store.set("library", JSON.stringify(libraryOf(...entries)));

beforeEach(() => {
  store.clear();
  calls = [];
  failWrites = false;
  unreadable = null;
});

describe("loadLibrary", () => {
  test("gives an empty library when nothing is stored", async () => {
    store.set("list:list_a", "{}");
    expect(await loadLibrary()).toEqual({});
  });

  test("converts the single key of version 1.9, losing no entry", async () => {
    const old = [entry(1, { rating: 4.5 }), entry(2, { status: "played" })];
    storeOldLibrary(...old);
    expect(await loadLibrary()).toEqual(libraryOf(...old));
    expect(stored("entry:1")).toEqual(old[0]);
    expect(stored("entry:2")).toEqual(old[1]);
    expect(store.has("library")).toBe(false);
  });

  test("reads back the entries stored one by one, and nothing else", async () => {
    store.set("entry:7", JSON.stringify(entry(7)));
    store.set("entry:12", JSON.stringify(entry(12)));
    store.set("list:list_a", "{}");
    store.set("library_sort", '"alpha"');
    expect(await loadLibrary()).toEqual(libraryOf(entry(7), entry(12)));
  });

  test("starts the conversion over when it was interrupted", async () => {
    storeOldLibrary(entry(1), entry(2));
    failWrites = true;
    await expect(loadLibrary()).rejects.toThrow("Disk full");
    expect(store.has("library")).toBe(true);

    failWrites = false;
    expect(await loadLibrary()).toEqual(libraryOf(entry(1), entry(2)));
    expect(store.has("library")).toBe(false);
  });

  test("keeps the entries already converted when an older version wrote its key again", async () => {
    store.set("entry:1", JSON.stringify(entry(1, { rating: 3 })));
    store.set("entry:2", JSON.stringify(entry(2)));
    // The older version saw an empty library, and a game was added there.
    storeOldLibrary(entry(1, { rating: 5 }), entry(3));
    expect(await loadLibrary()).toEqual(
      libraryOf(entry(1, { rating: 5 }), entry(2), entry(3))
    );
  });

  test("fails, rather than give an empty library, when the old key cannot be read", async () => {
    storeOldLibrary(entry(1));
    unreadable = "library";
    await expect(loadLibrary()).rejects.toThrow("Row too big");
    expect(stored("library")).toEqual(libraryOf(entry(1)));
    expect(calls).toEqual([]);
  });

  test("fails, rather than leave an entry out, when one cannot be read", async () => {
    store.set("entry:1", JSON.stringify(entry(1)));
    store.set("entry:2", "{not json");
    await expect(loadLibrary()).rejects.toThrow();
    expect(store.get("entry:2")).toBe("{not json");
    expect(calls).toEqual([]);
  });
});

describe("saveLibraryChanges", () => {
  test("writes only the entries that changed, and removes the ones gone", async () => {
    const [one, two, three] = [entry(1), entry(2), entry(3)];
    const before = libraryOf(one, two, three);
    await replaceLibrary(before);
    calls = [];

    const rated = { ...two, rating: 4 };
    const four = entry(4);
    await saveLibraryChanges(before, libraryOf(one, rated, four));

    expect(calls).toEqual([
      ["set", ["entry:2", "entry:4"]],
      ["remove", ["entry:3"]],
    ]);
    expect(await loadLibrary()).toEqual(libraryOf(one, rated, four));
  });

  test("asks nothing of the storage when nothing changed", async () => {
    const library = libraryOf(entry(1));
    await saveLibraryChanges(library, library);
    expect(calls).toEqual([]);
  });

  test("fails when the storage refuses the write", async () => {
    failWrites = true;
    await expect(saveLibraryChanges({}, libraryOf(entry(1)))).rejects.toThrow(
      "Disk full"
    );
  });
});

describe("replaceLibrary", () => {
  test("puts the library in place of what was stored, old key included", async () => {
    storeOldLibrary(entry(9));
    store.set("entry:1", JSON.stringify(entry(1)));
    store.set("entry:2", "{not json");
    store.set("list:list_a", "{}");

    await replaceLibrary(libraryOf(entry(5)));

    expect(await loadLibrary()).toEqual(libraryOf(entry(5)));
    expect([...store.keys()].sort()).toEqual(["entry:5", "list:list_a"]);
  });
});
