import { cacheLife } from "next/cache";

export type ArtistSong = { id: string; title: string; album: string; image: string | null };
export type ArtistRelease = { listId: string; title: string; year: string; image: string | null };
export type Artist = {
  name: string;
  image: string | null;
  songs: ArtistSong[];
  /** The artist's full "Songs" playlist, when YouTube Music has one. */
  allSongsListId: string | null;
  albums: ArtistRelease[];
  singles: ArtistRelease[];
};

// YouTube Music's web client, the same keyless endpoints as the counterpart and playlist lookups.
// Unofficial, so every field is optional and parsing is defensive.
const API = "https://music.youtube.com/youtubei/v1";
const ARTISTS_ONLY = "EgWKAQIgAWoKEAkQBRAKEAMQBA==";

export const isChannelId = (s: string) => /^UC[\w-]{22}$/.test(s);

export async function call(endpoint: "search" | "browse", body: object): Promise<unknown> {
  const res = await fetch(`${API}/${endpoint}?prettyPrint=false`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: "https://music.youtube.com" },
    body: JSON.stringify({
      context: { client: { clientName: "WEB_REMIX", clientVersion: "1.20250101.01.00", hl: "en" } },
      ...body,
    }),
  });
  if (!res.ok) throw new Error(`YouTube Music ${endpoint} ${res.status}`);
  return res.json();
}

/** The YouTube Music channel id of the best-matching artist for a name. */
export async function findArtistId(name: string): Promise<string | null> {
  "use cache";
  cacheLife("weeks");

  const json = JSON.stringify(await call("search", { query: name, params: ARTISTS_ONLY }));
  return json.match(/"browseId":"(UC[\w-]{22})"/)?.[1] ?? null;
}

export async function getArtist(id: string): Promise<Artist | null> {
  "use cache";
  cacheLife("days");

  return parseArtist(await call("browse", { browseId: id }));
}

type Runs = { runs?: { text: string }[] };
type Thumb = { url: string; width?: number };
type Obj = Record<string, unknown>;

export const text = (r: unknown) => ((r as Runs | undefined)?.runs ?? []).map((x) => x.text).join("");

export function findAll(node: unknown, key: string, out: Obj[] = []): Obj[] {
  if (Array.isArray(node)) {
    for (const x of node) findAll(x, key, out);
  } else if (node && typeof node === "object") {
    const o = node as Obj;
    if (key in o) out.push(o[key] as Obj);
    else for (const v of Object.values(o)) findAll(v, key, out);
  }
  return out;
}

export function biggestThumb(node: unknown): string | null {
  const thumbs = findAll(node, "thumbnails")[0] as unknown as Thumb[] | undefined;
  if (!Array.isArray(thumbs) || !thumbs.length) return null;
  return thumbs.reduce((a, b) => ((b.width ?? 0) > (a.width ?? 0) ? b : a)).url;
}

function release(item: Obj): ArtistRelease | null {
  const json = JSON.stringify(item);
  const listId = json.match(/"playlistId":"(OLAK5uy_[\w-]+)"/)?.[1];
  const title = text(item.title);
  if (!listId || !title) return null;
  const year = text(item.subtitle).match(/\b\d{4}\b/)?.[0] ?? "";
  return { listId, title, year, image: biggestThumb(item.thumbnailRenderer) };
}

/** Pull the header, top songs and album/single shelves out of an artist `browse` response. */
export function parseArtist(data: unknown): Artist | null {
  const header = findAll(data, "musicImmersiveHeaderRenderer")[0] ?? findAll(data, "musicVisualHeaderRenderer")[0];
  const name = text(header?.title);
  if (!name) return null;

  const shelf = findAll(data, "musicShelfRenderer")[0];
  const songs: ArtistSong[] = [];
  for (const row of findAll(shelf?.contents, "musicResponsiveListItemRenderer")) {
    const id = (row.playlistItemData as { videoId?: string } | undefined)?.videoId;
    const cols = findAll(row.flexColumns, "musicResponsiveListItemFlexColumnRenderer").map((c) => text(c.text));
    if (id && cols[0]) songs.push({ id, title: cols[0], album: cols[3] ?? "", image: biggestThumb(row.thumbnail) });
  }
  const allSongsListId = JSON.stringify(shelf?.title ?? null).match(/"browseId":"VL(OLAK5uy_[\w-]+)"/)?.[1] ?? null;

  const carousel = (title: string) => {
    const c = findAll(data, "musicCarouselShelfRenderer").find((s) => JSON.stringify(s.header).includes(`"text":"${title}"`));
    return findAll(c?.contents, "musicTwoRowItemRenderer")
      .map(release)
      .filter((x) => x !== null);
  };

  return {
    name,
    image: biggestThumb(header?.thumbnail),
    songs,
    allSongsListId,
    albums: carousel("Albums"),
    singles: carousel("Singles & EPs"),
  };
}

/**
 * Several artists' releases as one list, newest year first. Artists take turns within a year,
 * so one prolific artist doesn't fill the row.
 */
export function mergeReleases<T extends ArtistRelease>(lists: T[][], max = 20): T[] {
  const turns: T[] = [];
  for (let i = 0; turns.length < lists.flat().length; i++) for (const list of lists) if (list[i]) turns.push(list[i]);
  const seen = new Set<string>();
  return turns
    .filter((r) => !seen.has(r.listId) && !!seen.add(r.listId))
    .sort((a, b) => Number(b.year || 0) - Number(a.year || 0))
    .slice(0, max);
}
