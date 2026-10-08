import { cacheLife } from "next/cache";
import { withoutFeat } from "./clean-title";

type ItunesResult = {
  artistName: string;
  trackName: string;
  collectionName?: string;
  artworkUrl100?: string;
};

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();

/** Square album cover from the iTunes Search API, or null if nothing plausible matched. */
export async function findArtwork(artist: string, title: string): Promise<string | null> {
  "use cache";
  cacheLife("weeks");

  const term = `${artist} ${withoutFeat(title)}`.trim();
  const res = await fetch(
    `https://itunes.apple.com/search?${new URLSearchParams({ term, entity: "song", limit: "25" })}`,
  );
  if (!res.ok) throw new Error(`iTunes ${res.status}`);
  const { results } = (await res.json()) as { results: ItunesResult[] };

  const a = norm(artist);
  const t = norm(withoutFeat(title));
  // Remixes, live albums and compilations carry their own covers; prefer the original release.
  const variant = /\b(remix|live|acoustic|version|edit|mix|karaoke|instrumental|sped|slowed|deluxe|greatest|hits|best of|anthology)\b/i;
  const titleHasVariant = variant.test(title);
  let match: ItunesResult | null = null;
  let bestScore = -Infinity;
  for (const [rank, r] of results.entries()) {
    if (!r.artworkUrl100) continue;
    const ra = norm(r.artistName);
    const rt = norm(withoutFeat(r.trackName));
    const artistOk = !a || ra.includes(a) || a.includes(ra);
    const titleOk = rt.includes(t) || t.includes(rt);
    if (!artistOk || !titleOk) continue;
    let score = -rank;
    if (rt === t) score += 6;
    if (ra === a) score += 2;
    if (!titleHasVariant && variant.test(r.trackName)) score -= 10;
    if (!titleHasVariant && variant.test(r.collectionName ?? "")) score -= 4;
    if (r.collectionName && norm(r.collectionName) === t) score += 1; // the single
    if (score > bestScore) {
      bestScore = score;
      match = r;
    }
  }

  return match?.artworkUrl100?.replace(/\/\d+x\d+bb\.(jpg|png)$/, "/1000x1000bb.$1") ?? null;
}
