"use client";

import { AnimatePresence, motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { CoverImage } from "@/components/player/CoverImage";
import { parseYouTubeUrl } from "@/lib/parse-youtube-url";
import { playHere } from "@/components/player/remote";
import {
  PINNED,
  SAVED_LIMIT,
  SAVED_LIST_ID,
  isPinned,
  refreshPlaylistCover,
  removeItem,
  resolveSaved,
  saveItem,
  savedHref,
  savedTarget,
  useSaved,
  type SavedItem,
} from "@/lib/saved";

/** Saved songs and playlists (kept in localStorage) as one-click cards: centered on the landing page, left-aligned and larger on /home. */
export function SavedShelf({
  variant = "landing",
  onCardMenu,
}: {
  variant?: "landing" | "home";
  /** Right-click on a card (/home's play next / save menu). */
  onCardMenu?: (e: React.MouseEvent, item: SavedItem) => void;
}) {
  const home = variant === "home";
  const width = home ? "w-36 sm:w-40" : "w-28";
  const pinned = usePinned();
  // A pinned item the user also saved shows once, as the pinned card.
  const saved = useSaved();
  const items = saved.filter((x) => x.kind === "playlist" && !isPinned(x.kind, x.id));
  const songCount = saved.filter((x) => x.kind === "song").length;
  const savedSongs: SavedItem = {
    kind: "playlist",
    id: SAVED_LIST_ID,
    title: "Saved",
    subtitle: `${songCount} song${songCount === 1 ? "" : "s"}`,
    image: "/saved.svg",
    savedAt: 0,
  };
  const router = useRouter();
  // On /home it plays in the mini bar; the landing page opens the lyrics.
  const play = (item: SavedItem) => {
    if (!home) return router.push(savedHref(item));
    playHere(savedTarget(item));
  };
  const menu = (item: SavedItem) => onCardMenu && ((e: React.MouseEvent) => onCardMenu(e, item));

  // Playlists saved before covers were fetched show their first video instead; upgrade them once.
  useEffect(() => {
    for (const item of items) {
      if (!item.image?.includes("/pl_c/") || !item.badge) refreshPlaylistCover(item.id);
    }
  }, [items]);

  return (
    <section className={home ? "w-full" : "mt-12 w-full max-w-3xl"} aria-label="Saved songs and playlists">
      <div className={`flex flex-wrap gap-4 ${home ? "sm:gap-5" : "justify-center"}`}>
        {pinned.map((item) => (
          <SavedCard key={`pinned:${item.kind}:${item.id}`} item={item} className={width} pinned onPlay={() => play(item)} onContextMenu={menu(item)} />
        ))}
        {songCount > 0 && <SavedCard item={savedSongs} className={width} pinned onPlay={() => play(savedSongs)} onContextMenu={menu(savedSongs)} />}
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
              <SavedCard item={item} className={width} onPlay={() => play(item)} onContextMenu={menu(item)} />
            </motion.div>
          ))}
        </AnimatePresence>
        <AddCard className={width} />
      </div>
    </section>
  );
}

/** The pinned items' cards, fetched fresh each visit (titles change, cover URLs expire). */
function usePinned(): SavedItem[] {
  const [items, setItems] = useState<SavedItem[]>([]);
  useEffect(() => {
    let alive = true;
    Promise.all(
      PINNED.map((p) =>
        resolveSaved(p.kind === "playlist" ? { listId: p.id } : { videoId: p.id })
          .then((item) => ({ ...item, savedAt: 0 }))
          .catch(() => null),
      ),
    ).then((list) => alive && setItems(list.filter((x) => x !== null)));
    return () => {
      alive = false;
    };
  }, []);
  return items;
}

export function SavedCard({
  item,
  pinned = false,
  className = "w-28",
  onPlay,
  onContextMenu,
}: {
  item: SavedItem;
  pinned?: boolean;
  className?: string;
  onPlay: () => void;
  onContextMenu?: (e: React.MouseEvent) => void;
}) {
  return (
    <div className={`group relative shrink-0 text-left ${className}`} onContextMenu={onContextMenu}>
      <button onClick={onPlay} className="block w-full text-left" title={`Play ${item.title}`}>
        <div className="relative aspect-square w-full overflow-hidden rounded-2xl bg-white/5 ring-1 ring-white/10 transition group-hover:ring-white/30">
          {item.image && (
            // Same fallbacks as the player's cover: a missing max-res YouTube thumbnail drops to hqdefault.
            <CoverImage
              src={item.image}
              loading="lazy"
              className="h-full w-full object-cover"
              onError={() => item.kind === "playlist" && item.id !== SAVED_LIST_ID && refreshPlaylistCover(item.id)}
            />
          )}
          <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition group-hover:opacity-100">
            <svg viewBox="0 0 24 24" className="size-8 text-white" fill="currentColor" aria-hidden>
              <path d="M8 5.5v13a1 1 0 0 0 1.5.86l11-6.5a1 1 0 0 0 0-1.72l-11-6.5A1 1 0 0 0 8 5.5Z" />
            </svg>
          </div>
          {item.kind === "playlist" && (
            <span className="absolute bottom-1.5 left-1.5 rounded-md bg-black/60 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white/80 backdrop-blur">
              {item.badge ?? "Playlist"}
            </span>
          )}
        </div>
        <p className="mt-2 truncate text-sm font-semibold text-white/90">{item.title}</p>
        <p className="truncate text-xs text-white/45">{item.subtitle}</p>
      </button>
      {!pinned && (
        <button
          onClick={() => removeItem(item.kind, item.id)}
          aria-label={`Remove ${item.title}`}
          className="absolute -right-2 -top-2 flex size-6 items-center justify-center rounded-full bg-neutral-800 text-white/70 opacity-0 ring-1 ring-white/15 transition hover:text-white group-hover:opacity-100 focus-visible:opacity-100"
        >
          <svg viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
            <path d="M6 6l12 12M18 6 6 18" strokeLinecap="round" />
          </svg>
        </button>
      )}
    </div>
  );
}

function AddCard({ className }: { className: string }) {
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
      <button onClick={() => setOpen(true)} className={`group text-left ${className}`} title="Save a song or playlist">
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
