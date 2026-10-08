import { cacheLife } from "next/cache";
import { withoutFeat } from "./clean-title";

export type Version = "song" | "video";

type Item = { id: string; title: string; artist: string; seconds: number };

// YouTube Music's web client search, filtered to songs or to (official) music videos — the same two
// catalogues its Song/Video switch moves between. Unofficial and keyless, so parse defensively.
const ENDPOINT = "https://music.youtube.com/youtubei/v1/search?prettyPrint=false";
const FILTER: Record<Version, string> = {
  song: "EgWKAQIIAWoKEAkQBRAKEAMQBA==",
  video: "EgWKAQIQAWoKEAkQBRAKEAMQBA==",
};

type FlexColumn = { musicResponsiveListItemFlexColumnRenderer?: { text?: { runs?: { text: string }[] } } };
type ListItem = { flexColumns?: FlexColumn[]; playlistItemData?: { videoId?: string } };

function collect(node: unknown, out: ListItem[]) {
  if (Array.isArray(node)) {
    for (const x of node) collect(x, out);
  } else if (node && typeof node === "object") {
    const o = node as Record<string, unknown>;
    if (o.musicResponsiveListItemRenderer) out.push(o.musicResponsiveListItemRenderer as ListItem);
    for (const v of Object.values(o)) collect(v, out);
  }
}

const toSeconds = (s: string) => s.split(":").reduce((acc, p) => acc * 60 + Number(p), 0);

function parse(item: ListItem): Item | null {
  const cols = (item.flexColumns ?? []).map(
    (c) => c.musicResponsiveListItemFlexColumnRenderer?.text?.runs?.map((r) => r.text) ?? [],
  );
  // Video results don't always carry playlistItemData; the watch endpoint inside the item does.
  const id =
    item.playlistItemData?.videoId ?? JSON.stringify(item).match(/"watchEndpoint":\{"videoId":"([\w-]{11})"/)?.[1];
  const title = cols[0]?.join("") ?? "";
  const artist = cols[1]?.[0] ?? "";
  const length = cols[1]?.findLast((t) => /^\d+(:\d{2})+$/.test(t));
  if (!id || !title) return null;
  return { id, title, artist, seconds: length ? toSeconds(length) : 0 };
}

async function musicSearch(query: string, version: Version): Promise<Item[]> {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: "https://music.youtube.com" },
    body: JSON.stringify({
      context: { client: { clientName: "WEB_REMIX", clientVersion: "1.20250101.01.00", hl: "en" } },
      query,
      params: FILTER[version],
    }),
  });
  if (!res.ok) throw new Error(`YouTube Music search ${res.status}`);
  const items: ListItem[] = [];
  collect(await res.json(), items);
  return items.map(parse).filter((x): x is Item => !!x);
}

const norm = (s: string) =>
  withoutFeat(s)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();

// Versions we never want to swap to, unless the song title itself says so.
const UNWANTED = /\b(live|cover|karaoke|instrumental|remix|sped ?up|slowed|reverb|nightcore|8d|reaction|lyrics?|acoustic|extended|negative harmony|tutorial|guitar|piano|violin|dlc)\b/i;

/** Find the official song (audio) or music-video counterpart of a track. */
export async function findCounterpart(
  artist: string,
  title: string,
  want: Version,
  excludeId: string,
): Promise<{ id: string; seconds: number } | null> {
  "use cache";
  cacheLife("weeks");

  const items = await musicSearch(`${artist} ${withoutFeat(title)}`.trim(), want);
  const a = norm(artist);
  const t = norm(title);
  const titleAllows = (w: RegExp) => w.test(title);

  let best: Item | null = null;
  let bestScore = -Infinity;
  for (const [rank, it] of items.slice(0, 10).entries()) {
    if (it.id === excludeId) continue;
    const itTitle = norm(it.title);
    const itArtist = norm(it.artist);
    // Video titles usually read "Artist - Song (Official Video)", song titles are just "Song".
    if (!itTitle.includes(t) && !(want === "song" && t.includes(itTitle) && itTitle.length > 2)) continue;
    // Official videos are credited to the artist; fan uploads only mention them in the title.
    const credited = !a || itArtist.includes(a) || a.includes(itArtist);
    const artistOk = want === "video" ? credited : credited || itTitle.includes(a);
    if (!artistOk) continue;
    if (UNWANTED.test(it.title) && !titleAllows(UNWANTED)) continue;

    let score = -rank; // trust YouTube Music's own ranking
    if (want === "song" && itTitle === t) score += 5;
    if (want === "video" && /official (music )?video|\bm\/?v\b/i.test(it.title)) score += 4;
    if (itArtist === a) score += 3;
    if (score > bestScore) {
      bestScore = score;
      best = it;
    }
  }
  return best ? { id: best.id, seconds: best.seconds } : null;
}
