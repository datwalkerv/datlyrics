"use client";

import { AnimatePresence, motion } from "motion/react";
import { useRef, useState } from "react";

function SpeakerIcon({ volume, className }: { volume: number; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5H4Z" fill="currentColor" stroke="none" />
      {volume === 0 ? (
        <path d="m16 9.5 5 5m0-5-5 5" strokeLinecap="round" />
      ) : (
        <>
          <path d="M15.5 9.2a4 4 0 0 1 0 5.6" strokeLinecap="round" />
          {volume > 50 && <path d="M18.3 6.5a8 8 0 0 1 0 11" strokeLinecap="round" />}
        </>
      )}
    </svg>
  );
}

/** Slim volume slider for the top bar: click or drag to set, click the speaker to mute. */
export function VolumeSlider({ volume, onChange }: { volume: number; onChange: (v: number) => void }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const beforeMute = useRef(volume || 60);

  const valueAt = (clientX: number) => {
    const r = trackRef.current!.getBoundingClientRect();
    return Math.round(Math.min(Math.max((clientX - r.left) / r.width, 0), 1) * 100);
  };

  return (
    <div className="cursor-show pointer-events-auto flex items-center gap-2 rounded-full bg-white/10 py-0.5 pr-3.5 pl-0.5 text-white/75 ring-1 ring-white/15 backdrop-blur-xl">
      <button
        aria-label={volume === 0 ? "Unmute" : "Mute"}
        onClick={() => {
          if (volume > 0) {
            beforeMute.current = volume;
            onChange(0);
          } else onChange(beforeMute.current);
        }}
        className="flex size-8 items-center justify-center rounded-full transition hover:bg-white/10 hover:text-white"
      >
        <SpeakerIcon volume={volume} className="size-[18px]" />
      </button>
      <div
        ref={trackRef}
        role="slider"
        aria-label="Volume"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={volume}
        tabIndex={-1}
        className="group relative w-24 cursor-pointer touch-none py-2"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          setDragging(true);
          onChange(valueAt(e.clientX));
        }}
        onPointerMove={(e) => dragging && onChange(valueAt(e.clientX))}
        onPointerUp={() => setDragging(false)}
        onPointerCancel={() => setDragging(false)}
      >
        <div
          className={`relative w-full overflow-hidden rounded-full bg-white/20 transition-[height] duration-200 ${
            dragging ? "h-[5px]" : "h-[3px] group-hover:h-[5px]"
          }`}
        >
          <div className="absolute inset-y-0 left-0 rounded-full bg-white" style={{ width: `${volume}%` }} />
        </div>
      </div>
    </div>
  );
}

/** Brief on-screen volume readout for keyboard changes, like a TV's. */
export function VolumeHud({ volume, show }: { volume: number; show: boolean }) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className="pointer-events-none fixed left-1/2 top-8 z-30 flex -translate-x-1/2 items-center gap-3 rounded-full bg-neutral-900/80 px-4 py-2.5 text-white/90 shadow-xl ring-1 ring-white/10"
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
        >
          <SpeakerIcon volume={volume} className="size-[18px]" />
          <div className="h-[4px] w-36 overflow-hidden rounded-full bg-white/20">
            <div className="h-full rounded-full bg-white transition-[width] duration-150" style={{ width: `${volume}%` }} />
          </div>
          <span className="w-9 text-right text-sm font-semibold tabular-nums">{volume}</span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
