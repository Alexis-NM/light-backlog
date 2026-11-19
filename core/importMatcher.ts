// Picks the right IGDB game for each title of an imported list.
//
// Pure module: the IGDB search is injected, so the same logic runs in the app,
// in `bun test` (fake search) and in `scripts/test-import.ts` (live API).
//
// For each title, candidates come from an IGDB `search` restricted to the
// list's consoles (or a per-title hint such as "Halo (Xbox)"); each candidate
// is then scored on name similarity, game type (main game vs DLC/bundle…),
// year hint and popularity. Titles with nothing on the chosen consoles are
// retried without the platform filter and flagged for review.
//
// A search that fails is tried once more. If it fails again, the import ends
// there and keeps what it found: the titles it did not reach are told apart
// from those IGDB does not know.

import { platformIdFor, platformIdsFor } from "./consoles";
import type { CandidateQuery, MatchCandidate } from "./igdb";

export interface TitleHints {
  /** IGDB platform ids from a trailing "(PS2)"-style hint. */
  platformIds?: number[];
  title: string;
  year?: number;
}

export type MatchConfidence = "exact" | "good" | "uncertain";

export interface ImportMatch {
  confidence?: MatchConfidence;
  game?: MatchCandidate;
  /** False when consoles were requested and the pick is not released on them. */
  onPlatform: boolean;
  /** The title as it was typed. */
  title: string;
  /** The search failed before reaching this title: it was not looked up. */
  unsearched?: boolean;
}

export type SearchBatch = (
  queries: CandidateQuery[]
) => Promise<Record<string, MatchCandidate[]>>;

export interface MatchOptions {
  batchSize?: number;
  /** Console names as picked in the app (see consoles.ts). */
  consoles?: readonly string[];
  /** Pause between two search requests (IGDB allows 4 per second). */
  delayMs?: number;
  onProgress?: (done: number, total: number) => void;
  /** Pause before the second try of a search that failed. */
  retryDelayMs?: number;
}

// ---------------------------------------------------------------------------
// Title hints: "Doom (2016)", "Halo [Xbox]", "Doom - PC"

const SEPARATOR_RE = /\s+[-–—|]\s+|:\s+/;
const TRAILING_HINT_RE =
  /(?:\s*[([]([^()[\]]{1,30})[)\]]|\s+[-–—]\s+([^-–—]{1,20}))\s*$/;
const YEAR_RE = /^(19|20)\d{2}$/;

export function parseTitleHints(raw: string): TitleHints {
  let title = raw.trim();
  let year: number | undefined;
  let platformIds: number[] | undefined;

  // A title may carry both hints, in any order: "Halo (Xbox) (2001)".
  for (let pass = 0; pass < 2; pass++) {
    const match = title.match(TRAILING_HINT_RE);
    const hint = (match?.[1] ?? match?.[2])?.trim();
    if (!(match && hint)) {
      break;
    }
    if (YEAR_RE.test(hint)) {
      year = Number(hint);
    } else {
      const platformId = platformIdFor(hint);
      if (platformId === undefined) {
        break; // not a hint — part of the title
      }
      platformIds = [platformId];
    }
    title = title.slice(0, match.index).trim();
  }

  return { title: title || raw.trim(), year, platformIds };
}

/** The part before a " - " or ":" separator, when there is one. */
export function baseTitle(title: string): string | undefined {
  const cut = title.split(SEPARATOR_RE)[0]?.trim();
  return cut && cut !== title.trim() ? cut : undefined;
}

// ---------------------------------------------------------------------------
// Name normalisation

const DIACRITICS_RE = /[\u0300-\u036f]/g;
const AMPERSAND_RE = /&/g;
const NON_ALNUM_RE = /[^a-z0-9]+/g;
const ROMAN_TOKEN_RE = /^(?=[ivx]+$)x{0,3}(?:ix|iv|v?i{0,3})$/;
const LEADING_ARTICLE_RE = /^(?:the|a|an) /;
const ROMAN_VALUES: Record<string, number> = { i: 1, v: 5, x: 10 };

