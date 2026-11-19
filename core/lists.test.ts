import { describe, expect, test } from "bun:test";
import type { Game, GameList } from "./game";
import {
  type GameListV1,
  listGames,
  reorderLists,
  sortLists,
  topPosition,
  upgradeList,
  upgradeLists,
  withFields,
  withGames,
  withoutGames,
  withRatings,
} from "./lists";

const game = (id: number): Game => ({ id, name: `Game ${id}` });

const ids = (games: Game[]) => games.map((item) => item.id);

/** Game 3 was added last, game 2 first. */
const oldList = (extra: Partial<GameListV1> = {}): GameListV1 => ({
  id: "list_1",
  name: "Favourites",
  createdAt: 1000,
  gameIds: [3, 1, 2],
  games: { 1: game(1), 2: game(2), 3: game(3) },
  ...extra,
});

const list = (
  id: string,
  position: number,
  extra: Partial<GameList> = {}
): GameList => ({
  id,
  name: id,
  createdAt: 1000,
  updatedAt: 1000,
  position,
  items: {},
  ...extra,
});

/** Game 2 was added after game 1. */
const twoGames = () =>
  list("list_1", 0, {
    items: {
      1: { addedAt: 1000, game: game(1) },
      2: { addedAt: 1001, game: game(2) },
    },
  });

describe("upgradeList", () => {
  test("keeps the games in the same order", () => {
    expect(ids(listGames(upgradeList(oldList(), 0)))).toEqual([3, 1, 2]);
  });

  test("dates the first game added at createdAt, each later one a millisecond more", () => {
    const { items } = upgradeList(oldList(), 0);
    expect(items[2].addedAt).toBe(1000);
    expect(items[1].addedAt).toBe(1001);
    expect(items[3].addedAt).toBe(1002);
  });

  test("dates the list at its creation and keeps its fields", () => {
    const upgraded = upgradeList(
      oldList({ consoles: ["PlayStation 2"], sort: "igdb" }),
      4
    );
    expect(upgraded).toMatchObject({
      id: "list_1",
      name: "Favourites",
      consoles: ["PlayStation 2"],
      sort: "igdb",
      createdAt: 1000,
      updatedAt: 1000,
      position: 4,
    });
    expect(upgraded).not.toHaveProperty("gameIds");
    expect(upgraded).not.toHaveProperty("games");
  });

  test("loses no game: one missing from gameIds comes last", () => {
    const upgraded = upgradeList(oldList({ gameIds: [3, 99, 1] }), 0);
    expect(ids(listGames(upgraded))).toEqual([3, 1, 2]);
    expect(Object.keys(upgraded.items)).toEqual(["1", "2", "3"]);
  });

  test("keeps a game listed twice once, at its most recent place", () => {
    const upgraded = upgradeList(oldList({ gameIds: [1, 3, 1, 2] }), 0);
    expect(ids(listGames(upgraded))).toEqual([1, 3, 2]);
  });

  test("gives each list its place in the old order as position", () => {
    const upgraded = upgradeLists([
      oldList({ id: "b" }),
      oldList({ id: "a" }),
      oldList({ id: "c" }),
    ]);
    expect(upgraded.map((item) => [item.id, item.position])).toEqual([
      ["b", 0],
      ["a", 1],
      ["c", 2],
    ]);
  });
});

describe("withGames", () => {
  test("puts new games above the others, the first given on top", () => {
    const next = withGames(twoGames(), [game(5), game(6)], 5000);
    expect(ids(listGames(next))).toEqual([5, 6, 2, 1]);
    expect(next.items[5].addedAt).toBe(5000);
    expect(next.items[6].addedAt).toBe(4999);
  });

  test("keeps the date of a game already there and adds a game once", () => {
    const before = twoGames();
    const next = withGames(before, [game(2), game(7), game(7)], 5000);
    expect(next.items[2]).toBe(before.items[2]);
    expect(ids(listGames(next))).toEqual([7, 2, 1]);
  });

  test("stays above the newest game when the clock went back", () => {
    const next = withGames(twoGames(), [game(8), game(9)], 500);
    expect(ids(listGames(next))).toEqual([8, 9, 2, 1]);
    expect(next.items[9].addedAt).toBeGreaterThan(1001);
  });

  test("leaves the list unchanged when every game is already there", () => {
    const before = twoGames();
    expect(withGames(before, [game(1)], 5000)).toBe(before);
  });

  test("does not date the list itself", () => {
    expect(withGames(twoGames(), [game(5)], 5000).updatedAt).toBe(1000);
  });
});

