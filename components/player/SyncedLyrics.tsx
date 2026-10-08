"use client";

import { motion } from "motion/react";
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { activeLineIndex, isInstrumentalLine, type LyricLine } from "@/lib/lrc";
import { useClock, type PlayerClock } from "./useYouTubePlayer";

// Highlight slightly early so the line is settled by the time it's sung.
const LEAD = 0.25;
const MIN_INTRO_GAP = 4;

type Line = LyricLine & { interlude: boolean; end: number };

function prepare(lines: LyricLine[], duration: number): Line[] {
  const out: Line[] = [];
  if (lines.length && lines[0].time > MIN_INTRO_GAP) out.push({ time: 0, text: "", interlude: true, end: lines[0].time });
  lines.forEach((l, i) => {
    const end = lines[i + 1]?.time ?? Math.max(duration, l.time + 5);
    out.push({ ...l, interlude: isInstrumentalLine(l.text), end });
  });
  // Drop interludes too short to be worth showing dots for.
  return out.filter((l) => !l.interlude || l.end - l.time >= 2.5);
}

export function SyncedLyrics({
  lines: rawLines,
  clock,
  duration,
  offset,
  onSeek,
}: {
  lines: LyricLine[];
  clock: PlayerClock;
  duration: number;
  offset: number;
  onSeek: (t: number) => void;
}) {
  const lines = useMemo(() => prepare(rawLines, duration), [rawLines, duration]);
  const active = useClock(clock, (t) => activeLineIndex(lines, t + LEAD + offset));

  const viewportRef = useRef<HTMLDivElement>(null);
  const lineRefs = useRef<(HTMLElement | null)[]>([]);
  const [y, setY] = useState(0);
  const [resizeTick, setResizeTick] = useState(0);

  useLayoutEffect(() => {
    const vp = viewportRef.current;
    if (!vp) return;
    const ro = new ResizeObserver(() => setResizeTick((n) => n + 1));
    ro.observe(vp);
    return () => ro.disconnect();
  }, []);

  // Keep the active line anchored ~38% down the viewport.
  useLayoutEffect(() => {
    const vp = viewportRef.current;
    if (!vp) return;
    const el = lineRefs.current[Math.max(active, 0)];
    if (!el) return;
    const anchor = vp.clientHeight * 0.38;
    setY(anchor - (el.offsetTop + el.offsetHeight / 2));
  }, [active, lines, resizeTick]);

  return (
    <div
      ref={viewportRef}
      // Bleed 1rem to the left so blur and breathing dots aren't clipped at the edge.
      className="lyrics-mask relative -ml-4 h-full w-[calc(100%+1rem)] overflow-hidden"
      aria-live="polite"
    >
      <motion.div
        className="absolute inset-x-0 top-0 flex flex-col gap-[clamp(0.9rem,2.6vh,2rem)] pl-4 pr-[4vw]"
        animate={{ y }}
        initial={false}
        transition={{ type: "spring", stiffness: 70, damping: 18, mass: 0.9 }}
      >
        {lines.map((line, i) => {
          const d = i - active;
          const isActive = d === 0;
          const blur = isActive ? 0 : Math.min(Math.abs(d), 4) * 0.6;
          const opacity = isActive ? 1 : d < 0 ? 0.32 : Math.max(0.5 - (d - 1) * 0.06, 0.28);
          return (
            <div
              key={i}
              ref={(el) => {
                lineRefs.current[i] = el;
              }}
              onClick={() => onSeek(Math.max(line.time - offset, 0))}
              data-clickable
              className="origin-left cursor-pointer transition-[opacity,filter,transform] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] hover:!opacity-80"
              style={{
                opacity,
                filter: blur ? `blur(${blur}px)` : undefined,
                transform: isActive ? "scale(1)" : "scale(0.94)",
              }}
            >
              {line.interlude ? (
                <Interlude line={line} clock={clock} active={isActive} offset={offset} />
              ) : (
                <p className="text-balance text-[clamp(1.75rem,3.6vw,4.25rem)] font-bold leading-[1.18] tracking-tight text-white">
                  {line.text}
                </p>
              )}
            </div>
          );
        })}
        {/* Room so the last line can still reach the anchor. */}
        <div className="h-[60vh] shrink-0" />
      </motion.div>
    </div>
  );
}

function Interlude({ line, clock, active, offset }: { line: Line; clock: PlayerClock; active: boolean; offset: number }) {
  return (
    <div className="flex h-[clamp(2rem,4.2vw,5rem)] items-center gap-[clamp(0.5rem,0.9vw,1rem)]">
      {active ? <ActiveDots line={line} clock={clock} offset={offset} /> : <Dots fill={[0, 0, 0]} breathe={false} />}
    </div>
  );
}

function ActiveDots({ line, clock, offset }: { line: Line; clock: PlayerClock; offset: number }) {
  // Quantised so we re-render ~30 steps across the gap, not every frame.
  const step = useClock(clock, (t) => {
    const p = (t + LEAD + offset - line.time) / Math.max(line.end - line.time, 0.1);
    return Math.round(Math.min(Math.max(p, 0), 1) * 30);
  });
  const p = step / 30;
  return <Dots fill={[0, 1, 2].map((i) => Math.min(Math.max(p * 3 - i, 0), 1))} breathe />;
}

function Dots({ fill, breathe }: { fill: number[]; breathe: boolean }) {
  return (
    <div className={`flex origin-left items-center gap-[clamp(0.5rem,0.9vw,1rem)] ${breathe ? "animate-breathe" : ""}`}>
      {fill.map((f, i) => (
        <span
          key={i}
          className="block size-[clamp(0.7rem,1.3vw,1.5rem)] rounded-full bg-white transition-opacity duration-300"
          style={{ opacity: 0.3 + f * 0.7 }}
        />
      ))}
    </div>
  );
}
