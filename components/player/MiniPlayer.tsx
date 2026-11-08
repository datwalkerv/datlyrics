"use client";

import { motion } from "motion/react";
import Link from "next/link";
import type { SongInfo } from "@/lib/clean-title";
import { CoverImage } from "./CoverImage";
import { useEffect, useRef } from "react";
import { markResume } from "./remote";
import type { PlayerClock } from "./useYouTubePlayer";

/** What's still playing while you browse home or an artist page, with a way back to the lyrics. */
export function MiniPlayer({
  song,
  artwork,
  playing,
  onToggle,
  onNext,
  href,
  clock,
  duration,
}: {
  song: SongInfo | null;
  artwork: string | null;
  playing: boolean;
  onToggle: () => void;
  onNext: () => void;
  href: string;
  clock: PlayerClock;
  duration: number;
}) {
  // A new-tab click doesn't navigate here; there the link starts its song as usual.
  const resume = (e: React.MouseEvent) => {
    if (!e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey && e.button === 0) markResume();
  };
  return (
    <motion.div
      className="fixed inset-x-4 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-40 mx-auto flex max-w-xl items-center gap-3 overflow-hidden rounded-2xl bg-neutral-900/85 p-2 pr-3 text-white shadow-2xl shadow-black/60 ring-1 ring-white/10 backdrop-blur-2xl"
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 260, damping: 30 }}
    >
      {/* The song itself opens the lyrics too: the whole bar is a target on phones. */}
      <Link href={href} onClick={resume} aria-label="Back to lyrics" className="flex min-w-0 flex-1 items-center gap-3">
        <div className="size-12 shrink-0 overflow-hidden rounded-xl bg-white/5">
          {artwork && <CoverImage src={artwork} className="h-full w-full object-cover" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{song?.title ?? " "}</p>
          <p className="truncate text-xs text-white/50">{song?.artist || " "}</p>
        </div>
      </Link>
      <button
        onClick={onToggle}
        aria-label={playing ? "Pause" : "Play"}
        className="flex size-10 shrink-0 items-center justify-center rounded-full text-white/80 transition hover:bg-white/10 hover:text-white"
      >
        <svg viewBox="0 0 24 24" className="size-5" fill="currentColor" aria-hidden>
          {playing ? (
            <path d="M7 5h3v14H7zM14 5h3v14h-3z" />
          ) : (
            <path d="M8 5.5v13a1 1 0 0 0 1.5.86l11-6.5a1 1 0 0 0 0-1.72l-11-6.5A1 1 0 0 0 8 5.5Z" />
          )}
        </svg>
      </button>
      <button
        onClick={onNext}
        aria-label="Next"
        className="-ml-2 flex size-10 shrink-0 items-center justify-center rounded-full text-white/80 transition hover:bg-white/10 hover:text-white"
      >
        <svg viewBox="0 0 24 24" className="size-5" fill="currentColor" aria-hidden>
          <path d="M18 5h-2v14h2zM4 5.9v12.2a1 1 0 0 0 1.5.86l8.9-5.26a2 2 0 0 0 0-3.4L5.5 5.04A1 1 0 0 0 4 5.9Z" />
        </svg>
      </button>
      <Link
        href={href}
        onClick={resume}
        className="flex shrink-0 items-center gap-1.5 max-sm:hidden rounded-full bg-white px-4 py-2 text-sm font-semibold text-neutral-950 transition hover:bg-white/90"
      >
        <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden>
          <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Back to lyrics
      </Link>
      <Progress clock={clock} duration={duration} />
    </motion.div>
  );
}

/** Hairline progress along the bar's bottom edge, moved straight from the clock. */
function Progress({ clock, duration }: { clock: PlayerClock; duration: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(
    () =>
      clock.subscribe(() => {
        if (ref.current) ref.current.style.transform = `scaleX(${duration > 0 ? Math.min(clock.getTime() / duration, 1) : 0})`;
      }),
    [clock, duration],
  );
  return (
    <div className="pointer-events-none absolute inset-x-3 bottom-0 h-[2px] overflow-hidden rounded-full bg-white/10" aria-hidden>
      <div ref={ref} className="h-full origin-left bg-white/70" style={{ transform: "scaleX(0)" }} />
    </div>
  );
}