function romanToInt(token: string): number {
  let total = 0;
  for (let i = 0; i < token.length; i++) {
    const value = ROMAN_VALUES[token[i]];
    const next = ROMAN_VALUES[token[i + 1]] ?? 0;
    total += value < next ? -value : value;
  }
  return total;
}

/** Lower-case ASCII words only: "Pokémon: Red & Blue!" → "pokemon red and blue". */
export function normalizeTitle(raw: string): string {
  return raw
    .normalize("NFKD")
    .replace(DIACRITICS_RE, "")
    .toLowerCase()
    .replace(AMPERSAND_RE, " and ")
    .replace(NON_ALNUM_RE, " ")
    .trim();
}

/** Normalised title with Roman numerals as digits and no leading article. */
export function looseTitle(normalized: string): string {
  return normalized
    .replace(LEADING_ARTICLE_RE, "")
    .split(" ")
    .map((token) =>
      ROMAN_TOKEN_RE.test(token) ? String(romanToInt(token)) : token
    )
    .join(" ");
}

// ---------------------------------------------------------------------------
// Similarity

const EDITION_RE =
  /\b(?:edition|remaster(?:ed)?|hd|definitive|complete|special|deluxe|goty|game of the year|collection|anniversary|directors? cut|remake|enhanced|ultimate|gold|plus|dx|trilogy|legacy|redux|reloaded|vr|3d|international|intergrade|royal|golden|portable|advance|turbo|arcade|online|mobile|demo|beta)\b/;

function bigrams(text: string): Map<string, number> {
  const out = new Map<string, number>();
  for (let i = 0; i < text.length - 1; i++) {
    const gram = text.slice(i, i + 2);
    out.set(gram, (out.get(gram) ?? 0) + 1);
  }
  return out;
}

/** Sørensen–Dice coefficient on character bigrams, 0..1. */
function diceCoefficient(a: string, b: string): number {
  if (a.length < 2 || b.length < 2) {
    return a === b ? 1 : 0;
  }
  const gramsA = bigrams(a);
  const gramsB = bigrams(b);
  let shared = 0;
  for (const [gram, count] of gramsA) {
    shared += Math.min(count, gramsB.get(gram) ?? 0);
  }
  return (2 * shared) / (a.length - 1 + (b.length - 1));
}

/**
 * How well a typed title designates a candidate name, 0..1.
 * 1 exact · 0.97 same up to numerals/article · ≥0.85 title + subtitle ·
 * ≥0.7 title inside the name · else bigram similarity capped at 0.9.
 */
export function titleSimilarity(query: string, name: string): number {
  const strictQuery = normalizeTitle(query);
  const strictName = normalizeTitle(name);
  if (!(strictQuery && strictName)) {
    return 0;
  }
  if (strictQuery === strictName) {
    return 1;
  }
  const loose = looseTitle(strictQuery);
  const looseName = looseTitle(strictName);
  if (loose === looseName) {
    return 0.97;
  }
  const coverage = loose.length / looseName.length;
  if (looseName.startsWith(`${loose} `)) {
    const rest = looseName.slice(loose.length + 1);
    return (EDITION_RE.test(rest) ? 0.8 : 0.85) + 0.1 * coverage;
  }
  if (` ${looseName} `.includes(` ${loose} `)) {
    return 0.7 + 0.15 * coverage;
  }
  return diceCoefficient(loose, looseName) * 0.9;
}

// ---------------------------------------------------------------------------
// Scoring

// IGDB game_type ids (same values as the former `category` enum).
const MAIN_GAME = 0;
const TYPE_PENALTY: Record<number, number> = {
  1: 0.15, // dlc_addon
  2: 0.15, // expansion
  3: 0.15, // bundle
  4: 0.05, // standalone_expansion
  5: 0.15, // mod
  6: 0.15, // episode
  7: 0.15, // season
  8: 0.02, // remake
  9: 0.02, // remaster
  10: 0.03, // expanded_game
  11: 0.03, // port
  12: 0.15, // fork
  13: 0.15, // pack
  14: 0.15, // update
};
const VERSION_PENALTY = 0.05;
const OFF_PLATFORM_PENALTY = 0.3;
const YEAR_BONUS = 0.1;
const POPULARITY_BONUS = 0.02;
const POPULARITY_CAP = 500;

