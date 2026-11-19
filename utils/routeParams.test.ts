import { describe, expect, test } from "bun:test";
import type { Game } from "@/core/game";
import { readGame, readGames, readImages } from "./routeParams";

const COVER =
  "https://images.igdb.com/igdb/image/upload/t_cover_big/co3p2d.jpg";
const SHOT =
  "https://images.igdb.com/igdb/image/upload/t_screenshot_big/sc8fm2.jpg";

const zelda: Game = {
  id: 7346,
  name: "Zelda",
  year: 2017,
  coverUrl: COVER,
  platforms: [{ id: 130, name: "Nintendo Switch" }],
  igdbRating: 92,
  igdbUserRating: 90,
  igdbCriticRating: null,
};

describe("readGame", () => {
  test("reads back a game as the app writes it", () => {
    expect(readGame(JSON.stringify(zelda))).toEqual(zelda);
    expect(readGame(JSON.stringify({ id: 1, name: "Bare" }))).toEqual({
      id: 1,
      name: "Bare",
    });
  });

  test("gives nothing for what is not a game", () => {
    expect(readGame(undefined)).toBeNull();
    expect(readGame("{not json")).toBeNull();
    expect(readGame("null")).toBeNull();
    expect(readGame(JSON.stringify({ id: 1 }))).toBeNull();
    expect(readGame(JSON.stringify({ id: "1", name: "Text id" }))).toBeNull();
    expect(
      readGame(JSON.stringify({ id: 1, name: "X", platforms: "Switch" }))
    ).toBeNull();
  });

  test("leaves out a cover that is not an IGDB image", () => {
    const game = readGame(
      JSON.stringify({ ...zelda, coverUrl: "https://example.com/pixel.png" })
    );
    expect(game?.name).toBe("Zelda");
    expect(game && "coverUrl" in game).toBe(false);
  });
});

describe("readGames", () => {
  test("keeps the games and leaves the rest out", () => {
    const raw = JSON.stringify([zelda, { name: "No id" }, 42]);
    expect(readGames(raw)).toEqual([zelda]);
    expect(readGames(JSON.stringify(zelda))).toEqual([]);
    expect(readGames(undefined)).toEqual([]);
  });
});

describe("readImages", () => {
  test("keeps IGDB images only", () => {
    const raw = JSON.stringify([
      SHOT,
      "https://example.com/pixel.png",
      "file:///data/data/com.nonolpmod.backlog/files/secret",
      "https://images.igdb.com.example.com/x.png",
      7,
    ]);
    expect(readImages(raw)).toEqual([SHOT]);
    expect(readImages("{not json")).toEqual([]);
    expect(readImages(JSON.stringify(SHOT))).toEqual([]);
  });
});
