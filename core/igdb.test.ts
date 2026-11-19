import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
  fetchRatings,
  gamesById,
  gamesByPlatform,
  getGameDetails,
  type IgdbAuth,
  IgdbError,
  type IgdbRelay,
  isIgdbEndpoint,
  queryIgdb,
  resetIgdbToken,
  searchGames,
} from "./igdb";

// fetch is replaced: each call gets the next answer, the last one repeating.

interface Call {
  init: RequestInit;
  url: string;
}

const realFetch = globalThis.fetch;
let calls: Call[] = [];

type Answer = () => Response;

const json =
  (body: unknown, status = 200): Answer =>
  () =>
    new Response(JSON.stringify(body), { status });

const unreachable: Answer = () => {
  throw new TypeError("Network request failed");
};

function answer(...answers: Answer[]) {
  calls = [];
  let index = 0;
  globalThis.fetch = ((url: string, init: RequestInit) => {
    calls.push({ url: String(url), init });
    const next = answers[Math.min(index, answers.length - 1)];
    index += 1;
    try {
      return Promise.resolve(next());
    } catch (error) {
      return Promise.reject(error);
    }
  }) as unknown as typeof fetch;
}

const headersOf = (call: Call) => call.init.headers as Record<string, string>;

const keys: IgdbAuth = { clientId: "client-id", clientSecret: "secret" };
const relay: IgdbRelay = { server: "https://backlog.example/", token: "sync" };
const twitch = json({ access_token: "twitch-token", expires_in: 3600 });

const zelda = {
  id: 7346,
  name: "Zelda",
  first_release_date: 1_488_499_200,
  cover: { image_id: "co3p2d" },
  platforms: [{ id: 130, name: "Nintendo Switch" }],
  total_rating: 92.4,
  rating: 90.1,
};

async function kindOf(run: () => Promise<unknown>) {
  try {
    await run();
  } catch (error) {
    return error instanceof IgdbError ? error.kind : "other";
  }
  return "none";
}

beforeEach(() => resetIgdbToken());
afterEach(() => {
  globalThis.fetch = realFetch;
});

describe("through a server", () => {
  test("posts the query to /api/igdb/<endpoint> with the sync token, and never asks Twitch", async () => {
    answer(json([zelda]));
    const games = await searchGames("zelda", relay);
    expect(calls.map((call) => call.url)).toEqual([
      "https://backlog.example/api/igdb/games",
    ]);
    expect(calls[0].init.method).toBe("POST");
    expect(headersOf(calls[0]).Authorization).toBe("Bearer sync");
    expect(String(calls[0].init.body)).toContain('search "zelda";');
    expect(games[0]).toMatchObject({
      id: 7346,
      name: "Zelda",
      igdbRating: 92,
      igdbUserRating: 90,
      igdbCriticRating: null,
    });
  });

  test("leaves the header out without a token, for a browser and its session", async () => {
    answer(json([]));
    await gamesByPlatform(130, { server: "" }, 30);
    expect(calls[0].url).toBe("/api/igdb/games");
    expect(headersOf(calls[0]).Authorization).toBeUndefined();
    expect(String(calls[0].init.body)).toContain("offset 30;");
  });

  test("tells a refused request, a failing server and an unreachable one apart", async () => {
    answer(json({ error: "Not signed in." }, 401));
    expect(await kindOf(() => searchGames("zelda", relay))).toBe("auth");
    answer(json({ error: "IGDB failed." }, 502));
    expect(await kindOf(() => searchGames("zelda", relay))).toBe("server");
    answer(json({ not: "a list" }));
    expect(await kindOf(() => searchGames("zelda", relay))).toBe("server");
    answer(unreachable);
    expect(await kindOf(() => searchGames("zelda", relay))).toBe("network");
  });

  test("tries again once after a 429", async () => {
    answer(json({}, 429), json([zelda]));
    const games = await searchGames("zelda", relay);
    expect(calls).toHaveLength(2);
    expect(games).toHaveLength(1);
  });
});

describe("directly with keys", () => {
  test("asks Twitch for a token once, then sends it with the client id", async () => {
    answer(twitch, json([zelda]));
    await searchGames("zelda", keys);
    await searchGames("zelda", keys);
    expect(calls.map((call) => new URL(call.url).host)).toEqual([
      "id.twitch.tv",
      "api.igdb.com",
      "api.igdb.com",
    ]);
    expect(headersOf(calls[1])).toMatchObject({
      "Client-ID": "client-id",
      Authorization: "Bearer twitch-token",
    });
  });

  test("renews the Twitch token once when IGDB refuses it", async () => {
    answer(twitch, json({}, 401), twitch, json([zelda]));
    const games = await searchGames("zelda", keys);
    expect(games).toHaveLength(1);
    expect(calls).toHaveLength(4);
  });
});

