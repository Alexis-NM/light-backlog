import { describe, expect, test } from "bun:test";
import type { Game, GameList, LibraryEntry, ListItem } from "./game";
import {
  type Dated,
  entryKey,
  itemKey,
  listKey,
  parseSyncRequest,
  parseSyncResponse,
  type SyncEntry,
  type SyncItem,
  type SyncList,
  type SyncRequest,
  type SyncResponse,
} from "./sync";
import {
  addTombstones,
  checkConnection,
  createTransport,
  deletedEntries,
  deletedItems,
  deletedLists,
  type FetchLike,
  hasPendingChanges,
  isTransient,
  type LocalData,
  newSyncState,
  noChanges,
  pendingChanges,
  SyncFailure,
  type SyncFailureKind,
  type SyncState,
  type SyncTransport,
  syncEndpoint,
  syncOnce,
  toBatches,
} from "./syncClient";

// ---------------------------------------------------------------------------
// A server that behaves like the site's lib/sync.ts

interface Row<T> {
  element: T;
  seq: number;
}

/** Through JSON, as over the wire. */
const wire = <T>(value: T): T => JSON.parse(JSON.stringify(value));

function fakeServer(pageSize = 500) {
  let seq = 0;
  const games = new Map<number, Game>();
  const tables = {
    entries: new Map<string, Row<SyncEntry>>(),
    lists: new Map<string, Row<SyncList>>(),
    items: new Map<string, Row<SyncItem>>(),
  };
  const requests: SyncRequest[] = [];

  // An insert takes a number even when the row stays (see next_seq()).
  const upsert = <T extends Dated>(
    table: Map<string, Row<T>>,
    key: string,
    element: T
  ) => {
    seq += 1;
    const row = table.get(key);
    if (!row || element.updatedAt > row.element.updatedAt) {
      table.set(key, { element, seq });
    }
  };

  const withGame = <T extends { game: Game }>(element: T): T => ({
    ...element,
    game: games.get(element.game.id) ?? element.game,
  });

  function read(cursor: number): SyncResponse {
    const after = <T>(table: Map<string, Row<T>>) =>
      [...table.values()].filter((row) => row.seq > cursor);
    const changes = [
      ...after(tables.entries).map((row) => ({ ...row, kind: "entries" })),
      ...after(tables.lists).map((row) => ({ ...row, kind: "lists" })),
      ...after(tables.items).map((row) => ({ ...row, kind: "items" })),
    ].sort((a, b) => a.seq - b.seq);
    const page = changes.slice(0, pageSize);
    const of = <T>(kind: string) =>
      page.filter((row) => row.kind === kind).map((row) => row.element as T);
    return parseSyncResponse(
      wire({
        cursor: page.at(-1)?.seq ?? cursor,
        more: changes.length > pageSize,
        changes: {
          entries: of<SyncEntry>("entries").map(withGame),
          lists: of<SyncList>("lists"),
          items: of<SyncItem>("items").map(withGame),
        },
      })
    );
  }

  const post: SyncTransport = (request) => {
    requests.push(request);
    const { cursor, changes } = parseSyncRequest(wire(request));
    // One transaction: a game whose list is unknown fails the whole batch.
    const lists = new Set([
      ...tables.lists.keys(),
      ...changes.lists.map(listKey),
    ]);
    if (changes.items.some((item) => !lists.has(item.listId))) {
      return Promise.reject(new SyncFailure("rejected", "Unknown list."));
    }
    // A field the sender lacks stays known; IGDB ratings never go back.
    for (const { game } of [...changes.entries, ...changes.items]) {
      games.set(game.id, { ...games.get(game.id), ...game });
    }
    for (const list of changes.lists) {
      upsert(tables.lists, listKey(list), list);
    }
    for (const entry of changes.entries) {
      upsert(tables.entries, entryKey(entry), entry);
    }
    for (const item of changes.items) {
      upsert(tables.items, itemKey(item), item);
    }
    return Promise.resolve(read(cursor));
  };

  const live = <T extends Dated>(table: Map<string, Row<T>>) =>
    [...table.values()]
      .map((row) => row.element)
      .filter((element) => element.deletedAt === undefined);

  return { post, requests, tables, games, live };
}

