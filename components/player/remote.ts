"use client";

import { useSyncExternalStore } from "react";

/**
 * Lets any page (and the search palette) drive the one player PlayerHost keeps mounted:
 * start something in place with `playHere`, or queue songs with `playNext`.
 */
export type Target = { videoId?: string; listId?: string };

/** The mounted player listens for this to queue songs after the current one. */
export const PLAY_NEXT_EVENT = "datlyrics:play-next";

const listeners = new Set<() => void>();
const notify = () => {
  for (const fn of listeners) fn();
};
export const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
};

// What a page asked to play without going to /play; PlayerHost picks it up.
let requested: Target | null = null;
export const useRequested = () => useSyncExternalStore(subscribe, () => requested, () => null);

// What the player has loaded, for links back to it (like /home's logo).
let current: Target | null = null;
export function publishCurrent(t: Target | null) {
  current = t;
  notify();
}

/** Whether something is loaded in the player (to queue after). */
export const isPlayerLoaded = () => current !== null;

export const sameTarget = (a: Target | null, b: Target | null) =>
  !!a && !!b && a.videoId === b.videoId && a.listId === b.listId;

export const playHref = (t: Target) =>
  `/play?${new URLSearchParams({ ...(t.videoId && { v: t.videoId }), ...(t.listId && { list: t.listId }) })}`;

// The track actually playing (the queue moves on from what was started), in its list.
let nowPlaying: Target | null = null;
export const getNowPlaying = () => nowPlaying;
export function publishNowPlaying(t: Target | null) {
  if (sameTarget(t, nowPlaying) || t === nowPlaying) return;
  nowPlaying = t;
  notify();
}

/** The /play link for what's playing right now, or null when nothing is. */
export function usePlayerHref(): string | null {
  const t = useSyncExternalStore(subscribe, () => nowPlaying ?? current, () => null);
  return t ? playHref(t) : null;
}

// Back/forward lands on old /play addresses; those show the player, they don't restart what they named.
let historyNav = false;
if (typeof window !== "undefined") {
  window.addEventListener("popstate", () => {
    historyNav = true;
  });
}
/** Whether the current URL change came from the browser's back/forward. */
export const isHistoryNav = () => historyNav;
export const endHistoryNav = () => {
  historyNav = false;
};

/** Play this right where you are, in the mini bar; its link opens the lyrics. */
export function playHere(target: Target) {
  requested = { ...target };
  notify();
}

/** Queue songs right after what's playing, in order. Returns false when nothing is playing to queue after. */
export function playNext(videoIds: string[]): boolean {
  if (!current || !videoIds.length) return false;
  window.dispatchEvent(new CustomEvent(PLAY_NEXT_EVENT, { detail: videoIds }));
  return true;
}
