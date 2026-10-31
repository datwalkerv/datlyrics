"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { fetchArtwork, fetchVideoInfo } from "@/components/player/useTrackMeta";
import { cleanTitle } from "./clean-title";
import { DEMO_PLAYLIST_ID } from "./site";
import { mergeAdded, type Added } from "./queue";

export { mergeAdded };

export type SavedItem = {
  kind: "song" | "playlist";
  /** Video id for songs, playlist id for playlists. */
  id: string;
  title: string;
  subtitle: string;
  image: string | null;
  savedAt: number;
  /** The card's badge for lists: "Playlist", "Album", "Single" or "EP" (older saves don't have it). */
  badge?: string;
  /** Songs the user added to this list, newest first, each with the track that was on top when it was added. */
  added?: Added[];
  /** When `added` last changed. */
  updatedAt?: number;
};

export type { Added };

/** Shown first on everyone's shelf; can't be removed and don't count toward the limit. */
export const PINNED: Pick<SavedItem, "kind" | "id">[] = [{ kind: "playlist", id: DEMO_PLAYLIST_ID }];

/** The user's own playlist of saved songs, played from localStorage instead of YouTube. */
export const SAVED_LIST_ID = "saved";

/** The user's own playlists live only in localStorage, under ids like "mine-1a2b3c4d5e6f". */
export const isOwnList = (id: string) => id.startsWith("mine-");
/** Lists played from localStorage instead of a YouTube playlist. */
export const isLocalList = (id: string) => id === SAVED_LIST_ID || isOwnList(id);

export const isPinned = (kind: SavedItem["kind"], id: string) => PINNED.some((x) => x.kind === kind && x.id === id);

const KEY = "datlyrics:saved";
const EVENT = "datlyrics:saved-change";
const MAX = 24;
const EMPTY: SavedItem[] = [];

let cache: { raw: string | null; items: SavedItem[] } = { raw: null, items: EMPTY };

function read(): SavedItem[] {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    return EMPTY;
  }
  // useSyncExternalStore needs a stable snapshot, so re-parse only when the stored string changes.
  if (raw === cache.raw) return cache.items;
  let items = EMPTY;
  try {
    const parsed = raw ? JSON.parse(raw) : [];
    // Oldest first: the order things were added (earlier versions stored newest first).
    if (Array.isArray(parsed))
      items = parsed.filter((x) => x && typeof x.id === "string").sort((a, b) => (a.savedAt ?? 0) - (b.savedAt ?? 0));
  } catch {}
  cache = { raw, items };
  return items;
}

function write(items: SavedItem[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(items));
  } catch {}
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(fn: () => void) {
  // "storage" also keeps other open tabs in sync.
  window.addEventListener(EVENT, fn);
  window.addEventListener("storage", fn);
  return () => {
    window.removeEventListener(EVENT, fn);
    window.removeEventListener("storage", fn);
  };
}

export function useSaved(): SavedItem[] {
  return useSyncExternalStore(subscribe, read, () => EMPTY);
}

export const isSaved = (kind: SavedItem["kind"], id: string) => read().some((x) => x.kind === kind && x.id === id);

/**
 * Save an item at the end of the list, so the shelf stays in the order things were added.
 * Re-saving an existing item just refreshes it in place. Returns false when the shelf is full.
 */
export function saveItem(item: Omit<SavedItem, "savedAt">): boolean {
  if (isPinned(item.kind, item.id)) return true;
  const items = read();
  if (items.some((x) => x.kind === item.kind && x.id === item.id)) {
    updateItem(item);
    return true;
  }
  // The cap is on shelf cards; songs all share the one Saved card, and pinned lists (kept only for their added songs) don't count.
  if (item.kind === "playlist" && items.filter((x) => x.kind === "playlist" && !isPinned(x.kind, x.id)).length >= MAX) return false;
  write([...items, { ...item, savedAt: Date.now() }]);
  return true;
}

export const SAVED_LIMIT = MAX;

/** Saved songs, latest saved first. */
export const savedSongIds = () =>
  read()
    .filter((x) => x.kind === "song")
    .map((x) => x.id)
    .reverse();

export const listItem = (id: string) => read().find((x) => x.kind === "playlist" && x.id === id);

/** An own list's songs, latest added first. */
export const ownListIds = (id: string) => mergeAdded([], listItem(id)?.added);

/** A local list with nothing to play (a new own playlist, or Saved with no songs). */
export const isEmptyList = (id: string) =>
  isLocalList(id) && (id === SAVED_LIST_ID ? savedSongIds() : ownListIds(id)).length === 0;

/**
 * Put a song on top of a list. `top` is the list's current first track (its neighbour). A pinned
 * list isn't stored until a song is added to it; then it's kept (off the shelf) for its added songs.
 */