type FakeServer = ReturnType<typeof fakeServer>;

// ---------------------------------------------------------------------------
// Devices

interface Device {
  local: LocalData;
  state: SyncState | null;
}

const device = (local: LocalData = { library: {}, lists: [] }): Device => ({
  local,
  state: newSyncState(),
});

const sync = (target: Device, server: FakeServer, batchSize?: number) =>
  syncOnce(
    {
      getLocal: () => target.local,
      getState: () => target.state,
      commit: (local, state) => {
        target.local = local;
        target.state = state;
      },
      post: server.post,
      now: () => 1_000_000,
    },
    batchSize
  );

const game = (id: number, extra: Partial<Game> = {}): Game => ({
  id,
  name: `Game ${id}`,
  ...extra,
});

const entry = (
  id: number,
  updatedAt: number,
  extra: Partial<LibraryEntry> = {}
): LibraryEntry => ({
  game: game(id),
  status: "backlog",
  rating: 0,
  platforms: [],
  addedAt: updatedAt,
  updatedAt,
  ...extra,
});

const item = (id: number, addedAt: number): ListItem => ({
  addedAt,
  game: game(id),
});

const list = (
  id: string,
  position: number,
  items: ListItem[] = [],
  extra: Partial<GameList> = {}
): GameList => ({
  id,
  name: `List ${id}`,
  createdAt: 1000,
  updatedAt: 1000,
  position,
  items: Object.fromEntries(items.map((one) => [one.game.id, one])),
  ...extra,
});

const libraryOf = (...entries: LibraryEntry[]) =>
  Object.fromEntries(entries.map((one) => [one.game.id, one]));

/** Two entries and two lists, one of them with two games. */
const sample = (): LocalData => ({
  library: libraryOf(
    entry(1, 2000, { status: "playing" }),
    entry(2, 2100, { rating: 4.5, platforms: ["PC"] })
  ),
  lists: [
    list("list_a", 0, [item(1, 1500), item(3, 1600)], { sort: "recent" }),
    list("list_b", 1, [], { consoles: ["Wii"] }),
  ],
});

const deleteEntry = (target: Device, id: number, now: number) => {
  const { [id]: removed, ...rest } = target.local.library;
  target.local = { ...target.local, library: rest };
  if (target.state && removed) {
    target.state = {
      ...target.state,
      tombstones: addTombstones(
        target.state.tombstones,
        deletedEntries([removed], now)
      ),
    };
  }
};

const editEntry = (
  target: Device,
  id: number,
  patch: Partial<LibraryEntry>
) => {
  target.local = {
    ...target.local,
    library: {
      ...target.local.library,
      [id]: { ...target.local.library[id], ...patch },
    },
  };
};

const count = ({ changes }: { changes: { [kind: string]: unknown[] } }) =>
  Object.values(changes).reduce(
    (total, elements) => total + elements.length,
    0
  );

// ---------------------------------------------------------------------------

