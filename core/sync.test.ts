import { describe, expect, test } from "bun:test";
import type { Game } from "./game";
import {
  entryKey,
  itemKey,
  listKey,
  markDeleted,
  mergeLatest,
  parseSyncRequest,
  parseSyncResponse,
  SYNC_VERSION,
  type SyncEntry,
  SyncError,
  type SyncItem,
  type SyncList,
  supersedes,
} from "./sync";

const zelda: Game = {
  id: 7346,
  name: "The Legend of Zelda: Breath of the Wild",
  coverUrl: "https://images.igdb.com/igdb/image/upload/t_cover_big/co3p2d.jpg",
  year: 2017,
  platforms: [{ id: 130, name: "Nintendo Switch" }],
  igdbRating: 92,
  igdbUserRating: 90,
  igdbCriticRating: null,
};

const mario: Game = { id: 119_388, name: "Super Mario Odyssey" };

const entry: SyncEntry = {
  game: zelda,
  status: "playing",
  rating: 4.5,
  platforms: ["Nintendo Switch"],
  addedAt: 1_700_000_000_000,
  updatedAt: 1_700_000_500_000,
};

const list: SyncList = {
  id: "list_1700000000000_k3j9x2",
  name: "Favoris",
  consoles: ["Nintendo Switch"],
  sort: "recent",
  position: 0,
  createdAt: 1_700_000_000_000,
  updatedAt: 1_700_000_200_000,
};

const item: SyncItem = {
  listId: list.id,
  game: zelda,
  addedAt: 1_700_000_100_000,
  updatedAt: 1_700_000_100_000,
};

const changes = { entries: [entry], lists: [list], items: [item] };

/** Through JSON, as over the wire: undefined fields disappear. */
const wire = (value: unknown): unknown => JSON.parse(JSON.stringify(value));

const request = (extra: Record<string, unknown> = {}) =>
  wire({ version: SYNC_VERSION, cursor: 42, changes, ...extra });

const withChanges = (patch: Record<string, unknown>) =>
  request({ changes: { ...changes, ...patch } });

function errorOf(run: () => unknown): SyncError {
  try {
    run();
  } catch (error) {
    if (error instanceof SyncError) {
      return error;
    }
    throw error;
  }
  throw new Error("Expected a SyncError.");
}

describe("supersedes", () => {
  test("a more recent change wins, an older one loses", () => {
    expect(supersedes({ updatedAt: 2 }, { updatedAt: 1 })).toBe(true);
    expect(supersedes({ updatedAt: 1 }, { updatedAt: 2 })).toBe(false);
  });

  test("on a tie, the element already there stays, as on the server", () => {
    expect(supersedes({ updatedAt: 2 }, { updatedAt: 2 })).toBe(false);
  });

  test("anything wins over nothing", () => {
    expect(supersedes({ updatedAt: 0 }, undefined)).toBe(true);
  });
});

describe("markDeleted", () => {
  test("keeps the element whole and dates the deletion", () => {
    const deleted = markDeleted(entry, entry.updatedAt + 1000);
    expect(deleted).toEqual({
      ...entry,
      deletedAt: entry.updatedAt + 1000,
      updatedAt: entry.updatedAt + 1000,
    });
  });

  test("a deletion beats older changes and loses to newer ones", () => {
    const deleted = markDeleted(entry, entry.updatedAt + 1000);
    const readded = { ...entry, updatedAt: entry.updatedAt + 2000 };
    expect(supersedes(deleted, entry)).toBe(true);
    expect(supersedes(readded, deleted)).toBe(true);
    expect(supersedes(entry, deleted)).toBe(false);
  });
});

