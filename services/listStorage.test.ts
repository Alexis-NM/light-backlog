import { beforeEach, describe, expect, mock, test } from "bun:test";
import type { GameList } from "@/core/game";

// In-memory AsyncStorage: the real one needs React Native.
const store = new Map<string, string>();
let failWrites = false;
let failReads = false;
const write = (pairs: [string, string][]) => {
  if (failWrites) {
    return Promise.reject(new Error("Disk full"));
  }
  for (const [key, value] of pairs) {
    store.set(key, value);
  }
  return Promise.resolve();
};
const fakeStorage = {
  getItem: (key: string) => Promise.resolve(store.get(key) ?? null),
  setItem: (key: string, value: string) => write([[key, value]]),
  removeItem: (key: string) => {
    store.delete(key);
    return Promise.resolve();
  },
  multiGet: (keys: string[]) =>
    failReads
      ? Promise.reject(new Error("Row too big to fit into CursorWindow"))
      : Promise.resolve(keys.map((key) => [key, store.get(key) ?? null])),
  multiSet: write,
  multiRemove: (keys: string[]) => {
    for (const key of keys) {
      store.delete(key);
    }
    return Promise.resolve();
  },
};
mock.module("@react-native-async-storage/async-storage", () => ({
  default: fakeStorage,
}));

const { loadLists } = await import("./listStorage");

const zelda = { id: 1, name: "Zelda" };
const mario = { id: 2, name: "Mario" };

/** As stored by version 1.4. */
const oldLists = [
  {
    id: "list_b",
    name: "Next",
    createdAt: 1000,
    gameIds: [2, 1],
    games: { 1: zelda, 2: mario },
  },
  { id: "list_a", name: "Done", createdAt: 500, gameIds: [], games: {} },
];

const stored = (key: string) => JSON.parse(store.get(key) ?? "null");

const storeOldLists = () => {
  store.set("lists:order", JSON.stringify(["list_b", "list_a"]));
  for (const list of oldLists) {
    store.set(`list:${list.id}`, JSON.stringify(list));
  }
};

beforeEach(() => {
  store.clear();
  failWrites = false;
  failReads = false;
});

describe("loadLists", () => {
  test("converts the lists of version 1.4, keeping their order", async () => {
    storeOldLists();
    const lists = await loadLists();
    expect(lists.map((list) => [list.id, list.position])).toEqual([
      ["list_b", 0],
      ["list_a", 1],
    ]);
    expect(lists[0].items).toEqual({
      1: { addedAt: 1000, game: zelda },
      2: { addedAt: 1001, game: mario },
    });
    expect(stored("list:list_b")).toEqual(lists[0]);
    expect(stored("list:list_a")).toEqual(lists[1]);
    expect(stored("lists:order")).toEqual(["list_b", "list_a"]);
  });

  test("converts the single key of version 1.2 and older", async () => {
    store.set("lists", JSON.stringify(oldLists));
    const lists = await loadLists();
    expect(lists.map((list) => list.id)).toEqual(["list_b", "list_a"]);
    expect(store.has("lists")).toBe(false);
    expect(stored("lists:order")).toEqual(["list_b", "list_a"]);
    expect(stored("list:list_b")).toEqual(lists[0]);
  });

  test("returns converted lists by position, as stored", async () => {
    const converted: GameList[] = [
      {
        id: "list_x",
        name: "X",
        createdAt: 1,
        updatedAt: 9,
        position: 3,
        items: {},
      },
      {
        id: "list_y",
        name: "Y",
        createdAt: 1,
        updatedAt: 9,
        position: -2,
        items: { 1: { addedAt: 5, game: zelda } },
      },
    ];
    store.set("lists:order", JSON.stringify(["list_x", "list_y"]));
    for (const list of converted) {
      store.set(`list:${list.id}`, JSON.stringify(list));
    }
    expect(await loadLists()).toEqual([converted[1], converted[0]]);
  });

  test("still shows the lists when saving the conversion fails, and converts them the same way next time", async () => {
    storeOldLists();
    failWrites = true;
    const first = await loadLists();
    expect(first.map((list) => list.id)).toEqual(["list_b", "list_a"]);
    expect(stored("list:list_b")).toEqual(oldLists[0]);

    failWrites = false;
    expect(await loadLists()).toEqual(first);
    expect(stored("list:list_b")).toEqual(first[0]);
  });

  test("fails, rather than give no lists, when they cannot be read, and leaves them stored", async () => {
    storeOldLists();
    failReads = true;
    await expect(loadLists()).rejects.toThrow("Row too big");
    expect(stored("lists:order")).toEqual(["list_b", "list_a"]);
    expect(stored("list:list_b")).toEqual(oldLists[0]);
  });
});
