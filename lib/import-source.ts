import type { ImportTarget } from "./parse-youtube-url";
import { searchSongs } from "./search-source";

export type SourceTrack = { title: string; artist: string; ms: number };
export type SourceList = { title: string; image: string | null; tracks: SourceTrack[] };

const TOLERANCE_S = 5;

export const toSeconds = (d: string) => d.split(":").reduce((s, p) => s * 60 + Number(p), 0);

const script = (html: string, id: string) => {
  const m = html.match(new RegExp(`<script[^>]*id="${id}"[^>]*>([\\s\\S]*?)</script>`));
  return m ? JSON.parse(m[1]) : null;
};

const meta = (html: string, prop: string) => html.match(new RegExp(`<meta property="og:${prop}" content="([^"]*)"`))?.[1] ?? null;

// Unofficial page data (no API keys), so every field is optional.
// shortcut: these pages only carry the first ~100 tracks; longer lists need Spotify/Apple API credentials.
export function parseSpotify(html: string): SourceList {
  const e = script(html, "__NEXT_DATA__")?.props?.pageProps?.state?.data?.entity ?? {};
  const tracks: SourceTrack[] = [];
  for (const t of e.trackList ?? [])
    if (t?.title && typeof t.duration === "number") tracks.push({ title: t.title, artist: t.subtitle ?? "", ms: t.duration });
  return { title: e.name ?? e.title ?? "Spotify playlist", image: e.coverArt?.sources?.[0]?.url ?? null, tracks };
}

export function parseApple(html: string): SourceList {
  const tracks: SourceTrack[] = [];
  const walk = (n: unknown) => {
    if (Array.isArray(n)) n.forEach(walk);
    else if (n && typeof n === "object") {
      const o = n as Record<string, unknown>;
      if (typeof o.title === "string" && typeof o.artistName === "string" && typeof o.duration === "number")
        tracks.push({ title: o.title, artist: o.artistName, ms: o.duration });
      else Object.values(o).forEach(walk);
    }
  };
  walk(script(html, "serialized-server-data"));
  const title = (meta(html, "title") ?? "Apple Music playlist").replace(/\s+(on|[-–—])\s+Apple Music$/, "");
  return { title, image: meta(html, "image"), tracks };
}

/** The first YouTube Music song by the same name whose length is within a few seconds of the original. */
export function pickMatch(results: { id: string; duration: string }[], ms: number): string | null {
  return results.find((r) => Math.abs(toSeconds(r.duration) - ms / 1000) <= TOLERANCE_S)?.id ?? null;
}

export async function importList(target: ImportTarget) {
  const res = await fetch(target.url, { headers: { "User-Agent": "Mozilla/5.0", "Accept-Language": "en" } });
  if (!res.ok) throw new Error(`${target.source} ${res.status}`);
  const list = (target.source === "spotify" ? parseSpotify : parseApple)(await res.text());
  if (!list.tracks.length) throw new Error("no tracks");

  const ids: (string | null)[] = new Array(list.tracks.length).fill(null);
  let next = 0;
  const worker = async () => {
    while (next < list.tracks.length) {
      const i = next++;
      const t = list.tracks[i];
      ids[i] = await searchSongs(`${t.artist} ${t.title}`.toLowerCase())
        .then((r) => pickMatch(r, t.ms))
        .catch(() => null);
    }
  };
  await Promise.all(Array.from({ length: 6 }, worker));

  return {
    title: list.title,
    image: list.image,
    total: list.tracks.length,
    // A song listed twice is kept once: own lists hold each song once.
    ids: [...new Set(ids.filter((x): x is string => !!x))],
    missing: list.tracks.filter((_, i) => !ids[i]).map((t) => `${t.artist} – ${t.title}`),
  };
}
