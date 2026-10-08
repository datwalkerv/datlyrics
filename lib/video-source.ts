import { cacheLife } from "next/cache";

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

export type PlaylistInfo = { title: string; channel: string; thumbnail: string | null };

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

/**
 * The playlist's own square cover, from YouTube Music's playlist header (the same image
 * music.youtube.com shows). oEmbed only offers the first video's thumbnail.
 */
async function playlistCover(id: string): Promise<string | null> {
  const res = await fetch("https://music.youtube.com/youtubei/v1/browse?prettyPrint=false", {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: "https://music.youtube.com" },
    body: JSON.stringify({
      context: { client: { clientName: "WEB_REMIX", clientVersion: "1.20250101.01.00", hl: "en" } },
      browseId: `VL${id}`,
    }),
  });
  if (!res.ok) return null;
  const header = findKey(await res.json(), "musicResponsiveHeaderRenderer");
  const thumbs = findKey(header, "thumbnails") as Thumb[] | undefined;
  if (!Array.isArray(thumbs) || !thumbs.length) return null;
  return thumbs.reduce((a, b) => ((b.width ?? 0) > (a.width ?? 0) ? b : a)).url;
}

export async function getPlaylistInfo(id: string): Promise<PlaylistInfo | null> {
  "use cache";
  cacheLife("days");

  const url = `https://www.youtube.com/playlist?list=${id}`;
  const [res, cover] = await Promise.all([
    fetch(`https://www.youtube.com/oembed?${new URLSearchParams({ url, format: "json" })}`),
    playlistCover(id).catch(() => null),
  ]);
  if (res.status === 404 || res.status === 401 || res.status === 400) return null; // private/removed
  if (!res.ok) throw new Error(`oEmbed ${res.status}`);
  const data = (await res.json()) as { title: string; author_name: string; thumbnail_url?: string };
  // hqdefault is letterboxed (black bars); mqdefault is a clean 16:9 frame.
  const fallback = data.thumbnail_url?.replace("/hqdefault.jpg", "/mqdefault.jpg") ?? null;
  return { title: data.title, channel: data.author_name, thumbnail: cover ?? fallback };
}
