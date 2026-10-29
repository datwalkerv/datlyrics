"use client";

import { motion } from "motion/react";
import Link from "next/link";
import type { SongInfo } from "@/lib/clean-title";
import { CoverImage } from "./CoverImage";

/** What's still playing while you browse home or an artist page, with a way back to the lyrics. */
export function MiniPlayer({
  song,
  artwork,
  playing,
  onToggle,
  href,
}: {
  song: SongInfo | null;
  artwork: string | null;
  playing: boolean;
  onToggle: () => void;
  href: string;
}) {
  return (
    <motion.div
      className="fixed inset-x-4 bottom-4 z-40 mx-auto flex max-w-xl items-center gap-3 rounded-2xl bg-neutral-900/85 p-2 pr-3 text-white shadow-2xl shadow-black/60 ring-1 ring-white/10 backdrop-blur-2xl"
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 260, damping: 30 }}
    >
      <div className="size-12 shrink-0 overflow-hidden rounded-xl bg-white/5">
        {artwork && <CoverImage src={artwork} className="h-full w-full object-cover" />}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{song?.title ?? " "}</p>
        <p className="truncate text-xs text-white/50">{song?.artist || " "}</p>
      </div>
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
      <Link
        href={href}
        className="flex shrink-0 items-center gap-1.5 rounded-full bg-white px-4 py-2 text-sm font-semibold text-neutral-950 transition hover:bg-white/90"
      >
        <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden>
          <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span className="max-sm:hidden">Back to lyrics</span>
        <span className="sm:hidden">Lyrics</span>
      </Link>
    </motion.div>
  );
}
