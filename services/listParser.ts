// Parses game titles from pasted text or a CSV/Markdown file's contents.
// Accepts: one title per line, Markdown lists/links, or CSV (with or without a
// Name/Title/Game header column).

const NEWLINE_RE = /\r?\n/;
const DELIM_RE = /[,;]/;
const HEADER_RE = /name|title|game/i;
const LIST_MARKER_RE = /^[-*+]\s+/;
const ORDERED_RE = /^\d+\.\s+/;
const MD_LINK_RE = /\[([^\]]+)\]\([^)]*\)/;
const QUOTE_TRIM_RE = /^["']|["']$/g;
const HEADER_ONLY_RE = /^(name|title|game)$/i;

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
