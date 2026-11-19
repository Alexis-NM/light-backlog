import { describe, expect, test } from "bun:test";
import type { CandidateQuery, MatchCandidate } from "./igdb";
import {
  baseTitle,
  looseTitle,
  matchImportTitles,
  normalizeTitle,
  parseTitleHints,
  pickBestMatch,
  titleSimilarity,
} from "./importMatcher";

const PS2 = { id: 8, name: "PlayStation 2" };
const PS4 = { id: 48, name: "PlayStation 4" };
const XBOX = { id: 11, name: "Xbox" };
const PC = { id: 6, name: "PC (Microsoft Windows)" };

const game = (
  id: number,
  name: string,
  extra: Partial<MatchCandidate> = {}
): MatchCandidate => ({ id, name, gameType: 0, ...extra });

describe("normalizeTitle / looseTitle", () => {
  test("drops accents, case, punctuation and expands &", () => {
    expect(normalizeTitle("Pokémon: Red & Blue!")).toBe("pokemon red and blue");
    expect(normalizeTitle("Ōkami")).toBe("okami");
    expect(normalizeTitle("  Half-Life   2 ")).toBe("half life 2");
  });

  test("turns Roman numerals into digits and drops a leading article", () => {
    expect(looseTitle("final fantasy vii")).toBe("final fantasy 7");
    expect(looseTitle("the legend of zelda")).toBe("legend of zelda");
    expect(looseTitle("mega man x")).toBe("mega man 10");
    expect(looseTitle("street fighter ii turbo")).toBe(
      "street fighter 2 turbo"
    );
  });
});

describe("baseTitle", () => {
  test("cuts at a dash or colon separator only", () => {
    expect(baseTitle("Minishoot' Adventures - Nintendo Switch 2 Edition")).toBe(
      "Minishoot' Adventures"
    );
    expect(baseTitle("The Legend of Zelda: Breath of the Wild")).toBe(
      "The Legend of Zelda"
    );
    expect(baseTitle("Spider-Man")).toBeUndefined();
    expect(baseTitle("Hades")).toBeUndefined();
  });
});

describe("parseTitleHints", () => {
  test("reads a trailing year", () => {
    expect(parseTitleHints("Doom (2016)")).toEqual({
      title: "Doom",
      year: 2016,
      platformIds: undefined,
    });
  });

  test("reads a trailing console, in brackets or after a dash", () => {
    expect(parseTitleHints("Halo [Xbox]")).toEqual({
      title: "Halo",
      year: undefined,
      platformIds: [11],
    });
    expect(parseTitleHints("Halo - PC").platformIds).toEqual([6]);
    expect(parseTitleHints("Halo - PC").title).toBe("Halo");
  });

  test("reads both hints in any order", () => {
    expect(parseTitleHints("Halo (Xbox) (2001)")).toEqual({
      title: "Halo",
      year: 2001,
      platformIds: [11],
    });
    expect(parseTitleHints("God of War (2018) [PS4]")).toEqual({
      title: "God of War",
      year: 2018,
      platformIds: [48],
    });
  });

  test("keeps parentheses and dashes that are part of the title", () => {
    expect(
      parseTitleHints("Ori and the Blind Forest (Definitive Edition)")
    ).toEqual({
      title: "Ori and the Blind Forest (Definitive Edition)",
      year: undefined,
      platformIds: undefined,
    });
    expect(parseTitleHints("Spider-Man").title).toBe("Spider-Man");
    expect(parseTitleHints("Metroid - Zero Mission").title).toBe(
      "Metroid - Zero Mission"
    );
  });
});

describe("titleSimilarity", () => {
  test("ranks exact > numerals/article > subtitle > contains, and a typo close to exact", () => {
    const exact = titleSimilarity("Final Fantasy VII", "Final Fantasy VII");
    const loose = titleSimilarity("Final Fantasy 7", "Final Fantasy VII");
    const subtitle = titleSimilarity(
      "The Witcher 3",
      "The Witcher 3: Wild Hunt"
    );
    const contains = titleSimilarity(
      "Ocarina of Time",
      "The Legend of Zelda: Ocarina of Time"
    );
    const fuzzy = titleSimilarity("Chrono Triger", "Chrono Trigger");
    expect(exact).toBe(1);
    expect(loose).toBeLessThan(exact);
    expect(subtitle).toBeLessThan(loose);
    expect(contains).toBeLessThan(subtitle);
    expect(fuzzy).toBeLessThan(subtitle);
    expect(fuzzy).toBeGreaterThan(0.72);
  });

  test("scores unrelated names below the acceptance threshold", () => {
    expect(titleSimilarity("Halo", "Elden Ring")).toBeLessThan(0.45);
  });

  test("prefers the plain subtitle over an edition of the same game", () => {
    const plain = titleSimilarity(
      "Devil May Cry 3",
      "Devil May Cry 3: Dante's Awakening"
    );
    const edition = titleSimilarity(
      "Devil May Cry 3",
      "Devil May Cry 3: Special Edition"
    );
    expect(plain).toBeGreaterThan(edition);
  });

  test("ignores a subtitle typed with a different separator", () => {
    expect(
      titleSimilarity(
        "Zelda - Breath of the Wild",
        "The Legend of Zelda: Breath of the Wild"
      )
    ).toBeGreaterThan(0.72);
  });
});