describe("pendingChanges", () => {
  test("at first, everything is to send", () => {
    const { changes, skipped } = pendingChanges(sample(), newSyncState());
    expect(changes.entries).toHaveLength(2);
    expect(changes.lists).toHaveLength(2);
    expect(changes.items).toHaveLength(2);
    expect(skipped).toBe(0);
  });

  test("tells whether anything waits to be sent", async () => {
    const server = fakeServer();
    const phone = device(sample());
    const waits = () =>
      hasPendingChanges(phone.local, phone.state as SyncState);
    expect(waits()).toBe(true);
    await sync(phone, server);
    expect(waits()).toBe(false);
    deleteEntry(phone, 1, 9000);
    expect(waits()).toBe(true);
  });

  test("once synced, only what changed", async () => {
    const phone = device(sample());
    await sync(phone, fakeServer());
    editEntry(phone, 2, { status: "played", updatedAt: 5000 });
    const { changes } = pendingChanges(phone.local, phone.state as SyncState);
    expect(changes.entries.map((one) => one.game.id)).toEqual([2]);
    expect(changes.lists).toHaveLength(0);
    expect(changes.items).toHaveLength(0);
  });

  test("an element deleted and added again goes out alive", () => {
    const state: SyncState = {
      ...newSyncState(),
      tombstones: addTombstones(
        noChanges(),
        deletedEntries([entry(1, 2000)], 3000)
      ),
    };
    const local = { library: libraryOf(entry(1, 4000)), lists: [] };
    const { changes } = pendingChanges(local, state);
    expect(changes.entries).toHaveLength(1);
    expect(changes.entries[0].deletedAt).toBeUndefined();
  });

  test("leaves out an invalid element, and the games of an invalid list", () => {
    const local: LocalData = {
      library: libraryOf(entry(1, 2000), {
        ...entry(2, 2000),
        rating: 4.3,
      }),
      lists: [
        list("list_a", 0.5, [item(1, 1500)]),
        list("list_b", 1, [item(2, 1500)]),
      ],
    };
    const { changes, skipped } = pendingChanges(local, newSyncState());
    expect(changes.entries.map((one) => one.game.id)).toEqual([1]);
    expect(changes.lists.map((one) => one.id)).toEqual(["list_b"]);
    expect(changes.items.map((one) => one.listId)).toEqual(["list_b"]);
    expect(skipped).toBe(2);
  });

  test("sends a game without the fields it cannot send", () => {
    const odd = { ...game(1), year: "2017", extra: true } as unknown as Game;
    const local = { library: libraryOf({ ...entry(1, 2000), game: odd }) };
    const { changes } = pendingChanges({ ...local, lists: [] }, newSyncState());
    expect(changes.entries[0].game).toEqual(game(1));
  });
});

describe("toBatches", () => {
  const lists = [list("a", 0), list("b", 1), list("c", 2)].map((one) => ({
    id: one.id,
    name: one.name,
    position: one.position,
    createdAt: 1,
    updatedAt: 1,
  }));
  const entries = [1, 2, 3, 4, 5].map((id) => ({
    game: game(id),
    status: "backlog" as const,
    rating: 0,
    platforms: [],
    addedAt: 1,
    updatedAt: 1,
  }));
  const items = [6, 7, 8, 9].map((id) => ({
    listId: "a",
    game: game(id),
    addedAt: 1,
    updatedAt: 1,
  }));

  test("puts every list in the first request, then fills them up to the size", () => {
    const batches = toBatches({ entries, lists, items }, 4);
    expect(batches[0].lists).toHaveLength(3);
    expect(batches.map((batch) => count({ changes: { ...batch } }))).toEqual([
      4, 4, 4,
    ]);
    expect(batches.flatMap((batch) => batch.items)).toEqual(items);
  });

  test("makes no request body when there is nothing to send", () => {
    expect(toBatches(noChanges(), 4)).toEqual([]);
  });
});

