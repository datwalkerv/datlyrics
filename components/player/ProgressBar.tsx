"use client";

import { useEffect, useRef, useState } from "react";
import { formatTime } from "@/lib/format";
import { useClock, type PlayerClock } from "./useYouTubePlayer";

export function ProgressBar({
  clock,
  duration,
  onSeek,
}: {
  clock: PlayerClock;
  duration: number;
  onSeek: (t: number) => void;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const fillRef = useRef<HTMLDivElement>(null);
  const knobRef = useRef<HTMLDivElement>(null);
  // While dragging, the bar follows the pointer instead of playback.
  const [drag, setDrag] = useState<number | null>(null);
  const dragRef = useRef<number | null>(null);
  const seconds = useClock(clock, (t) => Math.floor(t));

  // Position is driven straight from the rAF clock to stay smooth without re-rendering every frame.
  useEffect(
    () =>
      clock.subscribe(() => {
        const p = dragRef.current ?? (duration > 0 ? Math.min(clock.getTime() / duration, 1) : 0);
        if (fillRef.current) fillRef.current.style.width = `${p * 100}%`;
        if (knobRef.current) knobRef.current.style.left = `${p * 100}%`;
      }),
    [clock, duration],
  );

  const ratioAt = (clientX: number) => {
    const r = trackRef.current!.getBoundingClientRect();
    return Math.min(Math.max((clientX - r.left) / r.width, 0), 1);
  };
  const setDragValue = (v: number | null) => {
    dragRef.current = v;
    setDrag(v);
  };

  const disabled = duration <= 0;

  return (
    <div className="w-full">
      <div
        ref={trackRef}
        role="slider"
        aria-label="Seek"
        aria-valuemin={0}
        aria-valuemax={Math.round(duration)}
        aria-valuenow={seconds}
        tabIndex={-1}
        className={`cursor-show group relative -my-2 py-2 ${disabled ? "" : "cursor-pointer"} touch-none`}
        onPointerDown={(e) => {
          if (disabled) return;
          e.currentTarget.setPointerCapture(e.pointerId);
          setDragValue(ratioAt(e.clientX));
        }}
        onPointerMove={(e) => {
          if (dragRef.current !== null) setDragValue(ratioAt(e.clientX));
        }}
        onPointerUp={(e) => {
          if (dragRef.current === null) return;
          onSeek(ratioAt(e.clientX) * duration);
          setDragValue(null);
        }}
        onPointerCancel={() => setDragValue(null)}
      >
        <div
          className={`relative w-full overflow-hidden rounded-full bg-white/20 transition-[height] duration-200 ${
            drag !== null ? "h-[6px]" : "h-[4px] group-hover:h-[6px]"
          }`}
        >
          <div ref={fillRef} className="absolute inset-y-0 left-0 w-0 rounded-full bg-white" />
        </div>
        <div
          ref={knobRef}
          className={`pointer-events-none absolute top-1/2 left-0 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-md transition-opacity duration-200 ${
            drag !== null ? "opacity-100" : "opacity-0 group-hover:opacity-100"
          }`}
        />
      </div>
      <div className="mt-2 flex justify-between text-sm font-medium tabular-nums text-white/55">
        <span>{formatTime(drag !== null ? drag * duration : seconds)}</span>
        <span>{formatTime(duration)}</span>
      </div>
    </div>
  );
}
