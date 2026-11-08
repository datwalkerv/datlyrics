"use client";

import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { openSearch } from "@/components/SearchPalette";
import { recordPlay } from "@/lib/history";
import { openSavePicker } from "@/components/PlaylistModals";
import { Backdrop } from "./Backdrop";
import { toggleFullscreen, useCoarsePointer, useIdle, useKeyboard } from "./hooks";
import { Controls, MoreSheet } from "./Controls";
import { withoutFeat } from "@/lib/clean-title";
import { LyricsToast } from "./LyricsToast";
import { MiniPlayer } from "./MiniPlayer";
import { PLAY_NEXT_EVENT, playHref, publishNowPlaying } from "./remote";
import { Settings } from "./Settings";
import { NowPlaying } from "./NowPlaying";
import { PlainLyrics } from "./PlainLyrics";
import { Queue } from "./Queue";
import { TorchCursor } from "./TorchCursor";
import { useMediaSession } from "./useMediaSession";
import { isLowEndDevice, usePerformanceGuard } from "./usePerformanceGuard";
import { VolumeHud, VolumeSlider } from "./Volume";
import { ProgressBar } from "./ProgressBar";
import { SyncedLyrics } from "./SyncedLyrics";
import { UpNext } from "./UpNext";
import { classifyUpload } from "@/lib/clean-title";
import { mapTimeByLyrics } from "@/lib/lrc";
import { fetchLyrics, pickVersion, useArtwork, useLyrics, useSongInfo } from "./useTrackMeta";
import { useYouTubePlayer, type ResolveVersion } from "./useYouTubePlayer";

const VIDEO_PREF_KEY = "datlyrics:video";
const EFFECTS_PREF_KEY = "datlyrics:effects";
const VOLUME_PREF_KEY = "datlyrics:volume";
const VIEW_PREF_KEY = "datlyrics:view";

/** Background effects follow your choice (E, or the More sheet on touch); with none, off on phones, tablets and weak hardware. */
function readEffectsPref(): boolean {
  if (typeof window === "undefined") return true;
  try {
    const saved = localStorage.getItem(EFFECTS_PREF_KEY);
    if (saved !== null) return saved !== "0";
  } catch {}
  // Touch devices: save the battery and GPU unless asked.
  return !window.matchMedia("(pointer: coarse)").matches && !isLowEndDevice();
}

/** Lyrics next to the cover, or the cover alone (C, or the transport's lyrics button). */
function readViewPref(): "lyrics" | "cover" {
  try {
    return typeof window !== "undefined" && localStorage.getItem(VIEW_PREF_KEY) === "cover" ? "cover" : "lyrics";
  } catch {
    return "lyrics";
  }
}

function readVolumePref(): number {
  try {
    const v = Number(localStorage.getItem(VOLUME_PREF_KEY));
    return localStorage.getItem(VOLUME_PREF_KEY) !== null && Number.isFinite(v) ? Math.min(Math.max(v, 0), 100) : 100;
  } catch {
    return 100;
  }
}

function readVideoPref(): boolean {
  try {
    return typeof window !== "undefined" && localStorage.getItem(VIDEO_PREF_KEY) === "1";
  } catch {
    return false;
  }
}