describe("syncOnce", () => {
  test("fills an empty server, then has nothing left to send", async () => {
    const server = fakeServer();
    const phone = device(sample());
    const before = phone.local;

    const first = await sync(phone, server, 2);
    expect(first.sent).toBe(6);
    expect(server.live(server.tables.entries)).toHaveLength(2);
    expect(server.live(server.tables.items)).toHaveLength(2);
    // The echo changes nothing: the local data keeps its objects.
    expect(phone.local).toEqual(before);
    expect(phone.local.library).toBe(before.library);
    expect(phone.local.lists).toBe(before.lists);

    const second = await sync(phone, server);
    expect(second).toEqual({ received: 0, sent: 0, skipped: 0 });
  });

  test("a new device gets everything, over several pages", async () => {
    const server = fakeServer(3);
    const phone = device(sample());
    await sync(phone, server);
    const tablet = device();
    await sync(tablet, server);
    expect(tablet.local).toEqual(phone.local);
    expect(server.requests.length).toBeGreaterThan(3);
  });

  test("sends lists first, so that no batch is refused", async () => {
    const server = fakeServer();
    const lonely = {
      listId: "list_new",
      game: game(9),
      addedAt: 1,
      updatedAt: 1,
    };
    await expect(
      server.post({
        version: 1,
        cursor: 0,
        changes: { ...noChanges(), items: [lonely] },
      })
    ).rejects.toThrow("Unknown list.");

    const phone = device({
      library: {},
      lists: [list("list_new", 0, [item(9, 1), item(10, 2), item(11, 3)])],
    });
    await sync(phone, server, 1);
    expect(server.live(server.tables.items)).toHaveLength(3);
  });

  test("the most recent change wins, on both devices", async () => {
    const server = fakeServer();
    const phone = device(sample());
    await sync(phone, server);
    const tablet = device();
    await sync(tablet, server);

    editEntry(phone, 1, { status: "played", updatedAt: 5000 });
    editEntry(tablet, 1, { status: "wishlist", updatedAt: 6000 });
    await sync(phone, server);
    await sync(tablet, server);
    await sync(phone, server);

    expect(phone.local.library[1].status).toBe("wishlist");
    expect(tablet.local.library[1].status).toBe("wishlist");
    expect(
      pendingChanges(phone.local, phone.state as SyncState).changes
    ).toEqual(noChanges());
  });

  test("a deletion reaches the other device, and its marker goes once sent", async () => {
    const server = fakeServer();
    const phone = device(sample());
    await sync(phone, server);
    const tablet = device();
    await sync(tablet, server);

    deleteEntry(phone, 2, 7000);
    await sync(phone, server);
    expect(phone.state?.tombstones).toEqual(noChanges());
    expect(server.tables.entries.get("2")?.element.deletedAt).toBe(7000);

    await sync(tablet, server);
    expect(tablet.local.library[2]).toBeUndefined();
    expect(tablet.local.library[1]).toBeDefined();
  });

  test("a deletion made with the clock behind still reaches the server", async () => {
    const server = fakeServer();
    const tablet = device(sample());
    await sync(tablet, server);
    const phone = device();
    await sync(phone, server);

    // The tablet dated the entry 2100; the phone's clock says 1900.
    deleteEntry(phone, 2, 1900);
    await sync(phone, server);
    expect(server.tables.entries.get("2")?.element.deletedAt).toBe(2101);

    await sync(tablet, server);
    expect(tablet.local.library[2]).toBeUndefined();
  });

  test("a newer change elsewhere brings a deleted entry back", async () => {
    const server = fakeServer();
    const phone = device(sample());
    await sync(phone, server);
    const tablet = device();
    await sync(tablet, server);

    deleteEntry(phone, 2, 7000);
    editEntry(tablet, 2, { status: "played", updatedAt: 8000 });
    await sync(tablet, server);
    await sync(phone, server);

    expect(phone.local.library[2]?.status).toBe("played");
    expect(phone.state?.tombstones).toEqual(noChanges());
  });

  test("keeps a change made during the exchange, and sends it next time", async () => {
    const server = fakeServer();
    const phone = device(sample());
    let edited = false;
    await syncOnce({
      getLocal: () => phone.local,
      getState: () => phone.state,
      commit: (local, state) => {
        phone.local = local;
        phone.state = state;
      },
      post: (request) => {
        if (!edited) {
          edited = true;
          editEntry(phone, 1, { status: "played", updatedAt: 9000 });
        }
        return server.post(request);
      },
    });
    expect(phone.local.library[1].status).toBe("played");
    const { changes } = pendingChanges(phone.local, phone.state as SyncState);
    expect(changes.entries.map((one) => one.updatedAt)).toEqual([9000]);
  });

  test("a deletion made during the exchange stands against an older change", async () => {
    const server = fakeServer();
    const phone = device(sample());
    await sync(phone, server);
    const tablet = device();
    await sync(tablet, server);

    editEntry(tablet, 2, { status: "played", updatedAt: 6000 });
    await sync(tablet, server);
    await syncOnce({
      getLocal: () => phone.local,
      getState: () => phone.state,
      commit: (local, state) => {
        phone.local = local;
        phone.state = state;
      },
      post: async (request) => {
        const response = await server.post(request);
        deleteEntry(phone, 2, 7000);
        return response;
      },
    });

    expect(phone.local.library[2]).toBeUndefined();
    expect(phone.state?.tombstones.entries.map((one) => one.updatedAt)).toEqual(
      [7000]
    );
  });

  test("a list deleted elsewhere takes its games, even one added meanwhile", async () => {
    const server = fakeServer();
    const phone = device(sample());
    await sync(phone, server);
    const tablet = device();
    await sync(tablet, server);

    const [listA] = phone.local.lists;
    phone.local = { ...phone.local, lists: phone.local.lists.slice(1) };
    phone.state = {
      ...(phone.state as SyncState),
      tombstones: addTombstones(
        (phone.state as SyncState).tombstones,
        deletedLists([listA], 7000)
      ),
    };
    await sync(phone, server);

    tablet.local = {
      ...tablet.local,
      lists: tablet.local.lists.map((one) =>
        one.id === "list_a"
          ? { ...one, items: { ...one.items, 12: item(12, 8000) } }
          : one
      ),
    };
    await sync(tablet, server);
    await sync(phone, server);

    expect(tablet.local.lists.map((one) => one.id)).toEqual(["list_b"]);
    expect(phone.local.lists.map((one) => one.id)).toEqual(["list_b"]);
  });

  test("a game removed from a list leaves it on the other device", async () => {
    const server = fakeServer();
    const phone = device(sample());
    await sync(phone, server);
    const tablet = device();
    await sync(tablet, server);

    const [listA] = phone.local.lists;
    const { 3: removed, ...kept } = listA.items;
    phone.local = {
      ...phone.local,
      lists: [{ ...listA, items: kept }, ...phone.local.lists.slice(1)],
    };
    phone.state = {
      ...(phone.state as SyncState),
      tombstones: addTombstones(
        (phone.state as SyncState).tombstones,
        deletedItems(listA, [3], 7000)
      ),
    };
    expect(removed).toBeDefined();
    await sync(phone, server);
    await sync(tablet, server);

    expect(Object.keys(tablet.local.lists[0].items)).toEqual(["1"]);
  });

  test("keeps the IGDB ratings fetched here, which are never sent", async () => {
    const server = fakeServer();
    const phone = device({ library: libraryOf(entry(1, 2000)), lists: [] });
    await sync(phone, server);
    const tablet = device();
    await sync(tablet, server);

    // A ratings refresh is not a change: it stays on the tablet.
    const ratings = {
      igdbRating: 90,
      igdbUserRating: 85,
      igdbCriticRating: null,
    };
    editEntry(tablet, 1, { game: game(1, ratings) });
    editEntry(phone, 1, { status: "played", updatedAt: 5000 });
    await sync(phone, server);
    await sync(tablet, server);

    expect(tablet.local.library[1]).toMatchObject({
      status: "played",
      game: game(1, ratings),
    });
  });

  test("commits nothing once sync is turned off during the exchange", async () => {
    const server = fakeServer();
    const phone = device(sample());
    const result = await syncOnce({
      getLocal: () => phone.local,
      getState: () => phone.state,
      commit: () => {
        throw new Error("Nothing to commit.");
      },
      post: (request) => {
        phone.state = null;
        return server.post(request);
      },
    });
    expect(result.received).toBe(0);
  });

  test("offline, the changes wait for the next sync", async () => {
    const server = fakeServer();
    const phone = device(sample());
    const before = phone.state;
    const offline: SyncTransport = () =>
      Promise.reject(new SyncFailure("network", "Offline."));
    await expect(
      syncOnce({
        getLocal: () => phone.local,
        getState: () => phone.state,
        commit: () => {
          throw new Error("Nothing to commit.");
        },
        post: offline,
      })
    ).rejects.toThrow("Offline.");
    expect(phone.state).toBe(before);

    const next = await sync(phone, server);
    expect(next.sent).toBe(6);
  });

  test("fails rather than loop when the server does not move its cursor", async () => {
    const phone = device();
    const stuck: SyncTransport = (request) =>
      Promise.resolve({
        cursor: request.cursor,
        more: true,
        changes: noChanges(),
      });
    await expect(
      syncOnce({
        getLocal: () => phone.local,
        getState: () => phone.state,
        commit: () => undefined,
        post: stuck,
      })
    ).rejects.toThrow("did not move its cursor");
  });
});

