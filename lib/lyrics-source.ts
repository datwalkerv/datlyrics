import { cacheLife } from "next/cache";
import { parseLrc, type LyricLine } from "./lrc";
import { withoutFeat } from "./clean-title";

export type LyricsResult = {
  synced: LyricLine[] | null;
  plain: string | null;
  instrumental: boolean;
};

/** findLyrics' answer, plus whether nobody has the song synced (so it goes to datlrc's Needs list). */
export type LyricsLookup = LyricsResult & { needed: boolean };

type LrcRecord = {
  // LRCLIB's ids are numbers; lrc.red's are "red_<isrc>", datlrc's "lrc_<objectId>".
  id: number | string;
  trackName: string;
  artistName: string;
  duration: number;
  instrumental: boolean;
  plainLyrics: string | null;
  syncedLyrics: string | null;
};

// Sources, in order: LRCLIB, then lrc.red (synced only), then datlrc, our own small library, set
// with LYRICS_API=https://<datlrc host>/api and LYRICS_API_KEY. datlrc also collects songs nobody has.
const LRCLIB = "https://lrclib.net/api";
const LRCRED = "https://lrc.red";
const DATLRC = process.env.LYRICS_API;
const UA = "datlyrics/0.1 (YouTube lyrics player)";
// lrc.red's terms ask for a link and a contact email in the User-Agent.
const RED_UA = `datlyrics/0.1 (https://lyrics.datwalkerv.app${process.env.CONTACT_EMAIL ? `; ${process.env.CONTACT_EMAIL}` : ""})`;
const DATLRC_HEADERS = { "User-Agent": UA, ...(process.env.LYRICS_API_KEY && { "x-api-key": process.env.LYRICS_API_KEY }) };

async function fetchOk(url: string, headers: Record<string, string>): Promise<Response | null> {
  const res = await fetch(url, { headers });
  if (res.status === 404) return null;
  // Throw on other failures so a transient outage isn't cached as "no lyrics".
  if (!res.ok) throw new Error(`${new URL(url).host} ${res.status}`);
  return res;
}

async function lrclib<T>(path: string, params: Record<string, string>): Promise<T | null> {
  const res = await fetchOk(`${LRCLIB}${path}?${new URLSearchParams(params)}`, { "User-Agent": UA, "Lrclib-Client": UA });
  return res ? ((await res.json()) as T) : null;
}

const norm = (s: string) =>
  withoutFeat(s)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();

/** Either name contains the other, after `norm()` ("Song (Remastered)" matches "Song"). */
const near = (a: string, b: string) => !!a && !!b && (a.includes(b) || b.includes(a));

function titleMatches(record: LrcRecord, title: string) {
  return near(norm(record.trackName), norm(title));
}

type RedHit = { isrc: string; title: string; artist: string; duration: number };

/** lrc.red's search hit for this song by name, closest length first (its own ranking breaks ties). */
export function pickRedHit(hits: RedHit[], artist: string, title: string, duration: number): RedHit | null {
  const off = (h: RedHit) => (duration > 0 ? Math.abs(h.duration - duration) : 0);
  return (
    hits
      .filter((h) => /^[A-Z0-9]{12}$/i.test(h.isrc) && near(norm(h.title), norm(title)) && near(norm(h.artist), norm(artist)))
      .toSorted((x, y) => off(x) - off(y))[0] ?? null
  );
}

/**
 * lrc.red's synced lyrics. `record` is set only when its length is within 3s of `duration`;
 * `hasSynced` says whether it has the song timed at any length.
 */
async function fromLrcRed(artist: string, title: string, duration: number): Promise<{ record: LrcRecord | null; hasSynced: boolean }> {
  const headers = { "User-Agent": RED_UA };
  const found = await fetchOk(`${LRCRED}/search.json?${new URLSearchParams({ q: `${artist} ${withoutFeat(title)}` })}`, headers);
  const hit = pickRedHit(found ? (((await found.json()) as { hits?: RedHit[] }).hits ?? []) : [], artist, title, duration);
  const lrc = hit && (await (await fetchOk(`${LRCRED}/s/${hit.isrc}.lrc`, headers))?.text());
  // lrc.red can serve an .lrc without timestamps; only a timed one counts.
  if (!hit || !lrc || !parseLrc(lrc).some((l) => l.text)) return { record: null, hasSynced: false };
  const fits = duration <= 0 || Math.abs(hit.duration - duration) <= 3;
  return {
    hasSynced: true,
    record: fits
      ? { id: `red_${hit.isrc}`, trackName: hit.title, artistName: hit.artist, duration: hit.duration, instrumental: false, plainLyrics: null, syncedLyrics: lrc }
      : null,
  };
}

async function fromDatlrc(artist: string, title: string, duration: number): Promise<LrcRecord | null> {
  if (!DATLRC) return null;
  const params = new URLSearchParams({ artist_name: artist, track_name: withoutFeat(title), duration: String(duration) });
  const res = await fetchOk(`${DATLRC}/get?${params}`, DATLRC_HEADERS);
  return res ? ((await res.json()) as LrcRecord) : null;
}

/** Puts a song nobody has synced on datlrc's "Needs lyrics" shelf, for contributors to sync. */
export async function reportNeed(song: {
  artistName: string;
  trackName: string;
  albumName: string | null;
  duration: number;
  artworkUrl: string | null;
  videoId: string | null;
}) {
  if (!DATLRC) return;
  await fetch(`${DATLRC}/needs`, {
    method: "POST",
    headers: { ...DATLRC_HEADERS, "Content-Type": "application/json" },
    body: JSON.stringify({ ...song, trackName: withoutFeat(song.trackName) }),
  });
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

export async function findLyrics(artist: string, title: string, duration: number): Promise<LyricsLookup> {
  "use cache";
  cacheLife("weeks");

  const d = Math.round(duration);

  // A source that errors (rather than answering "not found") leaves the answer unknown: never
  // cache that as final. Each source below is only asked when the ones before have nothing synced.
  let failed = false;
  const soft = <T,>(p: Promise<T>) =>
    p.catch(() => {
      failed = true;
      return null;
    });

  // 1. LRCLIB. Gather the exact match and the search results together: several uploads can share a
  // length with different timings, and pickBest needs them all to tell which one is genuinely timed.
  const candidates: LrcRecord[] = [];
  const [exact, byFields] = await Promise.all([
    artist && d > 0
      ? soft(lrclib<LrcRecord>("/get", { artist_name: artist, track_name: withoutFeat(title), duration: String(d) }))
      : null,
    artist ? soft(lrclib<LrcRecord[]>("/search", { track_name: withoutFeat(title), artist_name: artist })) : null,
  ]);
  const seen = new Set<number | string>();
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
    add((await soft(lrclib<LrcRecord[]>("/search", { q }))) ?? []);
    best = pickBest(candidates, title, d);
  }
  if (best?.syncedLyrics) return { ...toResult(best), needed: false };

  // 2. lrc.red, synced only.
  const red = artist ? await soft(fromLrcRed(artist, title, d)) : null;
  if (red?.record) return { ...toResult(red.record), needed: false };

  // 3. datlrc.
  const own = artist ? await soft(fromDatlrc(artist, title, d)) : null;
  if (own?.syncedLyrics) return { ...toResult(own), needed: false };

  if (failed) throw new Error("a lyrics source is down");
  // Nobody has it synced at any length (a music video runs longer than LRCLIB's album timing).
  const lrclibHasSynced = candidates.some((r) => r.syncedLyrics && titleMatches(r, title));
  return { ...toResult(best ?? own), needed: !!artist && !lrclibHasSynced && !red?.hasSynced };
}
