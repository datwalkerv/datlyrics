"use client";

import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { openSearch } from "@/components/SearchPalette";
import { Backdrop } from "./Backdrop";
import { toggleFullscreen, useIdle, useKeyboard } from "./hooks";
import { LyricsToast } from "./LyricsToast";
import { NowPlaying } from "./NowPlaying";
import { PlainLyrics } from "./PlainLyrics";
import { Queue } from "./Queue";
import { SyncedLyrics } from "./SyncedLyrics";
import { UpNext } from "./UpNext";
import { classifyUpload } from "@/lib/clean-title";
import { mapTimeByLyrics } from "@/lib/lrc";
import { fetchLyrics, pickVersion, useArtwork, useLyrics, useSongInfo } from "./useTrackMeta";
import { useYouTubePlayer, type ResolveVersion } from "./useYouTubePlayer";

const VIDEO_PREF_KEY = "datlyrics:video";

function readVideoPref(): boolean {
  try {
    return typeof window !== "undefined" && localStorage.getItem(VIDEO_PREF_KEY) === "1";
  } catch {
    return false;
  }
}

export function Player({ videoId, listId }: { videoId?: string; listId?: string }) {
  const router = useRouter();
  const mountRef = useRef<HTMLDivElement>(null);
  const mediaRef = useRef<HTMLDivElement>(null);
  const [videoMode, setVideoMode] = useState(readVideoPref);
  const [queueOpen, setQueueOpen] = useState(false);
  // Which upload each queue entry plays as: its song or its music video, per the current mode.
  const resolveFor = (want: "song" | "video"): ResolveVersion => (id) => pickVersion(id, want).then((v) => v.id);
  const resolveVersion = useRef<ResolveVersion>(resolveFor(readVideoPref() ? "video" : "song"));
  const { snap, clock, controls } = useYouTubePlayer(mountRef, { videoId, listId, resolveVersion });
  // Durations of uploads we've played, for timeline mapping when switching back to them.
  const durations = useRef(new Map<string, number>());
  // Per-track manual lyrics offset (official videos often have intros the LRC doesn't).
  const [offsetState, setOffsetState] = useState<{ id: string | null; value: number }>({ id: null, value: 0 });
  const [toast, setToast] = useState<{ id: number; text: string } | null>(null);

  // Lyrics, artwork and titles follow the queue entry, not whichever upload of it is playing, so
  // a Song <-> Video swap doesn't reload or re-animate them.
  const original = snap.playlist?.[snap.index] ?? snap.videoId;
  const playingOriginal = snap.videoId === original;
  // Until the slot's upload has actually loaded, the player still reports the previous track.
  const playingThisTrack = !!snap.videoId && snap.videoId === snap.loadedId;
  const song = useSongInfo(original, playingOriginal ? snap.rawTitle : "", playingOriginal ? snap.channel : "");
  const artwork = useArtwork(original, song);
  const lyrics = useLyrics(song, playingThisTrack ? snap.duration : 0);

  const playing = snap.status === "playing" || snap.status === "buffering";
  const hasQueue = (snap.playlist?.length ?? 0) > 1;
  const idle = useIdle(2500, playing && !queueOpen);
  const nextId = snap.playlist?.[snap.index + 1] ?? null;
  const trackKey = `${snap.index}:${original ?? "none"}`;
  const offset = offsetState.id === snap.videoId ? offsetState.value : 0;
  // A song upload has nothing to watch (static cover); keep the artwork even in video mode.
  const showVideo = videoMode && classifyUpload(snap.rawTitle, snap.channel) !== "song";

  // YouTube overlays its title bar and a play icon for the first seconds of playback; keep the
  // cover in the box until that has passed, then fade the video in over it.
  const [videoReadyId, setVideoReadyId] = useState<string | null>(null);
  useEffect(() => {
    if (!showVideo || snap.status !== "playing" || !snap.videoId) return;
    const id = snap.videoId;
    const t = setTimeout(() => setVideoReadyId(id), 3000);
    return () => clearTimeout(t);
  }, [showVideo, snap.status, snap.videoId]);
  const videoVisible = showVideo && videoReadyId === snap.videoId;
  const videoVisibleRef = useRef(false);
  useEffect(() => {
    videoVisibleRef.current = videoVisible;
  }, [videoVisible]);

  useEffect(() => {
    resolveVersion.current = resolveFor(videoMode ? "video" : "song");
  }, [videoMode]);

  useEffect(() => {
    if (snap.videoId && snap.duration > 0) durations.current.set(snap.videoId, snap.duration);
  }, [snap.videoId, snap.duration]);

  // Warm the next track's version lookup so advancing is instant.
  useEffect(() => {
    if (nextId) pickVersion(nextId, videoMode ? "video" : "song").catch(() => {});
  }, [nextId, videoMode]);

  const flash = (text: string) => {
    const id = Date.now();
    setToast({ id, text });
    setTimeout(() => setToast((t) => (t?.id === id ? null : t)), 1400);
  };

  const adjustOffset = (delta: number) => {
    const v = Math.round((offset + delta) * 100) / 100;
    setOffsetState({ id: snap.videoId, value: v });
    flash(`Lyrics offset ${v > 0 ? "+" : ""}${v.toFixed(2)}s`);
  };

  /** YouTube Music's Song/Video switch: swap to the other upload, continuing at the same point in the song. */
  const toggleVideo = async () => {
    const v = !videoMode;
    setVideoMode(v);
    try {
      localStorage.setItem(VIDEO_PREF_KEY, v ? "1" : "0");
    } catch {}

    if (!original || !snap.videoId) return;
    const picked = await pickVersion(original, v ? "video" : "song").catch(() => null);
    if (!picked) return;
    if (picked.id === snap.videoId) {
      if (v && classifyUpload(snap.rawTitle, snap.channel) === "song") flash("No music video for this song");
      return;
    }

    // Versions differ in intros, skits and breaks, so map the live position through both versions'
    // own lyric timings when we have them; otherwise keep the same timestamp.
    let map = (t: number) => t;
    const targetSeconds = picked.seconds || durations.current.get(picked.id) || 0;
    if (song && lyrics.status === "ready" && lyrics.synced && targetSeconds > 0) {
      const from = lyrics.synced;
      const target = await fetchLyrics(song, targetSeconds).catch(() => null);
      const to = target?.synced;
      if (to && mapTimeByLyrics(controls.getTime(), from, to) !== null) map = (t) => mapTimeByLyrics(t, from, to) ?? t;
    }
    const clamp = (t: number) => Math.max(targetSeconds > 0 ? Math.min(t, targetSeconds - 1) : t, 0);
    controls.swap(picked.id, () => clamp(map(controls.getTime())));
    flash(v ? "Music video" : "Song");
  };

  // Lay the iframe exactly over the media box, invisible unless there's a video to show (kept full
  // size so YouTube streams a sensible quality). The iframe can't be re-parented without reloading,
  // so it stays put and just follows the box's rect.
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    let raf = 0;
    const follow = () => {
      const box = mediaRef.current?.getBoundingClientRect();
      if (box) {
        Object.assign(mount.style, {
          left: `${box.left}px`,
          top: `${box.top}px`,
          width: `${box.width}px`,
          height: `${box.height}px`,
          opacity: videoVisibleRef.current ? "1" : "0",
        });
      }
      raf = requestAnimationFrame(follow);
    };
    raf = requestAnimationFrame(follow);
    return () => cancelAnimationFrame(raf);
  }, []);

  useKeyboard({
    " ": () => controls.toggle(),
    k: () => controls.toggle(),
    ArrowLeft: () => controls.seekBy(-5),
    ArrowRight: () => controls.seekBy(5),
    j: () => controls.seekBy(-10),
    l: () => controls.seekBy(10),
    n: () => controls.next(),
    p: () => controls.prev(),
    f: () => toggleFullscreen(),
    v: () => toggleVideo(),
    q: () => hasQueue && setQueueOpen((o) => !o),
    "[": () => adjustOffset(-0.25),
    "]": () => adjustOffset(0.25),
    Escape: () => {
      if (queueOpen) setQueueOpen(false);
      else if (!document.fullscreenElement) router.push("/");
    },
  });

  const start = () => {
    controls.play();
    toggleFullscreen();
  };

  let lyricsView: React.ReactNode = null;
  // When there's nothing to show, a toast says why and the player moves to the centre.
  let noLyricsMessage: string | null = null;
  if (song && lyrics.status === "error") {
    noLyricsMessage = "Couldn't load lyrics";
  } else if (song && lyrics.status === "ready") {
    if (lyrics.synced) {
      lyricsView = (
        <SyncedLyrics lines={lyrics.synced} clock={clock} duration={snap.duration} offset={offset} onSeek={controls.seekTo} />
      );
    } else if (lyrics.plain) {
      lyricsView = <PlainLyrics text={lyrics.plain} clock={clock} duration={snap.duration} />;
    } else {
      noLyricsMessage = lyrics.instrumental ? "♪ Instrumental" : "Lyrics aren't available for this song";
    }
  }
  const centered = noLyricsMessage !== null;

  return (
    <main className={`relative isolate h-dvh w-full overflow-hidden text-white ${idle ? "cursor-none" : ""}`}>
      <Backdrop src={artwork} />

      {/* The real YouTube player: kept rendered (not display:none) so playback isn't throttled, but invisible. */}
      <div
        ref={mountRef}
        aria-hidden
        className="yt-mount pointer-events-none fixed -left-[9999px] top-0 z-10 size-px overflow-hidden rounded-[clamp(10px,1vw,20px)] opacity-0 transition-opacity duration-500"
      />

      <div
        className={`grid h-full items-center px-[6vw] py-[8vh] max-md:px-5 max-md:py-6 ${
          centered
            ? "grid-cols-1 justify-items-center"
            : "grid-cols-[minmax(0,40fr)_minmax(0,60fr)] gap-[8vw] max-md:grid-cols-1 max-md:grid-rows-[auto_minmax(0,1fr)] max-md:gap-6"
        }`}
      >
        <div className={`flex w-full justify-center ${centered ? "" : "md:justify-end"}`}>
          <NowPlaying
            trackKey={trackKey}
            song={song}
            artwork={artwork}
            clock={clock}
            duration={snap.duration}
            onSeek={controls.seekTo}
            videoMode={showVideo}
            mediaRef={mediaRef}
          />
        </div>
        {!centered && (
          <div className="h-full min-h-0">
            <AnimatePresence mode="wait">
              <motion.div
                key={`${trackKey}:${lyrics.status}`}
                className="h-full"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.5 }}
              >
                {lyricsView}
              </motion.div>
            </AnimatePresence>
          </div>
        )}
      </div>

      {noLyricsMessage && <LyricsToast key={`${trackKey}:${noLyricsMessage}`} message={noLyricsMessage} />}

      {/* Subtle chrome that appears with the cursor. */}
      <div
        className={`pointer-events-none fixed inset-x-0 top-0 z-20 flex items-center justify-between px-[clamp(1.25rem,3vw,3rem)] py-5 transition-opacity duration-700 ${
          idle ? "opacity-0" : "opacity-100"
        }`}
      >
        <Link href="/" className="pointer-events-auto text-lg font-bold tracking-tight text-white/70 hover:text-white">
          datlyrics
        </Link>
        <div className="flex items-center gap-5">
          <p className="text-xs font-medium text-white/40 max-md:hidden">
            ⌘K search ·{hasQueue ? " Q queue ·" : ""} Space play/pause · ←/→ seek · N/P next/prev · [ ] offset · V video · F fullscreen
          </p>
          <button
            onClick={openSearch}
            aria-label="Search"
            className="pointer-events-auto flex size-8 items-center justify-center rounded-full bg-white/10 text-white/80 ring-1 ring-white/15 backdrop-blur-xl transition hover:bg-white/20 hover:text-white"
          >
            <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2.4">
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </div>

      {listId && !queueOpen && <UpNext nextId={nextId} clock={clock} duration={snap.duration} />}

      <AnimatePresence>
        {queueOpen && snap.playlist && (
          <Queue
            ids={snap.playlist}
            current={snap.index}
            onPick={(i) => controls.playAt(i)}
            onClose={() => setQueueOpen(false)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {toast && (
          <motion.div
            key={toast.id}
            className="fixed left-1/2 top-8 z-30 -translate-x-1/2 rounded-full bg-black/50 px-5 py-2 text-sm font-semibold backdrop-blur-xl"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            {toast.text}
          </motion.div>
        )}
        {snap.status === "paused" && (
          <motion.div
            key="paused"
            className="pointer-events-none fixed bottom-8 left-1/2 z-30 -translate-x-1/2 rounded-full bg-black/40 px-5 py-2 text-sm font-semibold tracking-wide text-white/80 backdrop-blur-xl"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            Paused
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {(snap.status === "needs-gesture" || snap.status === "error" || snap.status === "loading") && (
          <motion.div
            key="overlay"
            className="fixed inset-0 z-40 flex flex-col items-center justify-center gap-6 bg-black/50 px-6 text-center backdrop-blur-md"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.8 } }}
          >
            {snap.status === "loading" && <div className="size-10 animate-spin rounded-full border-2 border-white/20 border-t-white" />}
            {snap.status === "needs-gesture" && (
              <>
                <button
                  onClick={start}
                  autoFocus
                  className="flex size-28 items-center justify-center rounded-full bg-white text-black shadow-2xl transition-transform hover:scale-105 focus:outline-none focus-visible:ring-4 focus-visible:ring-white/40"
                  aria-label="Start playback"
                >
                  <svg viewBox="0 0 24 24" className="ml-1.5 size-12" fill="currentColor">
                    <path d="M8 5.5v13a1 1 0 0 0 1.5.86l11-6.5a1 1 0 0 0 0-1.72l-11-6.5A1 1 0 0 0 8 5.5Z" />
                  </svg>
                </button>
                <p className="text-lg font-medium text-white/70">Press play to start{song ? ` · ${song.title}` : ""}</p>
              </>
            )}
            {snap.status === "error" && (
              <>
                <p className="max-w-xl text-2xl font-bold">{snap.error}</p>
                <Link href="/" className="rounded-full bg-white px-6 py-3 font-semibold text-black">
                  Try another link
                </Link>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}