describe("mergeLatest", () => {
  const versions = [
    { ...entry, status: "backlog" as const, updatedAt: 10 },
    { ...entry, status: "played" as const, updatedAt: 30 },
    { ...entry, status: "playing" as const, updatedAt: 20 },
    { ...entry, game: mario, updatedAt: 5 },
  ];

  test("keeps the latest version of each element, whatever the order", () => {
    const forward = mergeLatest(new Map(), versions, entryKey);
    const backward = mergeLatest(new Map(), [...versions].reverse(), entryKey);
    expect(forward).toEqual(backward);
    expect(forward.get(String(zelda.id))?.status).toBe("played");
    expect(forward.size).toBe(2);
  });

  test("keeps the current element on a tie and leaves the current map as it is", () => {
    const current = new Map([[entryKey(entry), entry]]);
    const tied = { ...entry, status: "wishlist" as const };
    const merged = mergeLatest(current, [tied], entryKey);
    expect(merged.get(entryKey(entry))).toBe(entry);
    expect(current.get(entryKey(entry))).toBe(entry);
  });

  test("keys a list item by its list and its game", () => {
    const other = { ...item, listId: "list_2" };
    expect(itemKey(item)).not.toBe(itemKey(other));
    expect(itemKey(item)).not.toBe(itemKey({ ...item, game: mario }));
    expect(listKey(list)).toBe(list.id);
  });
});

