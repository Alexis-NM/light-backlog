// Free, keyless translation via Google's public translate endpoint.
// Used for game summaries (IGDB only provides English). Best-effort: returns
// null on failure so callers can fall back to the original text.

type TranslateResponse = [string[][], ...unknown[]];

const cache = new Map<string, string>();

export async function translateText(
  text: string,
  target: string
): Promise<string | null> {
  const trimmed = text.trim();
  if (!trimmed) {
    return null;
  }

  const key = `${target}:${trimmed}`;
  const cached = cache.get(key);
  if (cached) {
    return cached;
  }

  const url =
    "https://translate.googleapis.com/translate_a/single" +
    `?client=gtx&sl=auto&tl=${target}&dt=t&q=${encodeURIComponent(trimmed)}`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      return null;
    }
    const data = (await response.json()) as TranslateResponse;
    const segments = data[0];
    if (!Array.isArray(segments)) {
      return null;
    }
    const translated = segments.map((segment) => segment[0]).join("");
    cache.set(key, translated);
    return translated;
  } catch {
    return null;
  }
}
