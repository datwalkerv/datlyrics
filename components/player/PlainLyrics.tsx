"use client";

import { useEffect, useRef } from "react";
import type { PlayerClock } from "./useYouTubePlayer";

/** Unsynced lyrics: a slow, passive scroll that tracks overall song progress. */
export function PlainLyrics({ text, clock, duration }: { text: string; clock: PlayerClock; duration: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const userScrolledAt = useRef(0);

  // Its own frame loop (the shared clock ticks only ~20×/s): the slow glide should be smooth.
  // Runs only while unsynced lyrics are on screen.
  useEffect(() => {
    let current = -1;
    let raf = 0;
    const step = () => {
      raf = requestAnimationFrame(step);
      const el = ref.current;
      if (!el || duration <= 0) return;
      // Let a manual scroll win for a few seconds before resuming.
      if (performance.now() - userScrolledAt.current < 4000) {
        current = el.scrollTop;
        return;
      }
      const max = el.scrollHeight - el.clientHeight;
      // Hold at the top during the intro and reach the end slightly before the song does.
      const p = Math.min(Math.max((clock.getTime() / duration - 0.06) / 0.86, 0), 1);
      const target = p * max;
      if (current < 0) current = el.scrollTop;
      const next = current + (target - current) * 0.04;
      if (Math.abs(next - current) < 0.05) return; // settled (e.g. paused): nothing to draw
      current = next;
      el.scrollTop = current;
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [clock, duration]);

  return (
    <div
      ref={ref}
      onWheel={() => (userScrolledAt.current = performance.now())}
      onTouchMove={() => (userScrolledAt.current = performance.now())}
      className="lyrics-mask no-scrollbar h-full w-full overflow-y-auto pr-[4vw]"
    >
      <div className="py-[30vh]">
        <p className="mb-6 text-sm font-semibold uppercase tracking-[0.2em] text-white/40">Lyrics · not synced</p>
        {text.split(/\n{2,}/).map((stanza, i) => (
          <p
            key={i}
            className="mb-[1.2em] whitespace-pre-line text-[clamp(1.4rem,2.6vw,3rem)] font-bold leading-[1.3] tracking-tight text-white/80"
          >
            {stanza}
          </p>
        ))}
      </div>
    </div>
  );
}