describe("parseSyncRequest", () => {
  test("accepts a request as it comes over the wire", () => {
    const body = request();
    expect(parseSyncRequest(body)).toEqual(body as never);
  });

  test("accepts the first sync and empty changes", () => {
    const empty = { entries: [], lists: [], items: [] };
    expect(parseSyncRequest(request({ cursor: 0, changes: empty }))).toEqual({
      version: SYNC_VERSION,
      cursor: 0,
      changes: empty,
    });
  });

  test("accepts deleted elements, sent whole with deletedAt", () => {
    const later = 1_700_001_000_000;
    const body = withChanges({
      entries: [markDeleted(entry, later)],
      lists: [markDeleted(list, later)],
      items: [markDeleted(item, later)],
    });
    expect(parseSyncRequest(body).changes.entries[0].deletedAt).toBe(later);
  });

  test("accepts a game whose IGDB ratings are not fetched yet", () => {
    const body = withChanges({ entries: [{ ...entry, game: mario }] });
    expect(parseSyncRequest(body).changes.entries[0].game).toEqual(mario);
  });

  test("lets unknown fields through, so that additions keep the version", () => {
    const body = request({
      device: "LPIII",
      changes: { ...changes, entries: [{ ...entry, note: "100 %" }] },
    });
    expect(() => parseSyncRequest(body)).not.toThrow();
  });

  test("tells another version apart, for a 409", () => {
    expect(errorOf(() => parseSyncRequest(request({ version: 2 }))).kind).toBe(
      "version"
    );
    expect(
      errorOf(() => parseSyncRequest({ version: 2, changes: "new format" }))
        .kind
    ).toBe("version");
  });

  test.each([
    ["no body", null],
    ["an array", []],
    ["no version", { cursor: 0, changes }],
    ["a version as text", { version: "1", cursor: 0, changes }],
    ["a negative cursor", { version: SYNC_VERSION, cursor: -1, changes }],
    ["a cursor with decimals", { version: SYNC_VERSION, cursor: 1.5, changes }],
    ["no changes", { version: SYNC_VERSION, cursor: 0 }],
    [
      "changes without items",
      { version: SYNC_VERSION, cursor: 0, changes: { entries: [], lists: [] } },
    ],
  ])("rejects %s", (_, body) => {
    expect(errorOf(() => parseSyncRequest(wire(body))).kind).toBe("invalid");
  });

  // One case per constraint of the server's database.
  test.each([
    ["a game id of 0", { entries: [{ ...entry, game: { ...zelda, id: 0 } }] }],
    [
      "a game id beyond 32 bits",
      { entries: [{ ...entry, game: { ...zelda, id: 2 ** 31 } }] },
    ],
    [
      "a game without a name",
      { entries: [{ ...entry, game: { id: zelda.id } }] },
    ],
    [
      "only some IGDB ratings",
      {
        entries: [{ ...entry, game: { ...zelda, igdbUserRating: undefined } }],
      },
    ],
    [
      "a game platform without an id",
      {
        entries: [
          { ...entry, game: { ...zelda, platforms: [{ name: "Switch" }] } },
        ],
      },
    ],
    ["an unknown status", { entries: [{ ...entry, status: "dropped" }] }],
    ["a rating between halves", { entries: [{ ...entry, rating: 4.3 }] }],
    ["a rating above 5", { entries: [{ ...entry, rating: 5.5 }] }],
    ["platforms as numbers", { entries: [{ ...entry, platforms: [130] }] }],
    ["no platforms", { entries: [{ ...entry, platforms: undefined }] }],
    ["an empty list id", { lists: [{ ...list, id: "" }] }],
    ["an empty consoles list", { lists: [{ ...list, consoles: [] }] }],
    ["consoles set to null", { lists: [{ ...list, consoles: null }] }],
    ["a sort lists do not offer", { lists: [{ ...list, sort: "rating" }] }],
    ["a position with decimals", { lists: [{ ...list, position: 0.5 }] }],
    [
      "a list without createdAt",
      { lists: [{ ...list, createdAt: undefined }] },
    ],
    ["an item without its list", { items: [{ ...item, listId: "" }] }],
    ["an item without its game", { items: [{ ...item, game: undefined }] }],
    [
      "a date as text",
      { entries: [{ ...entry, updatedAt: "2026-11-18T10:00:00Z" }] },
    ],
    [
      "a date with a fraction of a millisecond",
      { entries: [{ ...entry, updatedAt: 1_700_000_000_000.5 }] },
    ],
    ["a negative date", { items: [{ ...item, addedAt: -1 }] }],
    ["deletedAt set to null", { lists: [{ ...list, deletedAt: null }] }],
    [
      "a deletion dated after the last change",
      { entries: [{ ...entry, deletedAt: entry.updatedAt + 1 }] },
    ],
  ])("rejects %s", (_, patch) => {
    expect(errorOf(() => parseSyncRequest(withChanges(patch))).kind).toBe(
      "invalid"
    );
  });

  test("rejects an element sent twice in one batch", () => {
    const twice = withChanges({
      entries: [entry, { ...entry, updatedAt: entry.updatedAt + 1 }],
    });
    expect(errorOf(() => parseSyncRequest(twice)).message).toBe(
      `changes.entries[1] repeats ${zelda.id}.`
    );
    const sameItem = withChanges({ items: [item, { ...item }] });
    expect(errorOf(() => parseSyncRequest(sameItem)).kind).toBe("invalid");
  });

  test("accepts the same game in two lists", () => {
    const body = withChanges({ items: [item, { ...item, listId: "list_2" }] });
    expect(parseSyncRequest(body).changes.items).toHaveLength(2);
  });

  test("names the faulty element", () => {
    const body = withChanges({
      lists: [list, { ...list, id: "list_2", position: 0.5 }],
    });
    expect(errorOf(() => parseSyncRequest(body)).message).toBe(
      "changes.lists[1] is invalid."
    );
  });
});

describe("parseSyncResponse", () => {
  test("accepts a response as it comes over the wire", () => {
    const body = wire({ cursor: 57, more: true, changes });
    expect(parseSyncResponse(body)).toEqual(body as never);
  });

  test.each([
    ["no more", { cursor: 57, changes }],
    ["more as text", { cursor: 57, more: "false", changes }],
    ["a negative cursor", { cursor: -1, more: false, changes }],
    [
      "an invalid element",
      {
        cursor: 57,
        more: false,
        changes: { ...changes, lists: [{ ...list, sort: "rating" }] },
      },
    ],
  ])("rejects %s", (_, body) => {
    expect(errorOf(() => parseSyncResponse(wire(body))).kind).toBe("invalid");
  });
});