/** Below this name similarity a candidate is not taken (title "not found"). */
const MIN_NAME_SCORE = 0.45;
const EXACT_THRESHOLD = 0.95;
const GOOD_THRESHOLD = 0.72;

function isOnPlatform(
  candidate: MatchCandidate,
  platformIds: readonly number[]
): boolean {
  return (
    platformIds.length === 0 ||
    (candidate.platforms ?? []).some((p) => platformIds.includes(p.id))
  );
}

interface CandidateScore {
  nameScore: number;
  score: number;
}

function scoreCandidate(
  hints: TitleHints,
  candidate: MatchCandidate,
  platformIds: readonly number[] = []
): CandidateScore {
  const names = [candidate.name, ...(candidate.altNames ?? [])];
  const nameScore = Math.max(
    ...names.map((name) => titleSimilarity(hints.title, name))
  );

  let score = nameScore;
  score -= TYPE_PENALTY[candidate.gameType ?? MAIN_GAME] ?? 0;
  if (candidate.versionParent) {
    score -= VERSION_PENALTY;
  }
  if (!isOnPlatform(candidate, platformIds)) {
    score -= OFF_PLATFORM_PENALTY;
  }
  if (hints.year && candidate.year) {
    score +=
      Math.abs(candidate.year - hints.year) <= 1 ? YEAR_BONUS : -YEAR_BONUS;
  }
  score +=
    (Math.min(candidate.ratingCount ?? 0, POPULARITY_CAP) / POPULARITY_CAP) *
    POPULARITY_BONUS;

  return { nameScore, score };
}

export interface BestMatch {
  confidence: MatchConfidence;
  game: MatchCandidate;
  nameScore: number;
}

export function pickBestMatch(
  hints: TitleHints,
  candidates: readonly MatchCandidate[],
  platformIds: readonly number[] = []
): BestMatch | undefined {
  let best: (BestMatch & { score: number }) | undefined;
  for (const candidate of candidates) {
    const { nameScore, score } = scoreCandidate(hints, candidate, platformIds);
    if (nameScore < MIN_NAME_SCORE) {
      continue;
    }
    if (!best || score > best.score) {
      best = { game: candidate, nameScore, score, confidence: "uncertain" };
    }
  }
  if (!best) {
    return;
  }
  best.confidence = readsLetterAsNumber(hints.title, best.game)
    ? "uncertain"
    : confidenceOf(best.nameScore);
  return best;
}

const LONE_ROMAN_LETTER_RE = /(?:^| )[ivx](?: |$)/;

/**
 * "Mega Man X" is not "Mega Man 10": a single letter read as a Roman numeral
 * may just be a letter. A game found only by reading it as a number is worth
 * a check, however close the names then look.
 */
function readsLetterAsNumber(title: string, game: MatchCandidate): boolean {
  const typed = normalizeTitle(title);
  if (!LONE_ROMAN_LETTER_RE.test(typed)) {
    return false;
  }
  const names = [game.name, ...(game.altNames ?? [])].map(normalizeTitle);
  return (
    !names.includes(typed) &&
    names.some((name) => looseTitle(name) === looseTitle(typed))
  );
}

function confidenceOf(nameScore: number): MatchConfidence {
  if (nameScore >= EXACT_THRESHOLD) {
    return "exact";
  }
  return nameScore >= GOOD_THRESHOLD ? "good" : "uncertain";
}

// ---------------------------------------------------------------------------
// Orchestration

// Progress is reported once per batch; the search itself paces its requests.
const DEFAULT_BATCH_SIZE = 5;
const DEFAULT_DELAY_MS = 260;
const DEFAULT_RETRY_DELAY_MS = 2000;

const wait = (ms: number) =>
  ms > 0 ? new Promise((resolve) => setTimeout(resolve, ms)) : undefined;

interface Entry {
  hints: TitleHints;
  key: string;
  platformIds: number[];
  result: ImportMatch;
  /** A search for this title went through, whatever it found. */
  searched: boolean;
}

interface PassOptions {
  batchSize: number;
  delayMs: number;
  filtered: boolean;
  /** A pick made from a shortened title is always reported as uncertain. */
  forceUncertain?: boolean;
  retryDelayMs: number;
  /** The title sent to IGDB and scored against. */
  termOf: (entry: Entry) => string;
}