describe("pickBestMatch", () => {
  const hints = (title: string, year?: number) => ({ title, year });

  test("takes the main game over a DLC or bundle with a similar name", () => {
    const picked = pickBestMatch(hints("The Witcher 3: Wild Hunt"), [
      game(2, "The Witcher 3: Wild Hunt - Complete Edition", { gameType: 3 }),
      game(3, "The Witcher 3: Wild Hunt - Blood and Wine", { gameType: 2 }),
      game(1, "The Witcher 3: Wild Hunt", { ratingCount: 900 }),
    ]);
    expect(picked?.game.id).toBe(1);
    expect(picked?.confidence).toBe("exact");
  });

  test("takes the game released on the requested console", () => {
    const candidates = [
      game(10, "God of War", {
        year: 2018,
        platforms: [PS4, PC],
        ratingCount: 2000,
      }),
      game(11, "God of War", {
        year: 2005,
        platforms: [PS2],
        ratingCount: 500,
      }),
    ];
    expect(pickBestMatch(hints("God of War"), candidates, [8])?.game.id).toBe(
      11
    );
    expect(pickBestMatch(hints("God of War"), candidates, [48])?.game.id).toBe(
      10
    );
  });

  test("uses the year hint to split same-name games", () => {
    const candidates = [
      game(20, "Doom", { year: 2016, ratingCount: 1500 }),
      game(21, "Doom", { year: 1993, ratingCount: 1000 }),
    ];
    expect(pickBestMatch(hints("Doom", 1993), candidates)?.game.id).toBe(21);
    expect(pickBestMatch(hints("Doom", 2016), candidates)?.game.id).toBe(20);
  });

  test("falls back to popularity between identical main games", () => {
    const candidates = [
      game(30, "Doom", { year: 1993, ratingCount: 300 }),
      game(31, "Doom", { year: 2016, ratingCount: 1500 }),
    ];
    expect(pickBestMatch(hints("Doom"), candidates)?.game.id).toBe(31);
  });

  test("matches through an alternative name", () => {
    const picked = pickBestMatch(hints("Biohazard 4"), [
      game(40, "Resident Evil 4", { altNames: ["Biohazard 4"] }),
      game(41, "Resident Evil 4: Wii Edition", { gameType: 11 }),
    ]);
    expect(picked?.game.id).toBe(40);
  });

  test("prefers the original over its remake when nothing else separates them", () => {
    const picked = pickBestMatch(hints("Resident Evil 4"), [
      game(50, "Resident Evil 4", {
        year: 2023,
        gameType: 8,
        ratingCount: 600,
      }),
      game(51, "Resident Evil 4", {
        year: 2005,
        gameType: 0,
        ratingCount: 600,
      }),
    ]);
    expect(picked?.game.id).toBe(51);
  });

  test("is unsure of a game found by reading a single letter as a number", () => {
    const megaMan10 = game(1, "Mega Man 10");
    const megaManX = game(2, "Mega Man X");
    // Only Mega Man 10 is on the list's console: it is taken, but flagged.
    expect(pickBestMatch({ title: "Mega Man X" }, [megaMan10])).toMatchObject({
      game: megaMan10,
      confidence: "uncertain",
    });
    expect(
      pickBestMatch({ title: "Mega Man X" }, [megaMan10, megaManX])
    ).toMatchObject({ game: megaManX, confidence: "exact" });
    // Typed as a number, or with a longer numeral, nothing is in doubt.
    expect(
      pickBestMatch({ title: "Final Fantasy 10" }, [game(3, "Final Fantasy X")])
        ?.confidence
    ).toBe("exact");
    expect(
      pickBestMatch({ title: "Final Fantasy VII" }, [
        game(4, "Final Fantasy 7"),
      ])?.confidence
    ).toBe("exact");
  });

  test("gives up when no candidate resembles the title", () => {
    expect(
      pickBestMatch(hints("Halo"), [game(60, "Elden Ring")])
    ).toBeUndefined();
  });

  test("reports low confidence on a loose match", () => {
    const picked = pickBestMatch(hints("Zelda"), [
      game(70, "The Legend of Zelda", { ratingCount: 400 }),
      game(71, "The Legend of Zelda: Breath of the Wild", {
        ratingCount: 3000,
      }),
    ]);
    expect(picked?.game.id).toBe(70);
    expect(picked?.confidence).not.toBe("exact");
  });
});

