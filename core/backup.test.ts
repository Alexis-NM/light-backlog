import { describe, expect, test } from "bun:test";
import {
  BACKUP_VERSION,
  type Backup,
  parseBackup,
  serializeBackup,
} from "./backup";
import type { GameList, LibraryEntry } from "./game";

const zelda = { id: 1, name: "Zelda" };
const mario = { id: 2, name: "Mario" };

const entry: LibraryEntry = {
  game: zelda,
  status: "playing",
  rating: 8,
  platforms: ["Nintendo Switch"],
  addedAt: 100,
  updatedAt: 200,
};

/** As exported by version 1.4: lists in display order. */
const v1Backup = {
  app: "backlog",
  version: 1,
  exportedAt: "2026-11-01T10:00:00.000Z",
  library: { 1: entry },
  lists: [
    {
      id: "list_b",
      name: "Next",
      createdAt: 1000,
      gameIds: [2, 1],
      games: { 1: zelda, 2: mario },
      consoles: ["Nintendo Switch"],
      sort: "igdb",
    },
    { id: "list_a", name: "Done", createdAt: 500, gameIds: [], games: {} },
  ],
  settings: { language: "fr", listSort: "recent" },
};

const v2List: GameList = {
  id: "list_c",
  name: "Wishlist",
  createdAt: 1000,
  updatedAt: 3000,
  position: -1,
  items: {
    1: { addedAt: 2000, game: zelda },
    2: { addedAt: 2500, game: mario },
  },
  consoles: ["Nintendo Switch"],
  sort: "alpha",
};

const v2Backup = (lists: unknown[]) => ({
  ...v1Backup,
  version: 2,
  lists,
});

const parse = (data: unknown) => parseBackup(JSON.stringify(data));

const expectRejected = (data: unknown) =>
  expect(() => parse(data)).toThrow("Not a Backlog backup.");

describe("parseBackup, version 1", () => {
  test("comes out in the current format, with the lists converted", () => {
    const backup = parse(v1Backup);
    expect(backup.version).toBe(BACKUP_VERSION);
    expect(backup.lists).toEqual([
      {
        id: "list_b",
        name: "Next",
        createdAt: 1000,
        updatedAt: 1000,
        position: 0,
        items: {
          1: { addedAt: 1000, game: zelda },
          2: { addedAt: 1001, game: mario },
        },
        consoles: ["Nintendo Switch"],
        sort: "igdb",
      },
      {
        id: "list_a",
        name: "Done",
        createdAt: 500,
        updatedAt: 500,
        position: 1,
        items: {},
      },
    ]);
  });

  test("keeps the library and the settings", () => {
    const backup = parse(v1Backup);
    expect(backup.library).toEqual({ 1: entry });
    expect(backup.settings).toMatchObject({
      language: "fr",
      listSort: "recent",
    });
  });

  test("keeps a list without createdAt, as the oldest", () => {
    const { createdAt, ...noDate } = v1Backup.lists[0];
    const [list] = parse({ ...v1Backup, lists: [noDate] }).lists;
    expect(list.createdAt).toBe(0);
    expect(list.items[1].addedAt).toBe(0);
    expect(list.items[2].addedAt).toBe(1);
  });

  test("rejects a list without gameIds, as before", () => {
    const { gameIds, ...broken } = v1Backup.lists[0];
    expectRejected({ ...v1Backup, lists: [broken] });
  });
});

describe("parseBackup, version 2", () => {
  test("reads back what was exported", () => {
    const backup: Backup = {
      app: "backlog",
      version: BACKUP_VERSION,
      exportedAt: "2026-11-18T10:00:00.000Z",
      library: { 1: entry },
      lists: [v2List],
      settings: { invertColors: true, librarySort: "rating" },
      credentials: { clientId: "id", clientSecret: "secret" },
    };
    expect(parseBackup(serializeBackup(backup))).toEqual(backup);
  });

  test("drops invalid consoles or sort and keeps the list", () => {
    const [list] = parse(
      v2Backup([{ ...v2List, consoles: "Nintendo Switch", sort: "rating" }])
    ).lists;
    expect(list.consoles).toBeUndefined();
    expect(list.sort).toBeUndefined();
    expect(list.items).toEqual(v2List.items);
  });

  test("rejects a list without its dates or position", () => {
    for (const field of ["createdAt", "updatedAt", "position"]) {
      const { [field as keyof GameList]: _, ...broken } = v2List;
      expectRejected(v2Backup([broken]));
    }
  });

  test("rejects a game without a date or filed under another id", () => {
    expectRejected(v2Backup([{ ...v2List, items: { 1: { game: zelda } } }]));
    expectRejected(
      v2Backup([{ ...v2List, items: { 5: { addedAt: 1, game: zelda } } }])
    );
  });

  test("rejects a version 1 list in a version 2 file", () => {
    expectRejected(v2Backup([v1Backup.lists[0]]));
  });
});

test("rejects an unknown version", () => {
  expectRejected({ ...v1Backup, version: 3 });
});
