"use client";

import { AnimatePresence, motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { parseYouTubeUrl } from "@/lib/parse-youtube-url";
import {
  SAVED_LIMIT,
  refreshPlaylistCover,
  removeItem,
  resolveSaved,
  saveItem,
  savedHref,
  useSaved,
  type SavedItem,
} from "@/lib/saved";

/** Saved songs and playlists (kept in localStorage) as one-click cards. */
export function SavedShelf() {
  const items = useSaved();
  const router = useRouter();

  // Playlists saved before covers were fetched show their first video instead; upgrade them once.
  useEffect(() => {
    for (const item of items) {
      if (item.kind === "playlist" && !item.image?.includes("/pl_c/")) refreshPlaylistCover(item.id);
    }
  }, [items]);

  return (
    <section className="mt-12 w-full max-w-3xl" aria-label="Saved songs and playlists">
      <div className="flex flex-wrap justify-center gap-4">
        <AnimatePresence initial={false}>
          {items.map((item) => (
            <motion.div
              key={`${item.kind}:${item.id}`}
              layout
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.25 }}
            >
              <SavedCard item={item} onPlay={() => router.push(savedHref(item))} />
            </motion.div>
          ))}
        </AnimatePresence>
        <AddCard />
      </div>
    </section>
  );
}

function SavedCard({ item, onPlay }: { item: SavedItem; onPlay: () => void }) {
  return (
    <div className="group relative w-28 text-left">
      <button onClick={onPlay} className="block w-full text-left" title={`Play ${item.title}`}>
        <div className="relative aspect-square w-full overflow-hidden rounded-2xl bg-white/5 ring-1 ring-white/10 transition group-hover:ring-white/30">
          {item.image && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={item.image}
              alt=""
              loading="lazy"
              className="h-full w-full object-cover"
              onError={() => item.kind === "playlist" && refreshPlaylistCover(item.id)}
            />
          )}
          <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition group-hover:opacity-100">
            <svg viewBox="0 0 24 24" className="ml-0.5 size-8 text-white" fill="currentColor" aria-hidden>
              <path d="M8 5.5v13a1 1 0 0 0 1.5.86l11-6.5a1 1 0 0 0 0-1.72l-11-6.5A1 1 0 0 0 8 5.5Z" />
            </svg>
          </div>
          {item.kind === "playlist" && (
            <span className="absolute bottom-1.5 left-1.5 rounded-md bg-black/60 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white/80 backdrop-blur">
              Playlist
            </span>
          )}
        </div>
        <p className="mt-2 truncate text-sm font-semibold text-white/90">{item.title}</p>
        <p className="truncate text-xs text-white/45">{item.subtitle}</p>
      </button>
      <button
        onClick={() => removeItem(item.kind, item.id)}
        aria-label={`Remove ${item.title}`}
        className="absolute -right-2 -top-2 flex size-6 items-center justify-center rounded-full bg-neutral-800 text-white/70 opacity-0 ring-1 ring-white/15 transition hover:text-white group-hover:opacity-100 focus-visible:opacity-100"
      >
        <svg viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
          <path d="M6 6l12 12M18 6 6 18" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  );
}

function AddCard() {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [state, setState] = useState<"idle" | "saving" | "error" | "full">("idle");

  const close = () => {
    setOpen(false);
    setValue("");
    setState("idle");
  };

  const submit = async () => {
    const target = parseYouTubeUrl(value);
    if (!target) return setState("error");
    setState("saving");
    try {
      if (!saveItem(await resolveSaved(target))) return setState("full");
      close();
    } catch {
      setState("error");
    }
  };

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="group w-28 text-left" title="Save a song or playlist">
        <div className="flex aspect-square w-full items-center justify-center rounded-2xl border border-dashed border-white/15 text-white/35 transition group-hover:border-white/35 group-hover:text-white/70">
          <svg viewBox="0 0 24 24" className="size-7" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <path d="M12 5v14M5 12h14" strokeLinecap="round" />
          </svg>
        </div>
        <p className="mt-2 text-sm font-semibold text-white/45">Save</p>
        <p className="text-xs text-white/30">song or playlist</p>
      </button>
    );
  }

  return (
    <form
      className="flex w-72 flex-col justify-center gap-2 self-start pt-6"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <input
        autoFocus
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setState("idle");
        }}
        onKeyDown={(e) => e.key === "Escape" && close()}
        onBlur={() => !value && close()}
        placeholder="Paste a song or playlist link"
        aria-label="Song or playlist link to save"
        spellCheck={false}
        autoComplete="off"
        className={`w-full rounded-xl bg-white/[0.06] px-4 py-3 text-sm text-white ring-1 placeholder:text-white/30 focus:outline-none ${
          state === "error" || state === "full" ? "ring-red-400/60" : "ring-white/15 focus:ring-white/35"
        }`}
      />
      <p className="h-4 text-xs text-white/40">
        {state === "saving"
          ? "Saving…"
          : state === "error"
            ? "Couldn't save that link."
            : state === "full"
              ? `You can save up to ${SAVED_LIMIT}. Remove one first.`
              : "Enter to save · Esc to cancel"}
      </p>
    </form>
  );
}