export function addToList(list: Omit<SavedItem, "savedAt">, songId: string, top: string | null) {
  const item = listItem(list.id);
  const base = item ?? list;
  const added = [{ id: songId, before: top === songId ? null : top }, ...(base.added ?? []).filter((a) => a.id !== songId)];
  if (item) updateItem({ ...item, added, updatedAt: Date.now() });
  else if (isPinned(list.kind, list.id)) write([...read(), { ...list, savedAt: 0, added, updatedAt: Date.now() }]);
}

/** Set an own list's songs, in play order. */
export function setListSongs(listId: string, ids: string[]) {
  const item = listItem(listId);
  if (item) updateItem({ ...item, added: ids.map((id) => ({ id, before: null })), updatedAt: Date.now() });
}

export function removeFromList(listId: string, songId: string) {
  const item = listItem(listId);
  if (!item) return;
  updateItem({ ...item, added: (item.added ?? []).filter((a) => a.id !== songId), updatedAt: Date.now() });
}

/** Make an own playlist, optionally with songs (in play order). Returns false when the shelf is full. */
export function createOwnList(list: { title: string; image: string | null; songs?: string[] }): boolean {
  return saveItem({
    kind: "playlist",
    id: `mine-${crypto.randomUUID().replaceAll("-", "").slice(0, 12)}`,
    title: list.title,
    subtitle: "Your playlist",
    image: list.image,
    badge: "Playlist",
    ...(list.songs?.length && { added: list.songs.map((id) => ({ id, before: null })) }),
  });
}

/** Replace a saved item's details in place, keeping its position. */
export function updateItem(item: Omit<SavedItem, "savedAt">) {
  write(read().map((x) => (x.kind === item.kind && x.id === item.id ? { ...x, ...item } : x)));
}

const refreshing = new Set<string>();

/** Re-fetch a playlist's cover (old saves have the first video's thumbnail; cover URLs can expire). */
export function refreshPlaylistCover(id: string) {
  // Own lists have no YouTube cover; an uploaded one (a data URL) is kept.
  if (refreshing.has(id) || isLocalList(id) || listItem(id)?.image?.startsWith("data:")) return;
  refreshing.add(id);
  resolveSaved({ listId: id })
    // Keep the user's added songs and title.
    .then((fresh) => updateItem({ ...fresh, title: listItem(id)?.title ?? fresh.title }))
    .catch(() => {});
}

export function removeItem(kind: SavedItem["kind"], id: string) {
  write(read().filter((x) => !(x.kind === kind && x.id === id)));
}

export const savedTarget = (item: Pick<SavedItem, "kind" | "id">) =>
  item.kind === "playlist" ? { listId: item.id } : { videoId: item.id };

export const savedHref = (item: Pick<SavedItem, "kind" | "id">) =>
  item.kind === "playlist" ? `/play?list=${item.id}` : `/play?v=${item.id}`;

/** Build a saved card (title, artist, cover) for a pasted video or playlist. */
export async function resolveSaved(target: { videoId?: string; listId?: string }): Promise<Omit<SavedItem, "savedAt">> {
  if (target.listId) {
    const res = await fetch(`/api/playlist/${target.listId}`);
    if (!res.ok) throw new Error("playlist unavailable");
    const p = (await res.json()) as { title: string; channel: string; thumbnail: string | null; kind: string | null };
    return {
      kind: "playlist",
      id: target.listId,
      title: p.title,
      subtitle: p.channel,
      image: p.thumbnail,
      ...(p.kind && { badge: p.kind }),
    };
  }
  const id = target.videoId!;
  const v = await fetchVideoInfo(id);
  const song = cleanTitle(v.title, v.channel);
  const art = await fetchArtwork(song).catch(() => null);
  return {
    kind: "song",
    id,
    title: song.title,
    subtitle: song.artist,
    image: art ?? `https://i.ytimg.com/vi/${id}/mqdefault.jpg`,
  };
}

/** The pinned items' cards, fetched fresh each visit (titles change, cover URLs expire), with the songs added to them. */
export function usePinned(): SavedItem[] {
  const [items, setItems] = useState<SavedItem[]>([]);
  const saved = useSaved();
  useEffect(() => {
    let alive = true;
    Promise.all(
      PINNED.map((p) =>
        resolveSaved(p.kind === "playlist" ? { listId: p.id } : { videoId: p.id })
          .then((item) => ({ ...item, savedAt: 0 }))
          .catch(() => null),
      ),
    ).then((list) => alive && setItems(list.filter((x) => x !== null)));
    return () => {
      alive = false;
    };
  }, []);
  return items.map((p) => {
    const stored = saved.find((x) => x.kind === p.kind && x.id === p.id);
    return stored ? { ...p, added: stored.added, updatedAt: stored.updatedAt } : p;
  });
}
