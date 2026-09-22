import type { Game, Platform, StoredRatings } from "@/types/game";

const TOKEN_URL = "https://id.twitch.tv/oauth2/token";
const API_URL = "https://api.igdb.com/v4";
const IMAGE_BASE = "https://images.igdb.com/igdb/image/upload";

export interface IgdbAuth {
  clientId: string;
  clientSecret: string;
}

export type IgdbErrorKind = "auth" | "network" | "server";

export class IgdbError extends Error {
  kind: IgdbErrorKind;
  constructor(kind: IgdbErrorKind, message: string) {
    super(message);
    this.kind = kind;
    this.name = "IgdbError";
  }
}

interface RawRatings {
  aggregated_rating?: number;
  rating?: number;
  total_rating?: number;
}

interface RawGame extends RawRatings {
  alternative_names?: { name?: string }[];
  cover?: { image_id?: string };
  first_release_date?: number;
  game_type?: number;
  id: number;
  name: string;
  platforms?: { id?: number; name?: string }[];
  total_rating_count?: number;
  version_parent?: number;
}

/** A search result with the extra IGDB fields the import matcher scores on. */
export interface MatchCandidate extends Game {
  altNames?: string[];
  /** IGDB game_type id: 0 main game, 1 DLC, 2 expansion, 3 bundle, 8 remake, 9 remaster… */
  gameType?: number;
  ratingCount?: number;
  /** Set when this entry is an edition/version of another game. */
  versionParent?: number;
}

export interface CandidateQuery {
  key: string;
  /** Restrict the search to games released on any of these IGDB platforms. */
  platformIds?: number[];
  text: string;
}

interface RawGameDetails extends RawRatings {
  id: number;
  screenshots?: { image_id?: string }[];
  summary?: string;
}

/** IGDB scores out of 100: members' votes, press reviews and their average. */
interface GameRatings {
  critics?: number;
  total?: number;
  users?: number;
}

export interface GameDetails {
  ratings: GameRatings;
  screenshots: string[];
  summary?: string;
}

// IGDB allows 4 requests per second and answers 429 above that.
const RATE_LIMIT_BACKOFF_MS = 1100;
const SEARCH_SPACING_MS = 260;

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const roundRating = (value: number | undefined) =>
  typeof value === "number" ? Math.round(value) : undefined;

const storedRatings = (raw: RawRatings): StoredRatings => ({
  igdbRating: roundRating(raw.total_rating) ?? null,
  igdbUserRating: roundRating(raw.rating) ?? null,
  igdbCriticRating: roundRating(raw.aggregated_rating) ?? null,
});

const RATING_FIELDS = "total_rating, rating, aggregated_rating";

let tokenCache: { clientId: string; token: string; expiresAt: number } | null =
  null;

export function resetIgdbToken() {
  tokenCache = null;
}

export function coverUrl(imageId: string, size = "t_cover_big") {
  return `${IMAGE_BASE}/${size}/${imageId}.jpg`;
}

async function getToken(auth: IgdbAuth): Promise<string> {
  const now = Date.now();
  if (
    tokenCache &&
    tokenCache.clientId === auth.clientId &&
    tokenCache.expiresAt > now + 60_000
  ) {
    return tokenCache.token;
  }

  const url = `${TOKEN_URL}?client_id=${encodeURIComponent(
    auth.clientId
  )}&client_secret=${encodeURIComponent(
    auth.clientSecret
  )}&grant_type=client_credentials`;

  let response: Response;
  try {
    response = await fetch(url, { method: "POST" });
  } catch {
    throw new IgdbError("network", "Failed to reach Twitch.");
  }

  if (!response.ok) {
    throw new IgdbError("auth", "Invalid credentials.");
  }

  const data = (await response.json()) as {
    access_token?: string;
    expires_in?: number;
  };

  if (!data.access_token) {
    throw new IgdbError("auth", "No access token returned.");
  }

  tokenCache = {
    clientId: auth.clientId,
    token: data.access_token,
    expiresAt: now + (data.expires_in ?? 3600) * 1000,
  };
  return tokenCache.token;
}

