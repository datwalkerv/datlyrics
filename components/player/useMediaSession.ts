"use client";

import { useEffect, useRef } from "react";
import type { SongInfo } from "@/lib/clean-title";
import type { PlayerClock, PlayerStatus } from "./useYouTubePlayer";

type Controls = {
  play: () => void;
  pause: () => void;
  next: () => void;
  prev: () => void;
  seekBy: (s: number) => void;
  seekTo: (s: number) => void;
};

/**
 * Hardware media keys and OS media controls (Control Center, lock screen, headphones). The audio
 * plays inside YouTube's embed, which only knows the one video it has loaded, so without this
 * next/previous do nothing. Registering handlers on the page routes them to our own queue, and
 * the metadata shows the song, artist and cover in the system's Now Playing.
 */
export function useMediaSession({
  controls,
  song,
  artwork,
  status,
  duration,
  clock,
}: {
  controls: Controls;
  song: SongInfo | null;
  artwork: string | null;
  status: PlayerStatus;
  duration: number;
  clock: PlayerClock;
}) {
  const controlsRef = useRef(controls);
  const statusRef = useRef(status);
  useEffect(() => {
    controlsRef.current = controls;
    statusRef.current = status;
  });

  // iOS pauses the embed's video when the screen locks or the home-screen app goes to the
  // background. A pause right after hiding wasn't the listener's (theirs comes through "pause"
  // below, which clears this): resume, so the car and the lock screen keep playing.
  // shortcut: a lock-screen pause within 1.5s of locking that bypasses our handler is undone once; drop if Phase 0 shows iOS never pauses.
  const hiddenWhilePlaying = useRef(0);
  useEffect(() => {
    const onVisibility = () => {
      const s = statusRef.current;
      hiddenWhilePlaying.current = document.hidden && (s === "playing" || s === "buffering") ? Date.now() : 0;
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);
  useEffect(() => {
    if (status !== "paused" || !document.hidden || Date.now() - hiddenWhilePlaying.current > 1500) return;
    hiddenWhilePlaying.current = 0;
    controlsRef.current.play();
  }, [status]);

  useEffect(() => {
    if (!("mediaSession" in navigator)) return;
    const ms = navigator.mediaSession;
    const handlers: [MediaSessionAction, MediaSessionActionHandler][] = [
      ["play", () => controlsRef.current.play()],
      [
        "pause",
        () => {
          hiddenWhilePlaying.current = 0;
          controlsRef.current.pause();
        },
      ],
      [
        "stop",
        () => {
          hiddenWhilePlaying.current = 0;
          controlsRef.current.pause();
        },
      ],
      ["nexttrack", () => controlsRef.current.next()],
      ["previoustrack", () => controlsRef.current.prev()],
      ["seekbackward", (d) => controlsRef.current.seekBy(-(d.seekOffset ?? 10))],
      ["seekforward", (d) => controlsRef.current.seekBy(d.seekOffset ?? 10)],
      ["seekto", (d) => d.seekTime != null && controlsRef.current.seekTo(d.seekTime)],
    ];
    for (const [action, handler] of handlers) {
      try {
        ms.setActionHandler(action, handler);
      } catch {
        // Older browsers throw for actions they don't support.
      }
    }
    return () => {
      for (const [action] of handlers) {
        try {
          ms.setActionHandler(action, null);
        } catch {}
      }
    };
  }, []);

  useEffect(() => {
    if (!("mediaSession" in navigator) || !song) return;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: song.title,
      artist: song.artist,
      album: "datlyrics",
      artwork: artwork ? [{ src: artwork, sizes: "1000x1000" }] : [],
    });
  }, [song?.title, song?.artist, artwork]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!("mediaSession" in navigator)) return;
    navigator.mediaSession.playbackState =
      status === "playing" || status === "buffering" ? "playing" : status === "paused" ? "paused" : "none";
    // Keep the system's scrubber in step (refreshed on every status change, which covers seeks).
    if (duration > 0 && navigator.mediaSession.setPositionState) {
      try {
        navigator.mediaSession.setPositionState({
          duration,
          position: Math.min(Math.max(clock.getTime(), 0), duration),
          playbackRate: 1,
        });
      } catch {}
    }
  }, [status, duration, clock]);
}
