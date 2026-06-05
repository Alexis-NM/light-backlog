// Resolves a list of game titles from a Backloggd list URL, a raw CSV/MD URL,
// or pasted CSV/MD/plain text. Backloggd blocks bots, but a browser User-Agent
// gets through, so we fetch the list pages and scrape the game titles.

const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

const PAGE_SIZE = 100;
const MAX_PAGES = 20;

const ENTITY_NUM_RE = /&#(\d+);/g;
const ENTITY_QUOT_RE = /&quot;/g;
const ENTITY_APOS_RE = /&apos;/g;
const ENTITY_LT_RE = /&lt;/g;
const ENTITY_GT_RE = /&gt;/g;
const ENTITY_AMP_RE = /&amp;/g;
const LIST_TITLE_RE = /class="game-text-centered"[^>]*>\s*([^<]+)/g;
const NEWLINE_RE = /\r?\n/;
const DELIM_RE = /[,;]/;
const HEADER_RE = /name|title|game/i;
const LIST_MARKER_RE = /^[-*+]\s+/;
const ORDERED_RE = /^\d+\.\s+/;
const MD_LINK_RE = /\[([^\]]+)\]\([^)]*\)/;
const QUOTE_TRIM_RE = /^["']|["']$/g;
const HEADER_ONLY_RE = /^(name|title|game)$/i;
const URL_RE = /^https?:\/\//i;
const TRAILING_SLASH_RE = /\/+$/;

function decodeEntities(value: string): string {
  return value
    .replace(ENTITY_NUM_RE, (_, code) => String.fromCharCode(Number(code)))
    .replace(ENTITY_QUOT_RE, '"')
    .replace(ENTITY_APOS_RE, "'")
    .replace(ENTITY_LT_RE, "<")
    .replace(ENTITY_GT_RE, ">")
    .replace(ENTITY_AMP_RE, "&");
}

function parseListHtml(html: string): string[] {
  const out: string[] = [];
  for (const match of html.matchAll(LIST_TITLE_RE)) {
    out.push(decodeEntities(match[1].trim()));
  }
  return out;
}

async function fetchBackloggdList(url: string): Promise<string[]> {
  const base = url.split("?")[0].replace(TRAILING_SLASH_RE, "");
  const seen = new Set<string>();
  const titles: string[] = [];

  for (let page = 1; page <= MAX_PAGES; page++) {
    let response: Response;
    try {
      response = await fetch(`${base}/?page=${page}`, {
        headers: { "User-Agent": BROWSER_UA, Accept: "text/html" },
      });
    } catch {
      break;
    }
    if (!response.ok) {
      break;
    }
    const html = await response.text();
    const pageTitles = parseListHtml(html);
    let added = 0;
    for (const title of pageTitles) {
      if (!seen.has(title)) {
        seen.add(title);
        titles.push(title);
        added++;
      }
    }
    if (added === 0 || pageTitles.length < PAGE_SIZE) {
      break;
    }
  }

  return titles;
}

function splitCsv(line: string): string[] {
  const out: string[] = [];
  let current = "";
  let inQuotes = false;
  for (const char of line) {
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if ((char === "," || char === ";") && !inQuotes) {
      out.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  out.push(current);
  return out.map((cell) => cell.trim());
}

export function parseGameTitles(text: string): string[] {
  const lines = text.split(NEWLINE_RE);
  const out: string[] = [];

  let hasHeader = false;
  let nameIndex = 0;
  if (lines.length > 0 && DELIM_RE.test(lines[0]) && HEADER_RE.test(lines[0])) {
    hasHeader = true;
    const idx = splitCsv(lines[0]).findIndex((col) => HEADER_RE.test(col));
    nameIndex = idx >= 0 ? idx : 0;
  }

  for (let i = 0; i < lines.length; i++) {
    if (hasHeader && i === 0) {
      continue;
    }
    let line = lines[i].trim();
    if (!line) {
      continue;
    }
    if (hasHeader || DELIM_RE.test(line)) {
      const cols = splitCsv(line);
      line = (cols[nameIndex] ?? cols[0] ?? "").trim();
    }
    line = line.replace(LIST_MARKER_RE, "").replace(ORDERED_RE, "");
    const link = line.match(MD_LINK_RE);
    if (link) {
      line = link[1];
    }
    line = line.replace(QUOTE_TRIM_RE, "").trim();
    if (line && !HEADER_ONLY_RE.test(line)) {
      out.push(line);
    }
  }

  return Array.from(new Set(out));
}

export async function resolveTitles(source: string): Promise<string[]> {
  const trimmed = source.trim();
  if (URL_RE.test(trimmed)) {
    if (trimmed.includes("backloggd.com")) {
      return await fetchBackloggdList(trimmed);
    }
    const response = await fetch(trimmed);
    const text = await response.text();
    return parseGameTitles(text);
  }
  return parseGameTitles(trimmed);
}