async function apicalypse<T>(
  endpoint: string,
  body: string,
  auth: IgdbAuth,
  allowRetry = true
): Promise<T[]> {
  const token = await getToken(auth);

  let response: Response;
  try {
    response = await fetch(`${API_URL}/${endpoint}`, {
      method: "POST",
      headers: {
        "Client-ID": auth.clientId,
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
      body,
    });
  } catch {
    throw new IgdbError("network", "Failed to reach IGDB.");
  }

  if (response.status === 401 && allowRetry) {
    resetIgdbToken();
    return apicalypse<T>(endpoint, body, auth, false);
  }

  if (response.status === 429 && allowRetry) {
    await wait(RATE_LIMIT_BACKOFF_MS);
    return apicalypse<T>(endpoint, body, auth, false);
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new IgdbError(
      "server",
      `IGDB ${response.status}: ${detail.slice(0, 200)}`
    );
  }

  return (await response.json()) as T[];
}

function mapGame(raw: RawGame): Game {
  const platforms = raw.platforms
    ?.map((p) =>
      typeof p.id === "number" && p.name ? { id: p.id, name: p.name } : null
    )
    .filter((value): value is Platform => value !== null);

  return {
    id: raw.id,
    name: raw.name,
    year: raw.first_release_date
      ? new Date(raw.first_release_date * 1000).getFullYear()
      : undefined,
    coverUrl: raw.cover?.image_id ? coverUrl(raw.cover.image_id) : undefined,
    platforms: platforms && platforms.length > 0 ? platforms : undefined,
    ...storedRatings(raw),
  };
}

const GAME_FIELDS = `fields name, first_release_date, cover.image_id, platforms.name, ${RATING_FIELDS};`;

/** `where` clause restricting results to games released on any of the platforms. */
const platformFilter = (platformIds: readonly number[] = []) =>
  platformIds.length > 0
    ? ` where platforms = (${platformIds.join(",")});`
    : "";

export async function searchGames(
  query: string,
  auth: IgdbAuth,
  platformIds: readonly number[] = []
): Promise<Game[]> {
  const safeQuery = safeSearchTerm(query);
  if (!safeQuery) {
    return [];
  }
  const body = `search "${safeQuery}"; ${GAME_FIELDS}${platformFilter(platformIds)} limit 30;`;
  const raw = await apicalypse<RawGame>("games", body, auth);
  return raw.map(mapGame);
}

const safeSearchTerm = (query: string) => query.replace(/["\\]/g, " ").trim();

function mapCandidate(raw: RawGame): MatchCandidate {
  const altNames = raw.alternative_names
    ?.map((alt) => alt.name)
    .filter((value): value is string => Boolean(value));
  return {
    ...mapGame(raw),
    altNames: altNames && altNames.length > 0 ? altNames : undefined,
    gameType: raw.game_type,
    ratingCount: raw.total_rating_count,
    versionParent: raw.version_parent,
  };
}

/** Drops the matching-only fields so lists and the library store a plain Game. */
export function toGame(candidate: MatchCandidate): Game {
  const { altNames, gameType, ratingCount, versionParent, ...game } = candidate;
  return game;
}

const CANDIDATE_FIELDS = `fields name, first_release_date, cover.image_id, platforms.name, ${RATING_FIELDS}, game_type, alternative_names.name, total_rating_count, version_parent;`;
const CANDIDATE_LIMIT = 20;

/**
 * Searches each title on IGDB (`search` sorted by similarity, optionally
 * restricted to games released on the given platforms), one request per title
 * paced under the rate limit. Returns candidates keyed by `query.key`; a title
 * with no result maps to an empty array.
 */
export async function searchGamesBatch(
  queries: CandidateQuery[],
  auth: IgdbAuth
): Promise<Record<string, MatchCandidate[]>> {
  const out: Record<string, MatchCandidate[]> = {};
  let first = true;
  for (const query of queries) {
    out[query.key] = [];
    const term = safeSearchTerm(query.text);
    if (!term) {
      continue;
    }
    if (!first) {
      await wait(SEARCH_SPACING_MS);
    }
    first = false;
    const body = `search "${term}"; ${CANDIDATE_FIELDS}${platformFilter(query.platformIds)} limit ${CANDIDATE_LIMIT};`;
    const raw = await apicalypse<RawGame>("games", body, auth);
    out[query.key] = raw.map(mapCandidate);
  }
  return out;
}

// IGDB's maximum `limit` per request.
const RATINGS_CHUNK = 500;

const NO_RATINGS: StoredRatings = {
  igdbRating: null,
  igdbUserRating: null,
  igdbCriticRating: null,
};

/**
 * IGDB ratings for each id (null where IGDB has none), fetched in chunks of
 * 500 — used to fill in games saved before ratings were stored.
 */
export async function fetchRatings(
  ids: number[],
  auth: IgdbAuth
): Promise<Record<number, StoredRatings>> {
  const out: Record<number, StoredRatings> = {};
  for (const id of ids) {
    out[id] = NO_RATINGS;
  }
  for (let start = 0; start < ids.length; start += RATINGS_CHUNK) {
    if (start > 0) {
      await wait(SEARCH_SPACING_MS);
    }
    const chunk = ids.slice(start, start + RATINGS_CHUNK);
    const body = `fields ${RATING_FIELDS}; where id = (${chunk.join(",")}); limit ${RATINGS_CHUNK};`;
    const raw = await apicalypse<RawRatings & { id: number }>(
      "games",
      body,
      auth
    );
    for (const game of raw) {
      out[game.id] = storedRatings(game);
    }
  }
  return out;
}

export const PLATFORM_PAGE_SIZE = 30;

export async function gamesByPlatform(
  platformId: number,
  auth: IgdbAuth,
  offset = 0
): Promise<Game[]> {
  const body = `${GAME_FIELDS} where platforms = (${platformId}) & cover != null; sort total_rating_count desc; limit ${PLATFORM_PAGE_SIZE}; offset ${offset};`;
  const raw = await apicalypse<RawGame>("games", body, auth);
  return raw.map(mapGame);
}

const detailsCache = new Map<number, GameDetails>();

export async function getGameDetails(
  id: number,
  auth: IgdbAuth
): Promise<GameDetails> {
  const cached = detailsCache.get(id);
  if (cached) {
    return cached;
  }
  const body = `fields summary, screenshots.image_id, ${RATING_FIELDS}; where id = ${id}; limit 1;`;
  const raw = await apicalypse<RawGameDetails>("games", body, auth);
  const first = raw[0];
  const screenshots = (first?.screenshots ?? [])
    .map((shot) => shot.image_id)
    .filter((value): value is string => Boolean(value))
    .map((imageId) => coverUrl(imageId, "t_screenshot_big"));
  const details: GameDetails = {
    summary: first?.summary,
    screenshots,
    ratings: {
      users: roundRating(first?.rating),
      critics: roundRating(first?.aggregated_rating),
      total: roundRating(first?.total_rating),
    },
  };
  detailsCache.set(id, details);
  return details;
}