describe("syncEndpoint", () => {
  test("adds the path to an HTTPS address", () => {
    expect(syncEndpoint(" https://backlog.ondes.dev/ ")).toBe(
      "https://backlog.ondes.dev/api/sync"
    );
    expect(syncEndpoint("https://backlog.ondes.dev/api/sync")).toBe(
      "https://backlog.ondes.dev/api/sync"
    );
  });

  test("refuses anything else", () => {
    for (const address of [
      "",
      "https://",
      "http://backlog.ondes.dev",
      "backlog.ondes.dev",
      "https://a b",
    ]) {
      expect(syncEndpoint(address)).toBeUndefined();
    }
  });
});

describe("createTransport", () => {
  const ok = { cursor: 3, more: false, changes: noChanges() };
  const answering =
    (status: number, body: string): FetchLike =>
    () =>
      Promise.resolve({ status, text: () => Promise.resolve(body) });

  test("posts the request with the token and checks the answer", async () => {
    let seen: RequestInit | undefined;
    const fetchStub: FetchLike = (_, init) => {
      seen = init;
      return answering(200, JSON.stringify(ok))("", init);
    };
    const post = createTransport("https://x/api/sync", "secret", fetchStub);
    expect(await post({ version: 1, cursor: 0, changes: noChanges() })).toEqual(
      ok
    );
    expect(seen?.method).toBe("POST");
    expect((seen?.headers as Record<string, string>).Authorization).toBe(
      "Bearer secret"
    );
  });

  test("tells the failures apart", async () => {
    const kindOf = async (fetchStub: FetchLike) => {
      try {
        await createTransport(
          "https://x/api/sync",
          "t",
          fetchStub
        )({
          version: 1,
          cursor: 0,
          changes: noChanges(),
        });
      } catch (error) {
        return error instanceof SyncFailure ? error.kind : "other";
      }
      return "none";
    };
    expect(await kindOf(answering(401, ""))).toBe("token");
    expect(await kindOf(answering(409, ""))).toBe("version");
    expect(await kindOf(answering(400, '{"error":"Bad list."}'))).toBe(
      "rejected"
    );
    expect(await kindOf(answering(500, ""))).toBe("server");
    expect(await kindOf(answering(200, "{}"))).toBe("server");
    expect(await kindOf(() => Promise.reject(new Error("offline")))).toBe(
      "network"
    );
  });

  test("only no network or a failing server may pass on its own", () => {
    const kinds: SyncFailureKind[] = [
      "network",
      "rejected",
      "server",
      "token",
      "version",
    ];
    expect(kinds.filter(isTransient)).toEqual(["network", "server"]);
  });

  test("checks a connection without exchanging anything", async () => {
    let sent: SyncRequest | undefined;
    await checkConnection((request) => {
      sent = request;
      return Promise.resolve(ok);
    });
    expect(sent?.cursor).toBe(Number.MAX_SAFE_INTEGER);
    expect(sent?.changes).toEqual(noChanges());
  });
});
