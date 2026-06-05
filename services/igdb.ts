import type { Game, Platform } from "@/types/game";

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

interface RawGame {
  cover?: { image_id?: string };
  first_release_date?: number;
  id: number;
  name: string;
  platforms?: { id?: number; name?: string }[];
}

interface RawGameDetails {
  id: number;
  screenshots?: { image_id?: string }[];
  summary?: string;
}

export interface GameDetails {
  screenshots: string[];
  summary?: string;
}

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
  };
}

const GAME_FIELDS =
  "fields name, first_release_date, cover.image_id, platforms.name;";

export async function searchGames(
  query: string,
  auth: IgdbAuth
): Promise<Game[]> {
  const safeQuery = query.replace(/["\\]/g, " ").trim();
  if (!safeQuery) {
    return [];
  }
  const body = `search "${safeQuery}"; ${GAME_FIELDS} limit 30;`;
  const raw = await apicalypse<RawGame>("games", body, auth);
  return raw.map(mapGame);
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
  const body = `fields summary, screenshots.image_id; where id = ${id}; limit 1;`;
  const raw = await apicalypse<RawGameDetails>("games", body, auth);
  const first = raw[0];
  const screenshots = (first?.screenshots ?? [])
    .map((shot) => shot.image_id)
    .filter((value): value is string => Boolean(value))
    .map((imageId) => coverUrl(imageId, "t_screenshot_big"));
  const details: GameDetails = { summary: first?.summary, screenshots };
  detailsCache.set(id, details);
  return details;
}