describe("a request that gets no answer", () => {
  /** Never answers: only giving up ends it, as an unreachable server would. */
  const silent = () => {
    calls = [];
    globalThis.fetch = ((url: string, init: RequestInit) => {
      calls.push({ url: String(url), init });
      return new Promise((_resolve, reject) => {
        init.signal?.addEventListener("abort", () =>
          reject(new DOMException("Aborted", "AbortError"))
        );
      });
    }) as unknown as typeof fetch;
  };

  test("can be given up on, through a server, with keys and at Twitch", async () => {
    answer(json([zelda]));
    await searchGames("zelda", relay);
    expect(calls[0].init.signal).toBeInstanceOf(AbortSignal);

    answer(twitch, json([zelda]));
    await searchGames("zelda", keys);
    expect(calls[0].init.signal).toBeInstanceOf(AbortSignal);
    expect(calls[1].init.signal).toBeInstanceOf(AbortSignal);
  });

  test("ends as an unreachable server once given up on", async () => {
    silent();
    const pending = kindOf(() => searchGames("zelda", relay));
    // The 30 s are not waited for here: the request is given up on by hand.
    await Promise.resolve();
    (calls[0].init.signal as AbortSignal).dispatchEvent(new Event("abort"));
    expect(await pending).toBe("network");
  });
});

describe("queryIgdb", () => {
  test("gives IGDB's answer as is, for a server to relay", async () => {
    const raw = [{ id: 1, total_rating: 80.5 }];
    answer(twitch, json(raw));
    const body = "fields total_rating; where id = 1;";
    expect(await queryIgdb("games", body, keys)).toEqual(raw);
    expect(calls[1].url).toBe("https://api.igdb.com/v4/games");
    expect(calls[1].init.body).toBe(body);
  });

  test("refuses anything but an endpoint name", async () => {
    answer(twitch);
    expect(isIgdbEndpoint("games")).toBe(true);
    expect(isIgdbEndpoint("../oauth2/token")).toBe(false);
    expect(await kindOf(() => queryIgdb("games/../x", "", keys))).toBe(
      "server"
    );
    expect(calls).toHaveLength(0);
  });
});

describe("both accesses", () => {
  test("give the same results", async () => {
    const ratings = [{ id: 7346, total_rating: 92.4, rating: 90.1 }];
    answer(twitch, json(ratings));
    const direct = await fetchRatings([7346, 9999], keys);
    answer(json(ratings));
    const relayed = await fetchRatings([7346, 9999], relay);
    expect(relayed).toEqual(direct);
    expect(relayed[9999]).toEqual({
      igdbRating: null,
      igdbUserRating: null,
      igdbCriticRating: null,
    });
  });

  test("give the details of a game, screenshots included", async () => {
    answer(
      json([
        {
          id: 101,
          summary: "A game.",
          screenshots: [{ image_id: "sc1" }],
          total_rating: 80,
        },
      ])
    );
    const details = await getGameDetails(101, relay);
    expect(details.summary).toBe("A game.");
    expect(details.screenshots).toEqual([
      "https://images.igdb.com/igdb/image/upload/t_screenshot_big/sc1.jpg",
    ]);
    expect(details.ratings.total).toBe(80);
  });
});

test("the year of a game is the same in every time zone", async () => {
  // The last and the first half hour of a year, in UTC: read in local time,
  // one of the two falls in the other year anywhere but in UTC.
  answer(
    json([
      { id: 1, name: "New Year's Eve", first_release_date: 1_609_457_400 },
      { id: 2, name: "New Year's Day", first_release_date: 1_609_459_200 },
    ])
  );
  const games = await gamesById([1, 2], relay);
  expect(games.map((game) => game.year)).toEqual([2020, 2021]);
});

describe("gamesById", () => {
  const fields =
    "fields name, first_release_date, cover.image_id, platforms.name, total_rating, rating, aggregated_rating;";

  test("gives the games IGDB knows among the ids, read and converted like search results", async () => {
    answer(json([zelda]));
    const games = await gamesById([7346, 9999], relay);
    expect(calls[0].init.body).toBe(
      `${fields} where id = (7346,9999); limit 500;`
    );
    expect(games).toEqual([
      {
        id: 7346,
        name: "Zelda",
        year: 2017,
        coverUrl:
          "https://images.igdb.com/igdb/image/upload/t_cover_big/co3p2d.jpg",
        platforms: [{ id: 130, name: "Nintendo Switch" }],
        igdbRating: 92,
        igdbUserRating: 90,
        igdbCriticRating: null,
      },
    ]);
  });

  test("asks 500 ids at a time and puts the answers together", async () => {
    const ids = Array.from({ length: 501 }, (_, index) => index + 1);
    answer(
      twitch,
      json([{ id: 1, name: "First" }]),
      json([{ id: 501, name: "Last" }])
    );
    const games = await gamesById(ids, keys);
    expect(calls.slice(1).map((call) => call.init.body)).toEqual([
      `${fields} where id = (${ids.slice(0, 500).join(",")}); limit 500;`,
      `${fields} where id = (501); limit 500;`,
    ]);
    expect(games.map((game) => game.name)).toEqual(["First", "Last"]);
  });

  test("asks nothing for no ids", async () => {
    answer(twitch);
    expect(await gamesById([], keys)).toEqual([]);
    expect(calls).toHaveLength(0);
  });
});
