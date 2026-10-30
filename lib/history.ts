"use client";

import { useSyncExternalStore } from "react";

/** A track the user played, and the playlist it played in (null for a single song). */
export type HistoryEntry = {
  id: string;
  title: string;
  artist: string;
  image: string | null;
  listId: string | null;
  playedAt: number;
};

const KEY = "datlyrics:history";
const EVENT = "datlyrics:history-change";
const MAX = 50;
const EMPTY: HistoryEntry[] = [];

let cache: { raw: string | null; items: HistoryEntry[] } = { raw: null, items: EMPTY };

function read(): HistoryEntry[] {
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
    if (Array.isArray(parsed)) items = parsed.filter((x) => x && typeof x.id === "string");
  } catch {}
  cache = { raw, items };
  return items;
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

/** Most recent first. */
export function useHistory(): HistoryEntry[] {
  return useSyncExternalStore(subscribe, read, () => EMPTY);
}

/** Move a play to the top of the history (refreshing its details if it's already there). */
export function recordPlay(entry: Omit<HistoryEntry, "playedAt">) {
  const items = read();
  const first = items[0];
  if (first && first.id === entry.id && first.listId === entry.listId && first.title === entry.title && first.image === entry.image) return;
  const rest = items.filter((x) => !(x.id === entry.id && x.listId === entry.listId));
  try {
    localStorage.setItem(KEY, JSON.stringify([{ ...entry, playedAt: Date.now() }, ...rest].slice(0, MAX)));
  } catch {}
  window.dispatchEvent(new Event(EVENT));
}
