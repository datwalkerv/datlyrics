"use client";

import { motion } from "motion/react";
import { useEffect, useRef } from "react";
import { isPlayerLoaded, playHere, playNext } from "@/components/player/remote";
import {
  SAVED_LIST_ID,
  isPinned,
  removeItem,
  resolveSaved,
  saveItem,
  savedSongIds,
  savedTarget,
  useSaved,
  type SavedItem,
} from "@/lib/saved";

export type CardMenuState = { x: number; y: number; item: SavedItem };

const WIDTH = 224;
const HEIGHT = 96;

/** Right-click on a card: open from where it was clicked (or the card, from the keyboard). */
export function menuAt(e: React.MouseEvent, item: SavedItem): CardMenuState {
  e.preventDefault();
  // The context-menu key / Shift+F10 fire at 0,0: open by the focused card instead.
  const fromKeyboard = e.clientX === 0 && e.clientY === 0;
  const box = (e.currentTarget as HTMLElement).getBoundingClientRect();
  return { x: fromKeyboard ? box.left + 12 : e.clientX, y: fromKeyboard ? box.top + 12 : e.clientY, item };
}

/** Queue a song, or every track of a list, after what's playing; with nothing playing, start it. */
async function queueNext(item: SavedItem) {
  if (item.kind === "song") {
    if (!playNext([item.id])) playHere({ videoId: item.id });
    return;
  }
  if (!isPlayerLoaded()) return playHere(savedTarget(item));
  const ids =
    item.id === SAVED_LIST_ID
      ? savedSongIds()
      : await fetch(`/api/playlist/${item.id}/tracks`)
          .then((res) => (res.ok ? (res.json() as Promise<{ ids: string[] }>) : { ids: [] }))
          .then((d) => d.ids)
          .catch(() => []);
  playNext(ids);
}

/** Play next and save/unsave for a card's song or list, at the pointer, kept inside the window. */
export function CardMenu({ menu, onClose }: { menu: CardMenuState; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const { item } = menu;
  const saved = useSaved().some((x) => x.kind === item.kind && x.id === item.id);
  // The pinned demo and the Saved songs list are always on the shelf: nothing to save or remove.
  const canSave = !isPinned(item.kind, item.id) && item.id !== SAVED_LIST_ID;
  const isSong = item.kind === "song";

  useEffect(() => {
    ref.current?.querySelector<HTMLElement>("[role=menuitem]")?.focus();
    const onDown = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && onClose();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === "Tab") return onClose();
      if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
      e.preventDefault();
      const items = [...(ref.current?.querySelectorAll<HTMLElement>("[role=menuitem]") ?? [])];
      const i = items.indexOf(document.activeElement as HTMLElement);
      items[(i + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length]?.focus();
    };
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onClose, true);
    window.addEventListener("resize", onClose);
    window.addEventListener("blur", onClose);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onClose, true);
      window.removeEventListener("resize", onClose);
      window.removeEventListener("blur", onClose);
    };
  }, [onClose]);

  const act = (fn: () => void) => () => {
    fn();
    onClose();
  };

  const toggleSave = () => {
    if (saved) return removeItem(item.kind, item.id);
    if (isSong) return saveItem({ kind: "song", id: item.id, title: item.title, subtitle: item.subtitle, image: item.image });
    // Cards can show "Artist · year" as subtitles: save the list's own details.
    resolveSaved({ listId: item.id })
      .then(saveItem)
      .catch(() => {});
  };

  return (
    <motion.div
      ref={ref}
      role="menu"
      aria-label={item.title}
      style={{
        left: Math.min(menu.x, window.innerWidth - WIDTH - 8),
        top: Math.min(menu.y, window.innerHeight - HEIGHT - 8),
        width: WIDTH,
      }}
      className="fixed z-50 origin-top-left overflow-hidden rounded-2xl bg-neutral-900/80 p-1.5 text-sm text-white shadow-[0_24px_60px_-12px_rgba(0,0,0,0.8)] ring-1 ring-white/10 backdrop-blur-2xl"
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.1 } }}
      transition={{ duration: 0.14, ease: [0.22, 1, 0.36, 1] }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <Item onClick={act(() => void queueNext(item))} icon={<QueueIcon />}>
        Play next
      </Item>
      {canSave && (
        <Item onClick={act(toggleSave)} icon={<HeartIcon filled={saved} />}>
          {saved ? (isSong ? "Remove from Saved" : "Remove from your playlists") : isSong ? "Save" : "Save to your playlists"}
        </Item>
      )}
    </motion.div>
  );
}

export const QueueIcon = () => <path d="M4 6h11M4 12h11M4 18h7M17 15l4 3-4 3z" />;
export const HeartIcon = ({ filled }: { filled: boolean }) => (
  <path
    d="M12 20.5s-7.5-4.6-7.5-10.1A4.4 4.4 0 0 1 12 7.6a4.4 4.4 0 0 1 7.5 2.8c0 5.5-7.5 10.1-7.5 10.1Z"
    fill={filled ? "currentColor" : "none"}
  />
);

function Item({ onClick, icon, children }: { onClick: () => void; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <button
      role="menuitem"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left font-medium text-white/85 outline-none transition hover:bg-white/10 hover:text-white focus-visible:bg-white/10 focus-visible:text-white"
    >
      <svg viewBox="0 0 24 24" className="size-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        {icon}
      </svg>
      {children}
    </button>
  );
}
