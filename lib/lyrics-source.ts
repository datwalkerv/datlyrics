import { cacheLife } from "next/cache";
import { parseLrc, type LyricLine } from "./lrc";
import { withoutFeat } from "./clean-title";

export type LyricsResult = {
  synced: LyricLine[] | null;
  plain: string | null;
  instrumental: boolean;
};

type LrcRecord = {
  id: number;
  trackName: string;
  artistName: string;
  duration: number;
  instrumental: boolean;
  plainLyrics: string | null;
  syncedLyrics: string | null;
};

const LRCLIB = "https://lrclib.net/api";
const UA = "datlyrics/0.1 (YouTube lyrics player)";

async function lrclib<T>(path: string, params: Record<string, string>): Promise<T | null> {
  const res = await fetch(`${LRCLIB}${path}?${new URLSearchParams(params)}`, {
    headers: { "User-Agent": UA, "Lrclib-Client": UA },
  });
  if (res.status === 404) return null;
  // Throw on other failures so a transient outage isn't cached as "no lyrics".
  if (!res.ok) throw new Error(`LRCLIB ${path} ${res.status}`);
  return (await res.json()) as T;
}

const norm = (s: string) =>
  withoutFeat(s)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();

function titleMatches(record: LrcRecord, title: string) {
  const a = norm(record.trackName);
  const b = norm(title);
  return !!a && !!b && (a.includes(b) || b.includes(a));
}

/** When the first sung line lands; two LRCs with the same value share one timeline. */
function firstLineTime(r: LrcRecord): number | null {
  if (!r.syncedLyrics) return null;
  const line = parseLrc(r.syncedLyrics).find((l) => /[\p{L}\p{N}]/u.test(l.text));
  return line?.time ?? null;
}

function pickBest(records: LrcRecord[], title: string, duration: number): LrcRecord | null {
  let best: LrcRecord | null = null;
  let bestScore = -Infinity;
  for (const r of records) {
    if (!r.syncedLyrics && !r.plainLyrics && !r.instrumental) continue;
    if (!titleMatches(r, title)) continue;
    const diff = duration > 0 ? Math.abs(r.duration - duration) : 0;
    // Music videos often run long (intros/outros), so tolerate drift but prefer close matches.
    if (diff > 45) continue;
    let score = (r.syncedLyrics ? 100 : 0) - Math.min(diff, 45) * 2;
    // People often upload the album timing under a music video's length. A timeline that mostly
    // appears on uploads of a clearly different length is borrowed, not timed for this one;
    // one confirmed by several same-length uploads is more trustworthy.
    const first = firstLineTime(r);
    if (first !== null && duration > 0) {
      let near = 0;
      let far = 0;
      for (const o of records) {
        if (o === r) continue;
        const f = firstLineTime(o);
        if (f === null || Math.abs(f - first) >= 1.5) continue;
        if (Math.abs(o.duration - r.duration) < 4) near++;
        else if (Math.abs(o.duration - r.duration) >= 10) far++;
      }
      if (far > near + 1) score -= 30;
      score += Math.min(near, 5);
    }
    if (score > bestScore) {
      bestScore = score;
      best = r;
    }
  }
  return best;
}

function toResult(r: LrcRecord | null): LyricsResult {
  if (!r) return { synced: null, plain: null, instrumental: false };
  const synced = r.syncedLyrics ? parseLrc(r.syncedLyrics) : null;
  return {
    synced: synced?.length ? synced : null,
    plain: r.plainLyrics?.trim() || null,
    instrumental: r.instrumental,
  };
}

export async function findLyrics(artist: string, title: string, duration: number): Promise<LyricsResult> {
  "use cache";
  cacheLife("weeks");

  const d = Math.round(duration);

  // Gather the exact match and the search results together: several uploads can share a length
  // with different timings, and pickBest needs them all to tell which one is genuinely timed.
  const candidates: LrcRecord[] = [];
  const [exact, byFields] = await Promise.all([
    artist && d > 0
      ? lrclib<LrcRecord>("/get", { artist_name: artist, track_name: withoutFeat(title), duration: String(d) })
      : null,
    artist ? lrclib<LrcRecord[]>("/search", { track_name: withoutFeat(title), artist_name: artist }) : null,
  ]);
  const seen = new Set<number>();
  const add = (rs: (LrcRecord | null)[]) => {
    for (const r of rs) {
      if (!r || seen.has(r.id)) continue;
      seen.add(r.id);
      candidates.push(r);
    }
  };
  add([exact, ...(byFields ?? [])]);
  let best = pickBest(candidates, title, d);
  if (!best?.syncedLyrics) {
    const q = `${artist} ${withoutFeat(title)}`.trim();
    add((await lrclib<LrcRecord[]>("/search", { q })) ?? []);
    best = pickBest(candidates, title, d);
  }
  return toResult(best);
}
