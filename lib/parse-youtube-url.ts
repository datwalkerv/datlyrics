export type YouTubeTarget = { videoId?: string; listId?: string };

const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;
const LIST_ID = /^(PL|OL|UU|FL|RD|LL|OLAK5uy_)[A-Za-z0-9_-]+$/;

/** Accepts any YouTube / YouTube Music URL, or a bare video/playlist ID. */
export function parseYouTubeUrl(input: string): YouTubeTarget | null {
  const raw = input.trim();
  if (!raw) return null;
  if (VIDEO_ID.test(raw)) return { videoId: raw };
  if (LIST_ID.test(raw)) return { listId: raw };

  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
  } catch {
    return null;
  }

  const host = url.hostname.replace(/^(www\.|m\.)/, "");
  const target: YouTubeTarget = {};
  const list = url.searchParams.get("list");
  if (list && /^[A-Za-z0-9_-]+$/.test(list)) target.listId = list;

  if (host === "youtu.be") {
    const id = url.pathname.slice(1).split("/")[0];
    if (VIDEO_ID.test(id)) target.videoId = id;
  } else if (host === "youtube.com" || host === "music.youtube.com" || host === "youtube-nocookie.com") {
    const v = url.searchParams.get("v");
    if (v && VIDEO_ID.test(v)) {
      target.videoId = v;
    } else {
      const m = url.pathname.match(/^\/(?:shorts|embed|live|v)\/([A-Za-z0-9_-]{11})/);
      if (m) target.videoId = m[1];
    }
  } else {
    return null;
  }

  return target.videoId || target.listId ? target : null;
}

export function targetToQuery(t: YouTubeTarget): string {
  const p = new URLSearchParams();
  if (t.listId) p.set("list", t.listId);
  if (t.videoId) p.set("v", t.videoId);
  return p.toString();
}
