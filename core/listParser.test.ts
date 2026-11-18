import { describe, expect, test } from "bun:test";
import { parseGameTitles } from "./listParser";

describe("parseGameTitles", () => {
  test("one title per line, blank lines and duplicates dropped", () => {
    expect(parseGameTitles("Halo\n\nHalo\r\nDoom (2016)\n")).toEqual([
      "Halo",
      "Doom (2016)",
    ]);
  });

  test("Markdown bullets, numbered lists and links", () => {
    const source = [
      "- Celeste",
      "* [Hades](https://example.com/hades)",
      "1. Hollow Knight",
      "+ Dead Cells",
    ].join("\n");
    expect(parseGameTitles(source)).toEqual([
      "Celeste",
      "Hades",
      "Hollow Knight",
      "Dead Cells",
    ]);
  });

  test("CSV with a header picks the title column and honours quotes", () => {
    const source = [
      "Platform,Title,Year",
      'PS2,"Ratchet & Clank",2002',
      "PS2,Ico,2001",
      'PS2,"Grand Theft Auto: San Andreas",2004',
    ].join("\n");
    expect(parseGameTitles(source)).toEqual([
      "Ratchet & Clank",
      "Ico",
      "Grand Theft Auto: San Andreas",
    ]);
  });

  test("a comma inside one title of a plain list is kept", () => {
    expect(
      parseGameTitles("Hey You, Pikachu!\nPokémon Snap\nMario Party")
    ).toEqual(["Hey You, Pikachu!", "Pokémon Snap", "Mario Party"]);
  });

  test("CSV without a header takes the first column", () => {
    expect(parseGameTitles("Okami;2006\nTekken 5;2004")).toEqual([
      "Okami",
      "Tekken 5",
    ]);
  });
});