describe("matchImportTitles", () => {
  const catalogue: MatchCandidate[] = [
    game(1, "God of War", { year: 2005, platforms: [PS2] }),
    game(2, "God of War", { year: 2018, platforms: [PS4, PC] }),
    game(3, "Halo: Combat Evolved", { year: 2001, platforms: [XBOX, PC] }),
    game(4, "Shadow of the Colossus", { year: 2005, platforms: [PS2] }),
  ];

  const fakeSearch =
    (log: CandidateQuery[][]) => (queries: CandidateQuery[]) => {
      log.push(queries);
      const out: Record<string, MatchCandidate[]> = {};
      for (const query of queries) {
        const term = normalizeTitle(query.text);
        out[query.key] = catalogue.filter(
          (candidate) =>
            normalizeTitle(candidate.name).includes(term) &&
            (!query.platformIds?.length ||
              candidate.platforms?.some((p) =>
                query.platformIds?.includes(p.id)
              ))
        );
      }
      return Promise.resolve(out);
    };

  test("restricts the search to the list consoles, then retries the rest unfiltered", async () => {
    const log: CandidateQuery[][] = [];
    const progress: number[] = [];
    const results = await matchImportTitles(
      ["God of War", "Halo", "Nothing Like This"],
      fakeSearch(log),
      {
        consoles: ["PlayStation 2"],
        delayMs: 0,
        onProgress: (done) => progress.push(done),
      }
    );

    expect(log[0].every((query) => query.platformIds?.[0] === 8)).toBe(true);
    expect(log[1].map((query) => query.text)).toEqual([
      "Halo",
      "Nothing Like This",
    ]);
    expect(log[1].every((query) => query.platformIds === undefined)).toBe(true);
    expect(progress).toEqual([3]);

    expect(results[0].game?.id).toBe(1);
    expect(results[0].onPlatform).toBe(true);
    expect(results[1].game?.id).toBe(3);
    expect(results[1].onPlatform).toBe(false);
    expect(results[2].game).toBeUndefined();
  });

  test("lets a per-title hint override the list consoles", async () => {
    const log: CandidateQuery[][] = [];
    const results = await matchImportTitles(
      ["God of War (PS4)", "Shadow of the Colossus"],
      fakeSearch(log),
      { consoles: ["PlayStation 2"], delayMs: 0 }
    );
    expect(log[0][0]).toMatchObject({ text: "God of War", platformIds: [48] });
    expect(log[0][1]).toMatchObject({ platformIds: [8] });
    expect(results[0].game?.id).toBe(2);
    expect(results[1].game?.id).toBe(4);
  });

  test("retries a title cut at its separator when the full title finds nothing", async () => {
    const log: CandidateQuery[][] = [];
    const results = await matchImportTitles(
      ["Halo - Nintendo Switch 2 Edition", "God of War"],
      fakeSearch(log),
      { delayMs: 0 }
    );
    expect(log.map((batch) => batch.map((query) => query.text))).toEqual([
      ["Halo - Nintendo Switch 2 Edition", "God of War"],
      ["Halo"],
    ]);
    expect(results[0].game?.id).toBe(3);
    expect(results[0].confidence).toBe("uncertain");
  });

  test("splits titles into batches and reports progress per batch", async () => {
    const log: CandidateQuery[][] = [];
    const progress: number[] = [];
    await matchImportTitles(
      ["God of War", "Halo", "Shadow of the Colossus"],
      fakeSearch(log),
      { batchSize: 2, delayMs: 0, onProgress: (done) => progress.push(done) }
    );
    expect(log.map((batch) => batch.length)).toEqual([2, 1]);
    expect(progress).toEqual([2, 3]);
  });

  /** Fails at the given calls (counted from 1), and searches at the others. */
  const flakySearch = (log: CandidateQuery[][], failing: number[]) => {
    const search = fakeSearch(log);
    let call = 0;
    return (queries: CandidateQuery[]) => {
      call += 1;
      return failing.includes(call)
        ? Promise.reject(new Error("Network request failed"))
        : search(queries);
    };
  };

  const oneByOne = { batchSize: 1, delayMs: 0, retryDelayMs: 0 };

  test("tries a search that failed once more", async () => {
    const log: CandidateQuery[][] = [];
    const results = await matchImportTitles(
      ["God of War", "Halo", "Shadow of the Colossus"],
      flakySearch(log, [2]),
      oneByOne
    );
    expect(results.map((result) => result.game?.id)).toEqual([1, 3, 4]);
    expect(results.some((result) => result.unsearched)).toBe(false);
  });

  test("keeps what it found when the search keeps failing, and tells which titles it did not reach", async () => {
    const log: CandidateQuery[][] = [];
    const results = await matchImportTitles(
      ["God of War", "Nothing Like This", "Halo", "Shadow of the Colossus"],
      flakySearch(log, [3, 4]),
      oneByOne
    );
    expect(results.map((result) => result.game?.id)).toEqual([
      1,
      undefined,
      undefined,
      undefined,
    ]);
    // The second title was looked up and not found; the last two were not.
    expect(results.map((result) => result.unsearched ?? false)).toEqual([
      false,
      false,
      true,
      true,
    ]);
  });

  test("fails when the search fails before anything was found", async () => {
    const log: CandidateQuery[][] = [];
    await expect(
      matchImportTitles(["God of War", "Halo"], flakySearch(log, [1, 2]), {
        ...oneByOne,
      })
    ).rejects.toThrow("Network request failed");
  });
});
