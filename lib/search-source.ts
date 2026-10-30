import { cacheLife } from "next/cache";
import { call, findAll, text } from "./artist-source";

export type SearchResult = {
  id: string;
  title: string;
  channel: string;
  duration: string;
};

type Run = { text: string };
type VideoRenderer = {
  videoId?: string;
  title?: { runs?: Run[] };
  ownerText?: { runs?: Run[] };
  lengthText?: { simpleText?: string };
};

// YouTube's own web client endpoint: no API key or quota, but unofficial, so parse defensively.
const ENDPOINT = "https://www.youtube.com/youtubei/v1/search?prettyPrint=false";
const VIDEOS_ONLY = "EgIQAQ%3D%3D";

function collect(node: unknown, out: VideoRenderer[]) {
  if (Array.isArray(node)) {
    for (const x of node) collect(x, out);
  } else if (node && typeof node === "object") {
    const o = node as Record<string, unknown>;
    if (o.videoRenderer) out.push(o.videoRenderer as VideoRenderer);
    for (const v of Object.values(o)) collect(v, out);
  }
}

const SONGS_ONLY = "EgWKAQIIAWoKEAkQBRAKEAMQBA==";

/** YouTube Music's song results: real tracks (and their album audio), no covers, clips or reaction videos. */
export async function searchSongs(query: string): Promise<SearchResult[]> {
  "use cache";
  cacheLife("hours");

  const results: SearchResult[] = [];
  for (const row of findAll(await call("search", { query, params: SONGS_ONLY }), "musicResponsiveListItemRenderer")) {
    const id = (row.playlistItemData as { videoId?: string } | undefined)?.videoId;
    const cols = findAll(row.flexColumns, "musicResponsiveListItemFlexColumnRenderer").map((c) => text(c.text));
    // "Artist • Album • 3:40"
    const parts = (cols[1] ?? "").split(" • ");
    const duration = parts.at(-1) ?? "";
    if (!id || !cols[0] || !/^\d+(:\d\d)+$/.test(duration)) continue;
    results.push({ id, title: cols[0], channel: parts[0], duration });
  }
  return results;
}

/** Songs first, then videos for what YouTube Music doesn't have (or anything that isn't a song). */
export function mergeResults(songs: SearchResult[], videos: SearchResult[], max = 8): SearchResult[] {
  const out = songs.slice(0, max - 2);
  const seen = new Set(out.map((r) => r.id));
  for (const v of videos) if (out.length < max && !seen.has(v.id)) out.push(v);
  return out;
}

export async function searchVideos(query: string): Promise<SearchResult[]> {
  "use cache";
  cacheLife("hours");

  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      context: { client: { clientName: "WEB", clientVersion: "2.20250101.00.00", hl: "en" } },
      query,
      params: decodeURIComponent(VIDEOS_ONLY),
    }),
  });
  if (!res.ok) throw new Error(`YouTube search ${res.status}`);

  const renderers: VideoRenderer[] = [];
  collect(await res.json(), renderers);

  const seen = new Set<string>();
  const results: SearchResult[] = [];
  for (const v of renderers) {
    // Live streams have no length; they don't make sense for a lyrics player.
    if (!v.videoId || !v.lengthText?.simpleText || seen.has(v.videoId)) continue;
    seen.add(v.videoId);
    results.push({
      id: v.videoId,
      title: v.title?.runs?.map((r) => r.text).join("") ?? "",
      channel: v.ownerText?.runs?.[0]?.text ?? "",
      duration: v.lengthText.simpleText,
    });
    if (results.length >= 8) break;
  }
  return results;
}
