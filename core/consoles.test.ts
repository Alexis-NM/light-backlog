import { describe, expect, test } from "bun:test";
import {
  CONSOLE_FAMILIES,
  CONSOLES,
  platformIdFor,
  platformIdsFor,
} from "./consoles";

describe("platformIdFor", () => {
  test("knows every console by the name the app shows", () => {
    for (const console of CONSOLES) {
      expect(platformIdFor(console.name)).toBe(console.id);
    }
  });

  test("reads a name whatever its case, spaces or punctuation", () => {
    expect(platformIdFor("playstation 2")).toBe(8);
    expect(platformIdFor("PLAYSTATION-2")).toBe(8);
    expect(platformIdFor(" Xbox Series X|S ")).toBe(169);
  });

  test("knows the short names people write after a title", () => {
    expect(platformIdFor("PS2")).toBe(8);
    expect(platformIdFor("Switch")).toBe(130);
    expect(platformIdFor("N64")).toBe(4);
    expect(platformIdFor("3DS")).toBe(37);
    expect(platformIdFor("Mega Drive")).toBe(29);
  });

  test("gives nothing for what is not a console", () => {
    expect(platformIdFor("2016")).toBeUndefined();
    expect(platformIdFor("Remastered")).toBeUndefined();
    expect(platformIdFor("")).toBeUndefined();
  });
});

describe("platformIdsFor", () => {
  test("gives each console once and leaves unknown names out", () => {
    expect(platformIdsFor(["PlayStation 2", "PS2", "Steam Deck", "?"])).toEqual(
      [8, 6]
    );
    expect(platformIdsFor([])).toEqual([]);
  });
});

test("every console belongs to a family the app lists", () => {
  for (const console of CONSOLES) {
    expect(CONSOLE_FAMILIES).toContain(console.family);
  }
});
