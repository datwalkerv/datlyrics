"use client";

import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import type { SongInfo } from "@/lib/clean-title";
import { CoverImage } from "./CoverImage";
import { ProgressBar } from "./ProgressBar";
import type { PlayerClock } from "./useYouTubePlayer";

export function NowPlaying({
  trackKey,
  song,
  artwork,
  clock,
  duration,
  onSeek,
  videoMode,
  mediaRef,
  compact = false,
  artistHref,
  onSwipe,
}: {
  trackKey: string;
  song: SongInfo | null;
  artwork: string | null;
  clock: PlayerClock;
  duration: number;
  onSeek: (t: number) => void;
  videoMode: boolean;
  /** The media box; in video mode the YouTube iframe is positioned over it. */
  mediaRef: React.Ref<HTMLDivElement>;
  /** Phones in lyrics view: one row of small cover, title and artist above the lyrics. */
  compact?: boolean;
  artistHref: string | null;
  /** Touch: swipe the cover left/right for next/previous, down to leave. */
  onSwipe?: (dir: "left" | "right" | "down") => void;
}) {
  const c = (cls: string) => (compact ? cls : "");
  return (
    <motion.div
      layout
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className={`flex w-full flex-col max-md:items-center ${
        videoMode
          ? "max-w-[min(64vh,36vw)] max-md:max-w-[min(90vw,60vh)]"
          : "max-w-[min(42vh,30vw)] max-md:max-w-[min(82vw,46vh)]"
      } ${c("max-md:!max-w-none max-md:flex-row max-md:gap-3.5")}`}
    >
      <motion.div
        layout
        ref={mediaRef}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className={`relative w-full overflow-hidden rounded-[clamp(10px,1vw,20px)] bg-black/30 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.7)] ${
          videoMode ? "aspect-video" : "aspect-square"
        } ${c("max-md:!size-14 max-md:shrink-0 max-md:!rounded-lg")} ${onSwipe && !compact ? "touch-none" : ""}`}
        drag={!!onSwipe && !compact}
        dragSnapToOrigin
        dragElastic={0.35}
        dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
        onDragEnd={(_, { offset: o, velocity: v }) => {
          if (!onSwipe) return;
          if (Math.abs(o.x) > Math.abs(o.y) && (Math.abs(o.x) > 80 || Math.abs(v.x) > 500)) onSwipe(o.x < 0 ? "left" : "right");
          else if (o.y > 100 || v.y > 600) onSwipe("down");
        }}
      >
        <AnimatePresence>
          {artwork && (
            <motion.div
              key={artwork}
              className="absolute inset-0"
              initial={{ opacity: 0, scale: 1.04 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            >
              <CoverImage src={artwork} alt={song ? `${song.title} cover` : ""} className="h-full w-full object-cover" />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      <AnimatePresence mode="wait">
        <motion.div
          key={trackKey}
          className={`mt-[clamp(1rem,3vh,2.25rem)] w-full max-md:text-center ${c("max-md:!mt-0 max-md:min-w-0 max-md:flex-1 max-md:!text-left")}`}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        >
          <h1 className={`line-clamp-2 text-[clamp(1.4rem,2.4vw,2.75rem)] font-bold leading-tight tracking-tight text-white ${c("max-md:!line-clamp-1 max-md:!text-lg")}`}>
            {song?.title ?? " "}
          </h1>
          <p className={`mt-1 truncate text-[clamp(1rem,1.5vw,1.6rem)] font-medium text-white/60 ${c("max-md:!mt-0 max-md:!text-sm")}`}>
            {song?.artist && artistHref ? (
              <Link
                href={artistHref}
                className="cursor-show transition hover:text-white"
              >
                {song.artist}
              </Link>
            ) : (
              " "
            )}
          </p>
        </motion.div>
      </AnimatePresence>

      <div className={`mt-[clamp(0.75rem,2.5vh,1.75rem)] w-full ${c("max-md:hidden")}`}>
        <ProgressBar clock={clock} duration={duration} onSeek={onSeek} />
      </div>
    </motion.div>
  );
}
