import { cacheLife } from "next/cache";
import { biggestThumb, call, findAll, text, type Obj } from "./artist-source";

export type DiscoverItem = { kind: "song" | "playlist"; id: string; title: string; subtitle: string; image: string | null };
export type DiscoverShelf = { title: string; items: DiscoverItem[] };

/** YouTube Music's own home page (no account): quick picks, new releases, mood playlists. */
export async function getDiscover(): Promise<DiscoverShelf[]> {
  "use cache";
  cacheLife("hours");

  return parseDiscover(await call("browse", { browseId: "FEmusic_home" }));
}

const firstString = (node: unknown, endpoint: string, key: string) => {
  const v = findAll(node, endpoint)[0]?.[key];
  return typeof v === "string" ? v : null;
};

// Quick picks come as 60–120px thumbnails; YouTube's image server resizes on request.
const sharp = (url: string | null) => url?.replace(/=w\d+-h\d+/, "=w544-h544") ?? null;

function item(entry: Obj): DiscoverItem | null {
  const song = entry.musicResponsiveListItemRenderer as Obj | undefined;
  if (song) {
    const id = firstString(song, "watchEndpoint", "videoId");
    const cols = findAll(song.flexColumns, "musicResponsiveListItemFlexColumnRenderer");
    const title = text(cols[0]?.text);
    if (!id || !title) return null;
    const artist = ((cols[1]?.text as { runs?: { text: string }[] })?.runs ?? [])[0]?.text ?? "";
    return { kind: "song", id, title, subtitle: artist, image: sharp(biggestThumb(song.thumbnail)) };
  }
  const card = entry.musicTwoRowItemRenderer as Obj | undefined;
  if (!card) return null;
  const title = text(card.title);
  const base = { title, subtitle: text(card.subtitle), image: sharp(biggestThumb(card.thumbnailRenderer)) };
  const listId = firstString(card, "watchPlaylistEndpoint", "playlistId");
  if (listId && title) return { kind: "playlist", id: listId, ...base };
  const videoId = firstString(card, "watchEndpoint", "videoId");
  return videoId && title ? { kind: "song", id: videoId, ...base } : null;
}

export function parseDiscover(json: unknown): DiscoverShelf[] {
  return findAll(json, "musicCarouselShelfRenderer")
    .map((shelf) => ({
      title: text(findAll(shelf.header, "title")[0]),
      items: ((shelf.contents as Obj[] | undefined) ?? []).map(item).filter((x) => x !== null),
    }))
    .filter((s) => s.title && s.items.length);
}
