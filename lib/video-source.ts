import { cacheLife } from "next/cache";
import { biggestThumb, findAll, text } from "./artist-source";

export type VideoInfo = { title: string; channel: string };

export async function getVideoInfo(id: string): Promise<VideoInfo | null> {
  "use cache";
  cacheLife("days");

  const url = `https://www.youtube.com/watch?v=${id}`;
  const res = await fetch(`https://www.youtube.com/oembed?${new URLSearchParams({ url, format: "json" })}`);
  if (res.status === 404 || res.status === 401 || res.status === 400) return null; // private/removed
  if (!res.ok) throw new Error(`oEmbed ${res.status}`);
  const data = (await res.json()) as { title: string; author_name: string };
  return { title: data.title, channel: data.author_name };
}

export type PlaylistInfo = { title: string; channel: string; thumbnail: string | null; kind: ListKind | null };

type Thumb = { url: string; width?: number };

function findKey(node: unknown, key: string): unknown {
  if (Array.isArray(node)) {
    for (const x of node) {
      const r = findKey(x, key);
      if (r !== undefined) return r;
    }
  } else if (node && typeof node === "object") {
    const o = node as Record<string, unknown>;
    if (key in o) return o[key];
    for (const v of Object.values(o)) {
      const r = findKey(v, key);
      if (r !== undefined) return r;
    }
  }
  return undefined;
}

/** What kind of list it is, as YouTube Music labels it. */
export type ListKind = "Playlist" | "Album" | "Single" | "EP";
const KINDS: ListKind[] = ["Playlist", "Album", "Single", "EP"];

function browseMusic(browseId: string): Promise<unknown | null> {
  return fetch("https://music.youtube.com/youtubei/v1/browse?prettyPrint=false", {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: "https://music.youtube.com" },
    body: JSON.stringify({
      context: { client: { clientName: "WEB_REMIX", clientVersion: "1.20250101.01.00", hl: "en" } },
      browseId,
    }),
  }).then((res) => (res.ok ? res.json() : null));
}

/**
 * The list's own square cover and kind, from YouTube Music's header (the same image and label
 * music.youtube.com shows). oEmbed only offers the first video's thumbnail. Album, single and EP
 * lists have no header of their own, only a link to their album page, which has it.
 */
type Header = { cover: string | null; kind: ListKind | null; title: string | null; artist: string | null };

async function playlistHeader(id: string): Promise<Header> {
  const data = await browseMusic(`VL${id}`);
  let header = findKey(data, "musicResponsiveHeaderRenderer");
  const albumPage = header ? null : JSON.stringify(data ?? null).match(/"(MPREb_[\w-]+)"/)?.[1];
  if (albumPage) header = findKey(await browseMusic(albumPage), "musicResponsiveHeaderRenderer");
  if (!header) return { cover: null, kind: null, title: null, artist: null };

  const runs = (node: unknown) => findKey(node, "runs") as { text: string }[] | undefined;
  const join = (node: unknown) => runs(node)?.map((r) => r.text).join("") || null;
  const h = header as Record<string, unknown>;
  const label = runs(h.subtitle)?.[0]?.text;
  const kind = KINDS.find((k) => k === label) ?? null;
  const thumbs = findKey(header, "thumbnails") as Thumb[] | undefined;
  const cover = Array.isArray(thumbs) && thumbs.length ? thumbs.reduce((a, b) => ((b.width ?? 0) > (a.width ?? 0) ? b : a)).url : null;
  // Albums name their artist in the strapline; playlists don't have one.
  return { cover, kind, title: join(h.title), artist: join(h.straplineTextOne) };
}

export async function getPlaylistInfo(id: string): Promise<PlaylistInfo | null> {
  "use cache";
  cacheLife("days");

  const url = `https://www.youtube.com/playlist?list=${id}`;
  const [res, header] = await Promise.all([
    fetch(`https://www.youtube.com/oembed?${new URLSearchParams({ url, format: "json" })}`),
    playlistHeader(id).catch((): Header => ({ cover: null, kind: null, title: null, artist: null })),
  ]);
  if (res.status === 404 || res.status === 401 || res.status === 400) return null; // private/removed
  if (!res.ok) throw new Error(`oEmbed ${res.status}`);
  const data = (await res.json()) as { title: string; author_name: string; thumbnail_url?: string };
  // hqdefault is letterboxed (black bars); mqdefault is a clean 16:9 frame.
  const fallback = data.thumbnail_url?.replace("/hqdefault.jpg", "/mqdefault.jpg") ?? null;
  // oEmbed titles album lists "Album - <name>" with no channel; the album page has both.
  const album = header.kind && header.kind !== "Playlist";
  return {
    title: (album && header.title) || data.title,
    channel: (album && header.artist) || data.author_name,
    thumbnail: header.cover ?? fallback,
    kind: header.kind,
  };
}

export type RadioTrack = { id: string; title: string; artist: string; image: string | null };

/** Tracks in a YouTube Music `next` response (its radio queue), in order, without `seed`. */
export function parseRadio(json: unknown, seed: string): RadioTrack[] {
  const seen = new Set([seed]);
  const tracks: RadioTrack[] = [];
  for (const r of findAll(json, "playlistPanelVideoRenderer")) {
    const id = r.videoId;
    if (typeof id !== "string" || seen.has(id)) continue;
    seen.add(id);
    tracks.push({ id, title: text(r.title), artist: text(r.shortBylineText), image: biggestThumb(r.thumbnail) });
  }
  return tracks;
}

/** Songs related to `id`: YouTube Music's radio for it, what it plays once your queue runs out. */
export async function getRadio(id: string): Promise<RadioTrack[]> {
  "use cache";
  cacheLife("hours");

  const res = await fetch("https://music.youtube.com/youtubei/v1/next?prettyPrint=false", {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: "https://music.youtube.com" },
    body: JSON.stringify({
      context: { client: { clientName: "WEB_REMIX", clientVersion: "1.20250101.01.00", hl: "en" } },
      videoId: id,
      playlistId: `RDAMVM${id}`,
    }),
  });
  if (!res.ok) throw new Error(`next ${res.status}`);
  return parseRadio(await res.json(), id);
}
