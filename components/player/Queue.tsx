"use client";

import { motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { cleanTitle, type SongInfo } from "@/lib/clean-title";
import { fetchVideoInfo } from "./useTrackMeta";

export function Queue({
  ids,
  current,
  onPick,
  onClose,
}: {
  ids: string[];
  current: number;
  onPick: (i: number) => void;
  onClose: () => void;
}) {
  const listRef = useRef<HTMLOListElement>(null);

  // Open scrolled to the playing track.
  useEffect(() => {
    const el = listRef.current?.children[current] as HTMLElement | undefined;
    el?.scrollIntoView({ block: "center" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <motion.div
      className="fixed inset-0 z-30"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.35, delay: 0.1 } }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <motion.aside
        className="cursor-show absolute inset-y-0 right-0 flex w-[min(28rem,92vw)] flex-col bg-black/45 shadow-[-40px_0_120px_-20px_rgba(0,0,0,0.6)] ring-1 ring-white/10 backdrop-blur-2xl"
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "spring", stiffness: 260, damping: 32 }}
      >
        <div className="flex items-baseline justify-between px-7 pb-4 pt-7">
          <h2 className="text-2xl font-bold tracking-tight">Up next</h2>
          <span className="text-sm font-medium tabular-nums text-white/45">
            {current + 1} / {ids.length}
          </span>
        </div>
        <ol ref={listRef} className="no-scrollbar flex-1 overflow-y-auto px-3 pb-6">
          {ids.map((id, i) => (
            <motion.li
              key={`${id}:${i}`}
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.08 + Math.min(Math.abs(i - current), 12) * 0.025, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            >
              <QueueRow id={id} index={i} active={i === current} past={i < current} onPick={onPick} />
            </motion.li>
          ))}
        </ol>
      </motion.aside>
    </motion.div>
  );
}

function QueueRow({
  id,
  index,
  active,
  past,
  onPick,
}: {
  id: string;
  index: number;
  active: boolean;
  past: boolean;
  onPick: (i: number) => void;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  const [song, setSong] = useState<SongInfo | null>(null);
  const [unavailable, setUnavailable] = useState(false);

  // Fetch titles lazily as rows scroll into view; long playlists would otherwise fire hundreds of requests.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let alive = true;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        io.disconnect();
        fetchVideoInfo(id)
          .then((v) => alive && setSong(cleanTitle(v.title, v.channel)))
          .catch(() => alive && setUnavailable(true));
      },
      { rootMargin: "300px 0px" },
    );
    io.observe(el);
    return () => {
      alive = false;
      io.disconnect();
    };
  }, [id]);

  return (
    <button
      ref={ref}
      onClick={() => onPick(index)}
      className={`group flex w-full items-center gap-4 rounded-2xl px-3 py-2.5 text-left transition-colors hover:bg-white/10 ${
        active ? "bg-white/15" : ""
      } ${past && !active ? "opacity-50" : ""}`}
    >
      <div className="relative size-14 shrink-0 overflow-hidden rounded-lg bg-white/5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`https://i.ytimg.com/vi/${id}/mqdefault.jpg`} alt="" loading="lazy" className="h-full w-full object-cover" />
        {active && (
          <div className="absolute inset-0 flex items-end justify-center gap-[3px] bg-black/45 pb-3">
            {[0, 1, 2].map((b) => (
              <span
                key={b}
                className="animate-eq block w-[3px] rounded-full bg-white"
                style={{ animationDelay: `${b * 0.18}s` }}
              />
            ))}
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className={`truncate font-semibold ${unavailable ? "text-white/35" : "text-white"}`}>
          {unavailable ? "Unavailable video" : (song?.title ?? " ")}
        </p>
        <p className="truncate text-sm text-white/50">{song?.artist || " "}</p>
      </div>
      <span className="w-6 shrink-0 text-right text-sm tabular-nums text-white/30">{index + 1}</span>
    </button>
  );
}