describe("withoutGames", () => {
  test("removes the games without dating the list", () => {
    const next = withoutGames(twoGames(), [1, 42]);
    expect(ids(listGames(next))).toEqual([2]);
    expect(next.updatedAt).toBe(1000);
  });
});

describe("withRatings", () => {
  const ratings = {
    igdbRating: 90,
    igdbUserRating: 85,
    igdbCriticRating: null,
  };

  test("stores the ratings without touching any date", () => {
    const next = withRatings(twoGames(), { 2: ratings });
    expect(next.items[2]).toEqual({
      addedAt: 1001,
      game: { ...game(2), ...ratings },
    });
    expect(next.updatedAt).toBe(1000);
  });

  test("leaves the list unchanged when the ratings are already stored", () => {
    const before = withRatings(twoGames(), { 2: ratings });
    expect(withRatings(before, { 2: ratings, 42: ratings })).toBe(before);
  });
});

describe("withFields", () => {
  test("dates a change of name, consoles or sort", () => {
    const before = list("list_1", 0);
    expect(withFields(before, { name: "Next" }, 2000).updatedAt).toBe(2000);
    expect(withFields(before, { consoles: ["Wii"] }, 2000).updatedAt).toBe(
      2000
    );
    expect(withFields(before, { sort: "alpha" }, 2000).updatedAt).toBe(2000);
  });

  test("dates the change after the list when the clock is behind", () => {
    const before = list("list_1", 0, { updatedAt: 3000 });
    expect(withFields(before, { name: "Next" }, 2000).updatedAt).toBe(3001);
  });

  test("leaves the list unchanged when nothing changes", () => {
    const before = list("list_1", 0, { consoles: ["Wii", "GameCube"] });
    const same = withFields(
      before,
      { name: before.name, consoles: ["Wii", "GameCube"] },
      2000
    );
    expect(same).toBe(before);
  });
});

describe("list order", () => {
  test("lists are sorted by position, then by id", () => {
    const sorted = sortLists([list("b", 1), list("a", 1), list("c", 0)]);
    expect(sorted.map((item) => item.id)).toEqual(["c", "a", "b"]);
  });

  test("a new list goes above all the others", () => {
    expect(topPosition([])).toBe(0);
    expect(topPosition([list("a", 0), list("b", 3)])).toBe(-1);
    expect(topPosition([list("a", 5)])).toBe(0);
  });

  test("moving a list swaps it with its neighbour, and dates only these two", () => {
    const before = [list("a", 0), list("b", 1), list("c", 2)];
    const next = reorderLists(before, "c", "up", 2000);
    expect(next.map((item) => [item.id, item.position])).toEqual([
      ["a", 0],
      ["c", 1],
      ["b", 2],
    ]);
    expect(next[0]).toBe(before[0]);
    expect(next[1].updatedAt).toBe(2000);
    expect(next[2].updatedAt).toBe(2000);
  });

  test("a move made with the clock behind is dated after each list moved", () => {
    const before = [
      list("a", 0, { updatedAt: 3000 }),
      list("b", 1, { updatedAt: 1500 }),
    ];
    const next = reorderLists(before, "b", "up", 2000);
    expect(next.map((item) => [item.id, item.updatedAt])).toEqual([
      ["b", 2000],
      ["a", 3001],
    ]);
  });

  test("lists renumbered then moved are dated once", () => {
    const next = reorderLists(
      [
        list("a", 0, { updatedAt: 3000 }),
        list("b", 0, { updatedAt: 3000 }),
        list("c", 0, { updatedAt: 3000 }),
      ],
      "c",
      "up",
      2000
    );
    expect(next.map((item) => [item.id, item.position])).toEqual([
      ["a", 0],
      ["c", 1],
      ["b", 2],
    ]);
    expect(next[0].updatedAt).toBe(3000);
    expect(next[1].updatedAt).toBe(3001);
    expect(next[2].updatedAt).toBe(3001);
  });

  test("a list cannot move past either end", () => {
    const before = [list("a", 0), list("b", 1)];
    expect(reorderLists(before, "a", "up", 2000)).toBe(before);
    expect(reorderLists(before, "b", "down", 2000)).toBe(before);
    expect(reorderLists(before, "unknown", "up", 2000)).toBe(before);
  });

  test("equal positions are renumbered before the move", () => {
    const next = reorderLists(
      [list("a", 0), list("b", 0), list("c", 1)],
      "b",
      "up",
      2000
    );
    expect(sortLists(next).map((item) => item.id)).toEqual(["b", "a", "c"]);
    expect(new Set(next.map((item) => item.position)).size).toBe(3);
  });
});
