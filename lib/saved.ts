"use client";

import { useSyncExternalStore } from "react";
import { fetchArtwork, fetchVideoInfo } from "@/components/player/useTrackMeta";
import { cleanTitle } from "./clean-title";

export type SavedItem = {
  kind: "song" | "playlist";
  /** Video id for songs, playlist id for playlists. */
  id: string;
  title: string;
  subtitle: string;
  image: string | null;
  savedAt: number;
};

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
  const items = read();
  if (items.some((x) => x.kind === item.kind && x.id === item.id)) {
    updateItem(item);
    return true;
  }
  if (items.length >= MAX) return false;
  write([...items, { ...item, savedAt: Date.now() }]);
  return true;
}

export const SAVED_LIMIT = MAX;

/** Replace a saved item's details in place, keeping its position. */
export function updateItem(item: Omit<SavedItem, "savedAt">) {
  write(read().map((x) => (x.kind === item.kind && x.id === item.id ? { ...x, ...item } : x)));
}

const refreshing = new Set<string>();

/** Re-fetch a playlist's cover (old saves have the first video's thumbnail; cover URLs can expire). */
export function refreshPlaylistCover(id: string) {
  if (refreshing.has(id)) return;
  refreshing.add(id);
  resolveSaved({ listId: id })
    .then((fresh) => updateItem(fresh))
    .catch(() => {});
}

export function removeItem(kind: SavedItem["kind"], id: string) {
  write(read().filter((x) => !(x.kind === kind && x.id === id)));
}

export const savedHref = (item: Pick<SavedItem, "kind" | "id">) =>
  item.kind === "playlist" ? `/play?list=${item.id}` : `/play?v=${item.id}`;

/** Build a saved card (title, artist, cover) for a pasted video or playlist. */
export async function resolveSaved(target: { videoId?: string; listId?: string }): Promise<Omit<SavedItem, "savedAt">> {
  if (target.listId) {
    const res = await fetch(`/api/playlist/${target.listId}`);
    if (!res.ok) throw new Error("playlist unavailable");
    const p = (await res.json()) as { title: string; channel: string; thumbnail: string | null };
    return { kind: "playlist", id: target.listId, title: p.title, subtitle: p.channel, image: p.thumbnail };
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