/** A hiccup of the network passes: a search that fails is tried once more. */
async function searchTwice(
  search: SearchBatch,
  queries: CandidateQuery[],
  retryDelayMs: number
) {
  try {
    return await search(queries);
  } catch {
    await wait(retryDelayMs);
    return search(queries);
  }
}

async function runPass(
  entries: Entry[],
  search: SearchBatch,
  options: PassOptions,
  onBatchDone?: (count: number) => void
) {
  for (let start = 0; start < entries.length; start += options.batchSize) {
    if (start > 0) {
      await wait(options.delayMs);
    }
    const batch = entries.slice(start, start + options.batchSize);
    const found = await searchTwice(
      search,
      batch.map((entry) => ({
        key: entry.key,
        text: options.termOf(entry),
        platformIds: options.filtered ? entry.platformIds : undefined,
      })),
      options.retryDelayMs
    );
    for (const entry of batch) {
      entry.searched = true;
      const best = pickBestMatch(
        { ...entry.hints, title: options.termOf(entry) },
        found[entry.key] ?? [],
        entry.platformIds
      );
      if (best) {
        entry.result.game = best.game;
        entry.result.confidence = options.forceUncertain
          ? "uncertain"
          : best.confidence;
        entry.result.onPlatform = isOnPlatform(best.game, entry.platformIds);
      }
    }
    onBatchDone?.(batch.length);
  }
}

const fullTitle = (entry: Entry) => entry.hints.title;
const shortTitle = (entry: Entry) => baseTitle(entry.hints.title) ?? "";

/**
 * Matches every typed title to an IGDB game. Progress counts titles whose
 * platform-restricted search is done; the retries of the few titles left
 * over (without the platform filter, then with the title cut at its first
 * separator) are not reported separately.
 *
 * When the search keeps failing, what was found so far is returned, and the
 * titles not reached are marked `unsearched`. With nothing found yet, the
 * failure is thrown, for the caller to tell why.
 */
export async function matchImportTitles(
  titles: readonly string[],
  search: SearchBatch,
  options: MatchOptions = {}
): Promise<ImportMatch[]> {
  const listPlatforms = platformIdsFor(options.consoles ?? []);
  const batchSize = options.batchSize ?? DEFAULT_BATCH_SIZE;
  const delayMs = options.delayMs ?? DEFAULT_DELAY_MS;
  const retryDelayMs = options.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS;

  const entries: Entry[] = titles.map((title, index) => {
    const hints = parseTitleHints(title);
    return {
      key: `q${index}`,
      hints,
      platformIds: hints.platformIds ?? listPlatforms,
      result: { title, onPlatform: true },
      searched: false,
    };
  });

  let done = 0;
  const pass = async (
    candidates: Entry[],
    passOptions: Omit<PassOptions, "batchSize" | "delayMs" | "retryDelayMs">,
    onBatchDone?: (count: number) => void
  ) => {
    const pending = candidates.filter(
      (entry) => !entry.result.game && passOptions.termOf(entry) !== ""
    );
    if (pending.length === 0) {
      return;
    }
    if (done > 0) {
      await wait(delayMs);
    }
    await runPass(
      pending,
      search,
      { batchSize, delayMs, retryDelayMs, ...passOptions },
      onBatchDone
    );
  };
  // Dropping the platform filter only makes sense where there was one.
  const restricted = entries.filter((entry) => entry.platformIds.length > 0);

  try {
    await pass(entries, { filtered: true, termOf: fullTitle }, (count) => {
      done += count;
      options.onProgress?.(done, entries.length);
    });
    await pass(restricted, { filtered: false, termOf: fullTitle });
    await pass(entries, {
      filtered: true,
      termOf: shortTitle,
      forceUncertain: true,
    });
    await pass(restricted, {
      filtered: false,
      termOf: shortTitle,
      forceUncertain: true,
    });
  } catch (error) {
    if (!entries.some((entry) => entry.result.game)) {
      throw error;
    }
  }

  return entries.map((entry) =>
    entry.searched ? entry.result : { ...entry.result, unsearched: true }
  );
}
