"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";

export type PlayerStatus = "loading" | "needs-gesture" | "playing" | "paused" | "buffering" | "ended" | "error";

export type PlayerSnapshot = {
  status: PlayerStatus;
  videoId: string | null;
  /** Title/channel as reported by the embedded player; empty until metadata loads. */
  rawTitle: string;
  channel: string;
  duration: number;
  playlist: string[] | null;
  index: number;
  /** The upload loaded for the current queue slot (the track itself, or its song/video version). */
  loadedId: string | null;
  error: string | null;
};

const INITIAL: PlayerSnapshot = {
  status: "loading",
  videoId: null,
  rawTitle: "",
  channel: "",
  duration: 0,
  playlist: null,
  index: 0,
  loadedId: null,
  error: null,
};

let apiPromise: Promise<typeof YT> | null = null;

function loadYouTubeApi(): Promise<typeof YT> {
  if (apiPromise) return apiPromise;
  apiPromise = new Promise((resolve) => {
    if (window.YT?.Player) return resolve(window.YT);
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prev?.();
      resolve(window.YT);
    };
    const s = document.createElement("script");
    s.src = "https://www.youtube.com/iframe_api";
    s.async = true;
    document.head.appendChild(s);
  });
  return apiPromise;
}

const ERRORS: Record<number, string> = {
  2: "That link doesn't look like a valid video.",
  5: "This video can't be played in the browser player.",
  100: "This video was removed or is private.",
  101: "The owner doesn't allow this video to be played outside YouTube.",
  150: "The owner doesn't allow this video to be played outside YouTube.",
};

/** A requestAnimationFrame-driven clock that smooths the player's coarse currentTime. */
export type PlayerClock = {
  subscribe: (fn: () => void) => () => void;
  getTime: () => number;
};

declare global {
  interface Window {
    onYouTubeIframeAPIReady?: () => void;
  }
}

function createClock(
  playerRef: React.RefObject<YT.Player | null>,
  statusRef: React.RefObject<PlayerStatus>,
): PlayerClock {
  const listeners = new Set<() => void>();
  let raf = 0;
  let lastRaw = -1;
  let lastAt = 0;
  let t = 0;
  const tick = (now: number) => {
    const p = playerRef.current;
    if (p && typeof p.getCurrentTime === "function") {
      const raw = p.getCurrentTime() || 0;
      if (raw !== lastRaw) {
        lastRaw = raw;
        lastAt = now;
      }
      let next = raw;
      if (statusRef.current === "playing") {
        const rate = p.getPlaybackRate?.() || 1;
        next = raw + Math.min((now - lastAt) / 1000, 1) * rate;
        // Ignore tiny backwards corrections from the coarse reported time.
        if (next < t && t - next < 0.3) next = t;
      }
      t = next;
    }
    listeners.forEach((fn) => fn());
    raf = requestAnimationFrame(tick);
  };
  return {
    subscribe(fn) {
      listeners.add(fn);
      if (listeners.size === 1) raf = requestAnimationFrame(tick);
      return () => {
        listeners.delete(fn);
        if (!listeners.size) cancelAnimationFrame(raf);
      };
    },
    getTime: () => t,
  };
}

export type ResolveVersion = (originalId: string) => Promise<string>;

/**
 * Drives a hidden YouTube player with our own queue. Playlists are only used to discover the
 * track list; each entry is then loaded as a single video so `resolveVersion` can swap in a
 * different upload of the same song (YouTube Music's Song/Video switch).
 */
