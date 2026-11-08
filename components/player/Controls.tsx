"use client";

import Link from "next/link";
import { Sheet } from "@/components/Sheet";
import { toggleFullscreen } from "./hooks";

const ICON = "size-[22px]";
const stroke = { fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" } as const;

function Btn({
  label,
  onClick,
  pressed,
  disabled,
  big,
  children,
}: {
  label: string;
  onClick?: () => void;
  pressed?: boolean;
  disabled?: boolean;
  big?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      aria-pressed={pressed}
      disabled={disabled || !onClick}
      className={`relative flex shrink-0 items-center justify-center rounded-full transition active:scale-90 disabled:opacity-25 ${
        big ? "size-[4.5rem] bg-white text-neutral-950 shadow-xl shadow-black/40" : "size-11"
      } ${!big && pressed ? "text-white" : !big ? "text-white/60" : ""}`}
    >
      {children}
      {/* A dot under on/off toggles, like Apple Music's shuffle and repeat. */}
      {pressed !== undefined && !big && (
        <span className={`absolute bottom-0 size-1 rounded-full bg-white transition-opacity ${pressed ? "opacity-100" : "opacity-0"}`} />
      )}
    </button>
  );
}

/**
 * Touch transport: every playback action the desktop has on a key, as buttons. Shown on phones,
 * tablets and narrow windows only; desktop keeps its keyboard-first, chrome-free view.
 */
export function Controls({
  playing,
  onToggle,
  onNext,
  onPrev,
  shuffle,
  onShuffle,
  loop,
  onLoop,
  view,
  onView,
  onQueue,
  onSave,
  videoMode,
  onVideo,
  onMore,
  progress,
}: {
  playing: boolean;
  onToggle: () => void;
  onNext: () => void;
  onPrev: () => void;
  shuffle: boolean;
  /** Missing without a queue, like the R key. */
  onShuffle?: () => void;
  loop: boolean;
  onLoop: () => void;
  view: "lyrics" | "cover";
  /** Missing when there are no lyrics to switch to. */
  onView?: () => void;
  onQueue?: () => void;
  onSave: () => void;
  videoMode: boolean;
  onVideo: () => void;
  onMore: () => void;
  /** The seek bar, when the view above doesn't already show one. */
  progress?: React.ReactNode;
}) {
  return (
    <div className="cursor-show pb-safe relative z-20 hidden shrink-0 flex-col px-6 max-md:flex touch:flex">
      {progress && <div className="mb-2 md:hidden">{progress}</div>}
      <div className="mx-auto flex w-full max-w-md items-center justify-between">
        <Btn label={shuffle ? "Shuffle on" : "Shuffle off"} pressed={shuffle} onClick={onShuffle}>
          <svg viewBox="0 0 24 24" className={ICON} {...stroke}>
            <path d="M16 3h5v5M4 20 21 3M21 16v5h-5M15 15l6 6M4 4l5 5" />
          </svg>
        </Btn>
        <Btn label="Previous" onClick={onPrev}>
          <svg viewBox="0 0 24 24" className="size-8" fill="currentColor" aria-hidden>
            <path d="M6 5h2v14H6zM20 5.9v12.2a1 1 0 0 1-1.5.86L9.6 13.7a2 2 0 0 1 0-3.4l8.9-5.26A1 1 0 0 1 20 5.9Z" />
          </svg>
        </Btn>
        <Btn label={playing ? "Pause" : "Play"} onClick={onToggle} big>
          <svg viewBox="0 0 24 24" className="size-8" fill="currentColor" aria-hidden>
            {playing ? (
              <path d="M7 5h3.2v14H7zM13.8 5H17v14h-3.2z" />
            ) : (
              <path d="M8 5.5v13a1 1 0 0 0 1.5.86l11-6.5a1 1 0 0 0 0-1.72l-11-6.5A1 1 0 0 0 8 5.5Z" />
            )}
          </svg>
        </Btn>
        <Btn label="Next" onClick={onNext}>
          <svg viewBox="0 0 24 24" className="size-8" fill="currentColor" aria-hidden>
            <path d="M18 5h-2v14h2zM4 5.9v12.2a1 1 0 0 0 1.5.86l8.9-5.26a2 2 0 0 0 0-3.4L5.5 5.04A1 1 0 0 0 4 5.9Z" />
          </svg>
        </Btn>
        <Btn label={loop ? "Loop on" : "Loop off"} pressed={loop} onClick={onLoop}>
          <svg viewBox="0 0 24 24" className={ICON} {...stroke}>
            <path d="m17 2 4 4-4 4M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4M21 13v2a3 3 0 0 1-3 3H3" />
          </svg>
        </Btn>
      </div>
      <div className="mx-auto mb-2 mt-1 flex w-full max-w-md items-center justify-between">
        <Btn label={view === "lyrics" ? "Show cover" : "Show lyrics"} pressed={view === "lyrics"} onClick={onView}>
          <svg viewBox="0 0 24 24" className={ICON} {...stroke}>
            <path d="M4 6h16M4 12h10M4 18h13" />
          </svg>
        </Btn>
        <Btn label={videoMode ? "Music video on" : "Music video off"} pressed={videoMode} onClick={onVideo}>
          <svg viewBox="0 0 24 24" className={ICON} {...stroke}>
            <rect x="2.5" y="5" width="15" height="14" rx="2.5" />
            <path d="m17.5 10 4-2.5v9l-4-2.5" />
          </svg>
        </Btn>
        <Btn label="Save to playlist" onClick={onSave}>
          <svg viewBox="0 0 24 24" className={ICON} {...stroke}>
            <circle cx="12" cy="12" r="9" />
            <path d="M12 8v8M8 12h8" />
          </svg>
        </Btn>
        <Btn label="Queue" onClick={onQueue}>
          <svg viewBox="0 0 24 24" className={ICON} {...stroke}>
            <path d="M3 6h13M3 12h13M3 18h8M19 15v6M16 18h6" />
          </svg>
        </Btn>
        <Btn label="More" onClick={onMore}>
          <svg viewBox="0 0 24 24" className={ICON} fill="currentColor" aria-hidden>
            <circle cx="5" cy="12" r="1.9" />
            <circle cx="12" cy="12" r="1.9" />
            <circle cx="19" cy="12" r="1.9" />
          </svg>
        </Btn>
      </div>
    </div>
  );
}

/** The rest of the keyboard-only actions ([ ] offset, E effects, F fullscreen, ⌘K, settings). */
export function MoreSheet({
  onClose,
  offset,
  onOffset,
  effects,
  onEffects,
  onSearch,
  onSettings,
  artistHref,
}: {
  onClose: () => void;
  offset: number;
  onOffset: (delta: number) => void;
  effects: boolean;
  onEffects: () => void;
  onSearch: () => void;
  onSettings: () => void;
  artistHref: string | null;
}) {
  const row = "flex w-full items-center justify-between gap-4 px-6 py-4 text-left text-[17px] font-medium active:bg-white/10";
  const then = (fn: () => void) => () => {
    onClose();
    fn();
  };
  return (
    <Sheet onClose={onClose} label="More">
      <div className="flex flex-col divide-y divide-white/[0.07] pb-3">
        <div className={row}>
          <span>Lyrics timing</span>
          <span className="flex items-center gap-2">
            <button onClick={() => onOffset(-0.25)} aria-label="Lyrics earlier" className="flex size-10 items-center justify-center rounded-full bg-white/10 text-xl active:bg-white/20">
              −
            </button>
            <span className="w-14 text-center text-sm tabular-nums text-white/60">
              {offset > 0 ? "+" : ""}
              {offset.toFixed(2)}s
            </span>
            <button onClick={() => onOffset(0.25)} aria-label="Lyrics later" className="flex size-10 items-center justify-center rounded-full bg-white/10 text-xl active:bg-white/20">
              +
            </button>
          </span>
        </div>
        <button className={row} onClick={onEffects} role="switch" aria-checked={effects}>
          <span>Background effects</span>
          <span className={`relative h-7 w-12 rounded-full transition ${effects ? "bg-white" : "bg-white/20"}`}>
            <span className={`absolute top-0.5 size-6 rounded-full shadow transition-all ${effects ? "left-[1.375rem] bg-neutral-950" : "left-0.5 bg-white"}`} />
          </span>
        </button>
        {artistHref && (
          <Link href={artistHref} className={row} onClick={onClose}>
            Go to artist
          </Link>
        )}
        <button className={row} onClick={then(onSearch)}>
          Search
        </button>
        {typeof document !== "undefined" && document.fullscreenEnabled && (
          <button className={row} onClick={then(toggleFullscreen)}>
            Fullscreen
          </button>
        )}
        <button className={row} onClick={then(onSettings)}>
          Settings
        </button>
      </div>
    </Sheet>
  );
}
