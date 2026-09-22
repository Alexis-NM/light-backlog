// Runs the list-import matcher against the live IGDB API on the sample lists
// in scripts/import-tests/*.json and compares each pick with the expected
// game. Also shows what the naive "first search result" would have picked.
//
//   IGDB_CLIENT_ID=… IGDB_CLIENT_SECRET=… bun run test:import [--no-baseline] [list-name-filter]

import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { type IgdbAuth, searchGames, searchGamesBatch } from "../services/igdb";
import {
  type ImportMatch,
  matchImportTitles,
  normalizeTitle,
  parseTitleHints,
} from "../services/importMatcher";

interface Expectation {
  expect: string | string[];
  title: string;
  year?: number;
}

interface TestList {
  consoles: string[];
  entries: Expectation[];
  name: string;
}

const TESTS_DIR = join(dirname(fileURLToPath(import.meta.url)), "import-tests");
const BASELINE_DELAY_MS = 260;

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function loadAuth(): IgdbAuth {
  const clientId = process.env.IGDB_CLIENT_ID;
  const clientSecret = process.env.IGDB_CLIENT_SECRET;
  if (!(clientId && clientSecret)) {
    console.error(
      "Set IGDB_CLIENT_ID and IGDB_CLIENT_SECRET (Twitch application credentials)."
    );
    process.exit(1);
  }
  return { clientId, clientSecret };
}

function loadLists(filter?: string): TestList[] {
  return readdirSync(TESTS_DIR)
    .filter((file) => file.endsWith(".json"))
    .sort()
    .map(
      (file) =>
        JSON.parse(readFileSync(join(TESTS_DIR, file), "utf8")) as TestList
    )
    .filter(
      (list) =>
        !filter || list.name.toLowerCase().includes(filter.toLowerCase())
    );
}

function isExpected(
  expectation: Expectation,
  picked?: { name: string; year?: number }
): boolean {
  if (!picked) {
    return false;
  }
  const names = Array.isArray(expectation.expect)
    ? expectation.expect
    : [expectation.expect];
  const sameName = names.some(
    (name) => normalizeTitle(name) === normalizeTitle(picked.name)
  );
  const sameYear =
    expectation.year === undefined || picked.year === expectation.year;
  return sameName && sameYear;
}

const describe = (game?: { name: string; year?: number }) =>
  game ? `${game.name}${game.year ? ` (${game.year})` : ""}` : "—";

async function runBaseline(list: TestList, auth: IgdbAuth) {
  const picks: Pick[] = [];
  for (const entry of list.entries) {
    const found = await searchGames(parseTitleHints(entry.title).title, auth);
    picks.push(found[0]);
    await wait(BASELINE_DELAY_MS);
  }
  return picks;
}

type Pick = { name: string; year?: number } | undefined;

function describeLine(entry: Expectation, match: ImportMatch, baseline?: Pick) {
  const good = isExpected(entry, match.game);
  const flags = [
    match.confidence ?? "none",
    match.onPlatform ? "" : "off-console",
  ]
    .filter(Boolean)
    .join(", ");
  let line = `${good ? "✓" : "✗"} ${entry.title} → ${describe(match.game)} [${flags}]`;
  if (!good) {
    const expected = Array.isArray(entry.expect)
      ? entry.expect.join(" | ")
      : entry.expect;
    line += `   expected ${expected}${entry.year ? ` (${entry.year})` : ""}`;
  }
  if (baseline !== undefined && !isExpected(entry, baseline)) {
    line += `   | first result: ${describe(baseline)}`;
  }
  return line;
}

function report(list: TestList, matches: ImportMatch[], baseline?: Pick[]) {
  let ok = 0;
  let baselineOk = 0;
  console.log(
    `\n== ${list.name} [${list.consoles.join(", ") || "no console"}] — ${list.entries.length} titles`
  );
  list.entries.forEach((entry, index) => {
    ok += isExpected(entry, matches[index].game) ? 1 : 0;
    baselineOk += baseline && isExpected(entry, baseline[index]) ? 1 : 0;
    console.log(describeLine(entry, matches[index], baseline?.[index]));
  });
  const baseText = baseline
    ? ` · first-result baseline ${baselineOk}/${list.entries.length}`
    : "";
  console.log(`   matcher ${ok}/${list.entries.length}${baseText}`);
  return { ok, baselineOk, total: list.entries.length };
}

async function main() {
  const args = process.argv.slice(2);
  const withBaseline = !args.includes("--no-baseline");
  const filter = args.find((arg) => !arg.startsWith("--"));
  const auth = loadAuth();
  const lists = loadLists(filter);
  if (lists.length === 0) {
    console.error("No test list matches.");
    process.exit(1);
  }

  const totals = { ok: 0, baselineOk: 0, total: 0 };
  for (const list of lists) {
    const started = Date.now();
    const matches = await matchImportTitles(
      list.entries.map((entry) => entry.title),
      (queries) => searchGamesBatch(queries, auth),
      { consoles: list.consoles }
    );
    const elapsed = ((Date.now() - started) / 1000).toFixed(1);
    const baseline = withBaseline ? await runBaseline(list, auth) : undefined;
    const result = report(list, matches, baseline);
    console.log(`   (${elapsed}s for the matcher)`);
    totals.ok += result.ok;
    totals.baselineOk += result.baselineOk;
    totals.total += result.total;
  }

  const baseText = withBaseline
    ? ` · first-result baseline ${totals.baselineOk}/${totals.total}`
    : "";
  console.log(`\nTOTAL matcher ${totals.ok}/${totals.total}${baseText}`);
  process.exit(totals.ok === totals.total ? 0 : 2);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