export function useYouTubePlayer(
  mountRef: React.RefObject<HTMLDivElement | null>,
  {
    videoId,
    listId,
    resolveVersion,
  }: { videoId?: string; listId?: string; resolveVersion: React.RefObject<ResolveVersion> },
) {
  const playerRef = useRef<YT.Player | null>(null);
  const [snap, setSnap] = useState<PlayerSnapshot>(INITIAL);
  const statusRef = useRef<PlayerStatus>("loading");
  const queueRef = useRef<string[]>([]);
  const indexRef = useRef(0);
  const loadedIdRef = useRef<string | null>(null);
  // Bumped on every load so a slow version lookup can't override a newer choice.
  const loadSeq = useRef(0);
  // Event handling for the current player.
  const handlers = useRef<{ state: (e: YT.OnStateChangeEvent) => void; error: (e: YT.OnErrorEvent) => void }>({
    state: () => {},
    error: () => {},
  });

  const sync = useCallback((patch?: Partial<PlayerSnapshot>) => {
    const p = playerRef.current;
    setSnap((prev) => {
      const next = { ...prev, ...patch };
      if (p && typeof p.getVideoData === "function") {
        const data = p.getVideoData();
        if (data?.video_id) {
          if (data.video_id !== prev.videoId) {
            next.duration = 0;
            next.error = null;
          }
          next.videoId = data.video_id;
          next.rawTitle = data.title || "";
          next.channel = data.author || "";
        }
        const d = p.getDuration?.() ?? 0;
        // Latch the first real duration: it jitters by ~1s while buffering, which would refetch lyrics.
        if (d > 0 && (next.duration === 0 || Math.abs(d - next.duration) > 2)) next.duration = d;
      }
      next.playlist = queueRef.current.length ? queueRef.current : null;
      next.index = indexRef.current;
      next.loadedId = loadedIdRef.current;
      statusRef.current = next.status;
      return next;
    });
  }, []);

  /** Load a specific upload for the current queue slot, optionally at a position. */
  const loadId = useCallback(
    (id: string, start = 0) => {
      loadedIdRef.current = id;
      playerRef.current?.loadVideoById({ videoId: id, startSeconds: start });
      sync();
    },
    [sync],
  );

  const playIndex = useCallback(
    async (i: number) => {
      const queue = queueRef.current;
      if (i < 0 || i >= queue.length) return;
      indexRef.current = i;
      const seq = ++loadSeq.current;
      sync();
      const id = await resolveVersion.current(queue[i]).catch(() => queue[i]);
      if (seq === loadSeq.current) loadId(id);
    },
    [resolveVersion, loadId, sync],
  );

  useEffect(() => {
    let cancelled = false;
    let gestureTimer: ReturnType<typeof setTimeout> | undefined;
    let listTimer: ReturnType<typeof setInterval> | undefined;
    const mount = mountRef.current;
    if (!mount) return;
    const host = document.createElement("div");
    mount.appendChild(host);

    const begin = (queue: string[], start: number) => {
      queueRef.current = queue;
      playIndex(start);
      // Browsers block autoplay without a user gesture; fall back to a start screen.
      gestureTimer = setTimeout(() => {
        if (statusRef.current === "loading") sync({ status: "needs-gesture" });
      }, 3500);
    };

    loadYouTubeApi()
      .then((YTApi) => {
        if (cancelled) return;
        const playerVars: YT.PlayerVars = {
          autoplay: 0,
          controls: 0,
          disablekb: 1,
          playsinline: 1,
          rel: 0,
          iv_load_policy: 3,
          cc_load_policy: 0,
          origin: window.location.origin,
        };
        // Cue (not play) the playlist just to read its track list.
        if (listId) {
          playerVars.listType = "playlist";
          playerVars.list = listId;
        }
        handlers.current = {
          state: (e) => {
            if (e.target !== playerRef.current) return;
            const S = YTApi.PlayerState;
            if (e.data === S.ENDED) {
              const i = indexRef.current;
              if (i < queueRef.current.length - 1) playIndex(i + 1);
              else sync({ status: "ended" });
              return;
            }
            // Our lyrics replace YouTube's captions, which some videos switch on by default.
            if (e.data === S.PLAYING) (e.target as YT.Player & { unloadModule?: (m: string) => void }).unloadModule?.("captions");
            const status: PlayerStatus | undefined =
              e.data === S.PLAYING
                ? "playing"
                : e.data === S.PAUSED
                  ? "paused"
                  : e.data === S.BUFFERING
                    ? "buffering"
                    : undefined;
            // Keep "needs-gesture"/"loading" sticky until playback actually starts.
            if (status === "paused" && (statusRef.current === "needs-gesture" || statusRef.current === "loading")) {
              sync();
              return;
            }
            if (status === "buffering" && statusRef.current === "loading") {
              sync();
              return;
            }
            sync(status ? { status, error: null } : undefined);
          },
          error: (e) => {
            if (e.target !== playerRef.current) return;
            const msg = ERRORS[e.data as number] ?? "This video couldn't be played.";
            const i = indexRef.current;
            if (i < queueRef.current.length - 1) {
              // Skip unplayable entries in playlists.
              sync({ error: msg });
              setTimeout(() => playIndex(i + 1), 1500);
            } else {
              sync({ status: "error", error: msg });
            }
          },
        };
        playerRef.current = new YTApi.Player(host, {
          width: 320,
          height: 180,
          playerVars,
          events: {
            onReady: (e) => {
              if (!listId) return begin([videoId!], 0);
              let tries = 0;
              listTimer = setInterval(() => {
                const ids = e.target.getPlaylist?.();
                if (ids?.length) {
                  clearInterval(listTimer);
                  const at = videoId ? ids.indexOf(videoId) : 0;
                  if (videoId && at < 0) begin([videoId, ...ids], 0);
                  else begin(ids, Math.max(at, 0));
                } else if (++tries > 40) {
                  clearInterval(listTimer);
                  if (videoId) begin([videoId], 0);
                  else sync({ status: "error", error: "Couldn't load this playlist. Is it public?" });
                }
              }, 150);
            },
            onStateChange: (e) => handlers.current.state(e),
            onError: (e) => handlers.current.error(e),
          },
        });
      })
      .catch(() => {
        if (!cancelled) sync({ status: "error", error: "Couldn't start the YouTube player for this link." });
      });

    return () => {
      cancelled = true;
      clearTimeout(gestureTimer);
      clearInterval(listTimer);
      // Intentionally bump the live value: invalidates any version lookup still in flight.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      loadSeq.current++;
      playerRef.current?.destroy();
      playerRef.current = null;
      queueRef.current = [];
      indexRef.current = 0;
      loadedIdRef.current = null;
      host.remove();
      setSnap(INITIAL);
      statusRef.current = "loading";
    };
  }, [mountRef, videoId, listId, sync, playIndex]);

  // The clock only reads the refs inside its rAF loop, never during render.
  // eslint-disable-next-line react-hooks/refs
  const [clock] = useState(() => createClock(playerRef, statusRef));

  const controls = useMemo(
    () => ({
      play: () => playerRef.current?.playVideo(),
      pause: () => playerRef.current?.pauseVideo(),
      toggle: () => {
        const p = playerRef.current;
        if (!p) return;
        if (statusRef.current === "playing") p.pauseVideo();
        else p.playVideo();
      },
      seekBy: (s: number) => {
        const p = playerRef.current;
        if (p) p.seekTo(Math.max(0, p.getCurrentTime() + s), true);
      },
      seekTo: (s: number) => playerRef.current?.seekTo(s, true),
      getTime: () => playerRef.current?.getCurrentTime() ?? 0,
      next: () => playIndex(indexRef.current + 1),
      playAt: (i: number) => playIndex(i),
      prev: () => {
        const p = playerRef.current;
        if (!p) return;
        // Like most players: restart the song unless we're near its start.
        if (p.getCurrentTime() > 4 || indexRef.current === 0) p.seekTo(0, true);
        else playIndex(indexRef.current - 1);
      },
      /** Swap the upload playing in the current slot (Song <-> Video), continuing at `getStart()`. */
      swap: (id: string, getStart: () => number) => {
        loadSeq.current++;
        loadId(id, getStart());
      },
    }),
    [playIndex, loadId],
  );

  return { snap, clock, controls };
}

/** Subscribe to a derived value of the clock; re-renders only when the selected value changes. */
export function useClock<T>(clock: PlayerClock, select: (t: number) => T): T {
  return useSyncExternalStore(
    clock.subscribe,
    () => select(clock.getTime()),
    () => select(0),
  );
}
