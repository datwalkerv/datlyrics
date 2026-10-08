"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { cleanTitle, type SongInfo } from "@/lib/clean-title";
import { CoverImage } from "./CoverImage";
import { fetchArtwork, fetchVideoInfo, thumbnailUrl } from "./useTrackMeta";
import { useClock, type PlayerClock } from "./useYouTubePlayer";

const SHOW_BEFORE_END = 15;

export function UpNext({ nextId, clock, duration }: { nextId: string | null; clock: PlayerClock; duration: number }) {
  const [next, setNext] = useState<{ id: string; song: SongInfo; art: string } | null>(null);
  const show = useClock(clock, (t) => duration > 40 && t > 5 && duration - t <= SHOW_BEFORE_END);

  // Prefetch as soon as the track starts so the card (and the next track's artwork) is instant.
  useEffect(() => {
    if (!nextId) return;
    let alive = true;
    fetchVideoInfo(nextId)
      .then(async (v) => {
        const song = cleanTitle(v.title, v.channel);
        const art = (await fetchArtwork(song).catch(() => null)) ?? thumbnailUrl(nextId);
        if (alive) setNext({ id: nextId, song, art });
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [nextId]);

  const ready = next && next.id === nextId;

  return (
    <AnimatePresence>
      {show && ready && (
        <motion.div
          className="fixed bottom-[clamp(1.25rem,4vh,3rem)] right-[clamp(1.25rem,4vw,4rem)] z-20 flex max-w-[min(26rem,80vw)] items-center gap-4 rounded-2xl bg-neutral-900/75 p-3 pr-6 shadow-2xl ring-1 ring-white/10"
          initial={{ opacity: 0, y: 24, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 16 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        >
          <CoverImage src={next.art} className="size-16 shrink-0 rounded-lg object-cover" />
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/50">Up next</p>
            <p className="truncate text-lg font-semibold text-white">{next.song.title}</p>
            <p className="truncate text-sm text-white/60">{next.song.artist}</p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