export function Player({
  videoId,
  listId,
  minimized = false,
  playbackKeysWhenMinimized = false,
}: {
  videoId?: string;
  listId?: string;
  /** Out of sight while home or an artist page is open: keeps playing, shows a mini bar instead. */
  minimized?: boolean;
  /** Keep play/pause, seek, next/prev, loop, shuffle, save and song/video keys while minimized (/home). */
  playbackKeysWhenMinimized?: boolean;
}) {
  const router = useRouter();
  const mountRef = useRef<HTMLDivElement>(null);
  const mediaRef = useRef<HTMLDivElement>(null);
  const [videoMode, setVideoMode] = useState(readVideoPref);
  const [effects, setEffects] = useState(readEffectsPref);
  const [effectsAutoOff, setEffectsAutoOff] = useState(false);
  const [effectsManual, setEffectsManual] = useState(false);
  const [queueOpen, setQueueOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [view, setView] = useState(readViewPref);
  const coarse = useCoarsePointer();
  const [loop, setLoop] = useState(false);
  const [shuffle, setShuffle] = useState(false);
  // Which upload each queue entry plays as: its song or its music video, per the current mode.
  const resolveFor = (want: "song" | "video"): ResolveVersion => (id) => pickVersion(id, want).then((v) => v.id);
  const resolveVersion = useRef<ResolveVersion>(resolveFor(readVideoPref() ? "video" : "song"));
  const [volume, setVolume] = useState(readVolumePref);
  const [volumeHud, setVolumeHud] = useState<number | null>(null);
  const { snap, clock, controls } = useYouTubePlayer(mountRef, {
    videoId,
    listId,
    resolveVersion,
    initialVolume: volume,
  });
  // Durations of uploads we've played, for timeline mapping when switching back to them.
  const durations = useRef(new Map<string, number>());
  // Per-track manual lyrics offset (official videos often have intros the LRC doesn't).
  const [offsetState, setOffsetState] = useState<{ id: string | null; value: number }>({ id: null, value: 0 });
  const [toast, setToast] = useState<{ id: number; text: string } | null>(null);

  // Lyrics, artwork and titles follow the queue entry, not whichever upload of it is playing, so
  // a Song <-> Video swap doesn't reload or re-animate them.
  const original = snap.playlist?.[snap.index] ?? snap.videoId;
  const nowPlayingHref = original ? playHref({ videoId: original, listId }) : playHref({ videoId, listId });

  // Share what's actually playing, and keep the address on it while the lyrics are open, so
  // reloading or sharing it gives this song (PlayerHost knows it's already playing).
  useEffect(() => {
    if (!original) return;
    publishNowPlaying({ videoId: original, listId });
    if (!minimized && window.location.pathname === "/play" && `${window.location.pathname}${window.location.search}` !== nowPlayingHref)
      window.history.replaceState(null, "", nowPlayingHref);
  }, [original, listId, minimized, nowPlayingHref]);
  const playingOriginal = snap.videoId === original;
  // Until the slot's upload has actually loaded, the player still reports the previous track.
  const playingThisTrack = !!snap.videoId && snap.videoId === snap.loadedId;
  const song = useSongInfo(original, playingOriginal ? snap.rawTitle : "", playingOriginal ? snap.channel : "");
  const artwork = useArtwork(original, song);
  const lyrics = useLyrics(song, playingThisTrack ? snap.duration : 0, snap.videoId);

  const playing = snap.status === "playing" || snap.status === "buffering";
  const hasQueue = (snap.playlist?.length ?? 0) > 1;
  const idle = useIdle(2500, playing && !queueOpen && !settingsOpen && !moreOpen && !minimized);
  const nextId = snap.playlist?.[snap.index + 1] ?? null;
  const trackKey = `${snap.index}:${original ?? "none"}`;

  // While a song plays the tab names it on every page; otherwise the page's own title stays.
  const tabTitle = playing && song?.title ? `${song.title} - datlyrics` : null;
  useEffect(() => {
    if (!tabTitle) return;
    let pageTitle = document.title;
    // Pages set their own title on navigation (some a moment later, once their metadata streams in): remember it and put ours back.
    const apply = () => {
      if (document.title === tabTitle) return;
      pageTitle = document.title;
      document.title = tabTitle;
    };
    apply();
    const observer = new MutationObserver(apply);
    observer.observe(document.head, { subtree: true, childList: true, characterData: true });
    return () => {
      observer.disconnect();
      if (document.title === tabTitle) document.title = pageTitle;
    };
  }, [tabTitle]);

  // Feed /home's "Continue listening" and "Recently played" once a track actually plays.
  const playingNow = snap.status === "playing" && playingThisTrack;
  useEffect(() => {
    if (playingNow && original && song)
      recordPlay({ id: original, title: song.title, artist: song.artist, image: artwork, listId: listId ?? null });
  }, [playingNow, original, song, artwork, listId]);
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

  const flash = (text: string, ms = 1400) => {
    const id = Date.now();
    setToast({ id, text });
    setTimeout(() => setToast((t) => (t?.id === id ? null : t)), ms);
  };

  useEffect(() => {
    const onPlayNext = (e: Event) => {
      const ids = (e as CustomEvent<string[]>).detail;
      controls.playNext(ids);
      flash(ids.length > 1 ? `${ids.length} songs playing next` : "Playing next");
    };
    window.addEventListener(PLAY_NEXT_EVENT, onPlayNext);
    return () => window.removeEventListener(PLAY_NEXT_EVENT, onPlayNext);
  });

  const adjustOffset = (delta: number) => {
    const v = Math.round((offset + delta) * 100) / 100;
    setOffsetState({ id: snap.videoId, value: v });
    flash(`Lyrics offset ${v > 0 ? "+" : ""}${v.toFixed(2)}s`);
  };

  const changeVolume = (v: number, fromKeys = false) => {
    const next = Math.min(Math.max(Math.round(v), 0), 100);
    setVolume(next);
    controls.setVolume(next);
    try {
      localStorage.setItem(VOLUME_PREF_KEY, String(next));
    } catch {}
    if (fromKeys) {
      const id = Date.now();
      setVolumeHud(id);
      setTimeout(() => setVolumeHud((h) => (h === id ? null : h)), 1200);
    }
  };

  const toggleEffects = () => {
    const v = !effects;
    setEffects(v);
    // Turning them back on after an automatic switch-off: trust that choice for this session.
    if (v && effectsAutoOff) setEffectsManual(true);
    try {
      localStorage.setItem(EFFECTS_PREF_KEY, v ? "1" : "0");
    } catch {}
    flash(v ? "Background effects on" : "Background effects off");
  };

  // Slow device: switch effects off on its own (not saved, so a faster machine gets them next time).
  usePerformanceGuard({
    effects,
    manualOverride: effectsManual,
    onSlow: () => {
      setEffects(false);
      setEffectsAutoOff(true);
      flash("Effects turned off to keep playback smooth · E to turn back on", 4000);
    },
  });

  const toggleLoop = () => {
    const v = !loop;
    setLoop(v);
    controls.setLoop(v);
    flash(v ? "Loop on" : "Loop off");
  };

  const toggleShuffle = () => {
    const v = !shuffle;
    setShuffle(v);
    controls.setShuffle(v);
    flash(v ? "Shuffle on" : "Shuffle off");
  };

  const toggleView = () => {
    const v = view === "lyrics" ? "cover" : "lyrics";
    setView(v);
    try {
      localStorage.setItem(VIEW_PREF_KEY, v);
    } catch {}
  };

  /** S: pick which playlists the song that's playing is saved to. */
  const toggleSaved = () => {
    if (original) openSavePicker({ id: original, title: song?.title, subtitle: song?.artist, image: artwork });
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

  // Where the YouTube iframe sits. Without a video to show it's parked small and off-screen, so
  // the browser doesn't decode or composite video nobody sees. In video mode it's laid
  // exactly over the media box (the iframe can't be re-parented without reloading, so it follows
  // the box's rect), writing styles only when the box actually moves.
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    if (!showVideo) {
      // Off-screen, not just transparent: browsers stop decoding and drawing video that's out of
      // view (audio keeps playing), while a transparent on-screen player still decodes every frame.
      Object.assign(mount.style, { left: "-10000px", top: "0px", width: "256px", height: "144px", opacity: "0" });
      return;
    }
    let raf = 0;
    let last = "";
    const follow = () => {
      const box = mediaRef.current?.getBoundingClientRect();
      if (box) {
        const key = `${box.left}|${box.top}|${box.width}|${box.height}`;
        if (key !== last) {
          last = key;
          Object.assign(mount.style, {
            left: `${box.left}px`,
            top: `${box.top}px`,
            width: `${box.width}px`,
            height: `${box.height}px`,
          });
        }
      }
      raf = requestAnimationFrame(follow);
    };
    raf = requestAnimationFrame(follow);
    return () => cancelAnimationFrame(raf);
  }, [showVideo]);

  useEffect(() => {
    const mount = mountRef.current;
    if (mount) mount.style.opacity = showVideo && videoVisible ? "1" : "0";
  }, [showVideo, videoVisible]);

  useMediaSession({ controls, song, artwork, status: snap.status, duration: snap.duration, clock });

  // The page (home or artist) has the keyboard while minimized (media keys still work via the Media Session).
  // Keys that act on playback itself, so they also make sense from /home's mini bar.
  const playbackKeys = {
    // Media keys, for browsers that deliver them to the page as key presses.
    MediaPlayPause: () => controls.toggle(),
    MediaTrackNext: () => controls.next(),
    MediaTrackPrevious: () => controls.prev(),
    " ": () => controls.toggle(),
    k: () => controls.toggle(),
    ArrowLeft: () => controls.seekBy(-5),
    ArrowRight: () => controls.seekBy(5),
    j: () => controls.seekBy(-10),
    l: () => toggleLoop(),
    r: () => hasQueue && toggleShuffle(),
    n: () => controls.next(),
    p: () => controls.prev(),
    v: () => toggleVideo(),
    s: () => toggleSaved(),
  };
  // While settings are open its buttons get the keys (Space/Enter press them), except Esc to close.
  // Minimized, only /home takes playback keys; ↑/↓ stay page scrolling and the rest need the lyrics view.
  useKeyboard(settingsOpen || moreOpen ? { Escape: () => (setSettingsOpen(false), setMoreOpen(false)) } : minimized ? (playbackKeysWhenMinimized ? playbackKeys : {}) : {
    ...playbackKeys,
    ArrowUp: () => changeVolume(volume + 5, true),
    ArrowDown: () => changeVolume(volume - 5, true),
    f: () => toggleFullscreen(),
    e: () => toggleEffects(),
    q: () => hasQueue && setQueueOpen((o) => !o),
    c: () => lyricsView && toggleView(),
    "[": () => adjustOffset(-0.25),
    "]": () => adjustOffset(0.25),
    Escape: () => {
      if (queueOpen) setQueueOpen(false);
      else if (!document.fullscreenElement) router.push("/home");
    },
  });

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
  // Cover view only applies when there are lyrics to hide; otherwise the toggle is off.
  const coverView = !!lyricsView && view === "cover";
  const centered = noLyricsMessage !== null || coverView;
  // Phones show lyrics under a compact title row, with the seek bar in the transport.
  const compact = !!lyricsView && !coverView;
  const artistHref = song?.artist ? `/artist/${encodeURIComponent(withoutFeat(song.artist))}` : null;

  return (
    <>
      <main
        inert={minimized}
        className={`cursor-hidden isolate flex h-dvh w-full flex-col overflow-hidden overscroll-none text-white ${idle ? "cursor-idle" : ""} ${
          minimized ? "pointer-events-none fixed inset-0 -z-10 opacity-0" : "relative"
        }`}
      >
        {/* The cursor is hidden on the player; the torch is the cursor, lighting the backdrop under the lyrics. */}
        <Backdrop src={artwork} animated={effects && !minimized}>
          <TorchCursor active={!idle && !minimized} />
        </Backdrop>

        {/* The real YouTube player: kept rendered (not display:none) so playback isn't throttled, but invisible. */}
        <div
          ref={mountRef}
          aria-hidden
          className="yt-mount pointer-events-none fixed -left-[9999px] top-0 z-10 size-px overflow-hidden rounded-[clamp(10px,1vw,20px)] opacity-0 transition-opacity duration-500"
        />

        <div
          className={`grid min-h-0 flex-1 items-center px-[6vw] py-[8vh] max-md:px-5 max-md:pb-3 max-md:pt-[calc(env(safe-area-inset-top)+4.25rem)] ${
            centered
              ? "grid-cols-1 justify-items-center"
              : "grid-cols-[minmax(0,40fr)_minmax(0,60fr)] gap-[8vw] max-md:grid-cols-1 max-md:grid-rows-[auto_minmax(0,1fr)] max-md:gap-4"
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
              compact={compact}
              artistHref={artistHref}
              // Touch: swipe the cover for next/previous, down to go home.
              onSwipe={
                coarse
                  ? (dir) => (dir === "left" ? controls.next() : dir === "right" ? controls.prev() : router.push("/home"))
                  : undefined
              }
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

        {/* Subtle chrome that appears while the mouse moves. */}
        <div
          className={`fixed inset-x-0 top-0 z-20 flex items-center justify-between px-[clamp(1.25rem,3vw,3rem)] pb-5 pt-[calc(env(safe-area-inset-top)+1.25rem)] transition-opacity duration-700 ${
            idle ? "pointer-events-none opacity-0" : "opacity-100"
          }`}
        >
          <Link href="/home" className="pointer-events-auto text-lg font-bold tracking-tight text-white/70 hover:text-white max-md:hidden touch:hidden">
            datlyrics
          </Link>
          {/* Phones: a chevron down to home, like closing a native now-playing screen. */}
          <Link
            href="/home"
            aria-label="Home"
            className="pointer-events-auto -ml-2 hidden size-10 items-center justify-center rounded-full text-white/80 max-md:flex touch:flex"
          >
            <svg viewBox="0 0 24 24" className="size-7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="m6 9 6 6 6-6" />
            </svg>
          </Link>
          <div className="flex items-center gap-5">
            <p className="text-xs font-medium text-white/40 max-md:hidden touch:hidden">
              ⌘K search ·{hasQueue ? " Q queue · R shuffle ·" : ""} S save · L loop · C cover/lyrics · E effects · Space play/pause · ←/→ seek · ↑/↓ volume · N/P next/prev · [ ] offset · V video · F fullscreen
            </p>
            {/* Phones set volume with their buttons (iOS ignores page volume). */}
            <div className="touch:hidden">
              <VolumeSlider volume={volume} onChange={(v) => changeVolume(v)} />
            </div>
            {/* Search is the main action, so only it gets a pill; the rest are quiet icons. */}
            <div className="flex items-center gap-1">
              <button
                onClick={openSearch}
                aria-label="Search"
                className="cursor-show pointer-events-auto flex size-8 items-center justify-center rounded-full bg-white/10 text-white/80 ring-1 ring-white/15 transition hover:bg-white/20 hover:text-white"
              >
                <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2.4">
                  <circle cx="11" cy="11" r="7" />
                  <path d="m20 20-3.5-3.5" strokeLinecap="round" />
                </svg>
              </button>
              <button
                onClick={() => setSettingsOpen(true)}
                aria-label="Settings"
                title="Settings"
                className="cursor-show pointer-events-auto flex size-8 items-center justify-center rounded-full text-white/70 transition hover:bg-white/10 hover:text-white"
              >
                <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
                </svg>
              </button>
              <Link
                href="/"
                aria-label="datlyrics landing page"
                title="datlyrics landing page"
                className="cursor-show pointer-events-auto flex size-8 items-center justify-center rounded-full text-white/70 transition hover:bg-white/10 hover:text-white"
              >
                <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" aria-hidden>
                  <path d="M4 10.5 12 4l8 6.5V19a1 1 0 0 1-1 1h-4.5v-5.5h-5V20H5a1 1 0 0 1-1-1v-8.5Z" />
                </svg>
              </Link>
            </div>
          </div>
        </div>

        <Controls
          playing={playing}
          onToggle={() => controls.toggle()}
          onNext={() => controls.next()}
          onPrev={() => controls.prev()}
          shuffle={shuffle}
          onShuffle={hasQueue ? toggleShuffle : undefined}
          loop={loop}
          onLoop={toggleLoop}
          view={coverView || !lyricsView ? "cover" : "lyrics"}
          onView={lyricsView ? toggleView : undefined}
          onQueue={hasQueue ? () => setQueueOpen(true) : undefined}
          onSave={toggleSaved}
          videoMode={videoMode}
          onVideo={toggleVideo}
          onMore={() => setMoreOpen(true)}
          progress={compact ? <ProgressBar clock={clock} duration={snap.duration} onSeek={controls.seekTo} /> : undefined}
        />

        <AnimatePresence>
          {moreOpen && (
            <MoreSheet
              onClose={() => setMoreOpen(false)}
              offset={offset}
              onOffset={adjustOffset}
              effects={effects}
              onEffects={toggleEffects}
              onSearch={openSearch}
              onSettings={() => setSettingsOpen(true)}
              artistHref={artistHref}
            />
          )}
        </AnimatePresence>

        <VolumeHud volume={volume} show={volumeHud !== null} />

        <AnimatePresence>{settingsOpen && <Settings onClose={() => setSettingsOpen(false)} />}</AnimatePresence>

        {!queueOpen && <UpNext nextId={nextId} clock={clock} duration={snap.duration} />}

        <AnimatePresence>
          {queueOpen && snap.playlist && (
            <Queue
              ids={snap.playlist}
              current={snap.index}
              onPick={(i) => controls.playAt(i)}
              onClose={() => setQueueOpen(false)}
              asSheet={coarse}
            />
          )}
        </AnimatePresence>

        <AnimatePresence>
          {toast && (
            <motion.div
              key={toast.id}
              className="fixed left-1/2 top-[calc(env(safe-area-inset-top)+2rem)] z-30 -translate-x-1/2 whitespace-nowrap rounded-full bg-neutral-900/80 px-5 py-2 text-sm font-semibold shadow-xl ring-1 ring-white/10"
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
              className="pointer-events-none fixed bottom-8 left-1/2 z-30 -translate-x-1/2 rounded-full max-md:hidden touch:hidden bg-neutral-900/75 px-5 py-2 text-sm font-semibold tracking-wide text-white/80 shadow-xl ring-1 ring-white/10"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              Paused
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {(snap.status === "error" || snap.status === "loading") && (
            <motion.div
              key="overlay"
              className="fixed inset-0 z-40 flex flex-col items-center justify-center gap-6 bg-black/70 px-6 text-center"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, transition: { duration: 0.8 } }}
            >
              {snap.status === "loading" && <div className="size-10 animate-spin rounded-full border-2 border-white/20 border-t-white" />}
              {snap.status === "error" && (
                <>
                  <p className="max-w-xl text-2xl font-bold">{snap.error}</p>
                  <Link href="/home" className="rounded-full bg-white px-6 py-3 font-semibold text-black">
                    Try another link
                  </Link>
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>
      {/* The lyrics view (and its toasts) is hidden while minimized: show key feedback above the mini bar. */}
      <AnimatePresence>
        {minimized && toast && (
          <motion.div
            key={toast.id}
            role="status"
            className="pointer-events-none fixed bottom-24 left-1/2 z-40 -translate-x-1/2 rounded-full bg-neutral-900/85 px-4 py-2 text-sm font-semibold text-white/85 shadow-xl ring-1 ring-white/10 backdrop-blur-2xl"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            {toast.text}
          </motion.div>
        )}
      </AnimatePresence>
      {minimized && (
        <MiniPlayer
          song={song}
          artwork={artwork}
          playing={playing}
          onToggle={() => controls.toggle()}
          onNext={() => controls.next()}
          href={nowPlayingHref}
          clock={clock}
          duration={snap.duration}
        />
      )}
    </>
  );
}
