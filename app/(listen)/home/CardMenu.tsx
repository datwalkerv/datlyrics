"use client";

import { motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { isPlayerLoaded, playHere, playNext } from "@/components/player/remote";
import { blockEmpty, openEditPlaylist, openSavePicker } from "@/components/PlaylistModals";
import {
  SAVED_LIST_ID,
  isOwnList,
  isPinned,
  listItem,
  mergeAdded,
  ownListIds,
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
const HEIGHT = 140;

/** Right-click on a card: open from where it was clicked (or the card, from the keyboard). */
export function menuAt(e: React.MouseEvent, item: SavedItem): CardMenuState {
  e.preventDefault();
  // The context-menu key / Shift+F10 fire at 0,0: open by the focused card instead.
  const fromKeyboard = e.clientX === 0 && e.clientY === 0;
  const box = (e.currentTarget as HTMLElement).getBoundingClientRect();
  return { x: fromKeyboard ? box.left + 12 : e.clientX, y: fromKeyboard ? box.top + 12 : e.clientY, item };
}

/** A playlist's track ids, or none if the lookup fails. */
const listTracks = (listId: string): Promise<string[]> =>
  fetch(`/api/playlist/${listId}/tracks`)
    .then((res) => (res.ok ? (res.json() as Promise<{ ids: string[] }>) : { ids: [] }))
    .then((d) => d.ids)
    .catch(() => []);

/** Queue a song, or every track of a list, after what's playing; with nothing playing, start it. */
async function queueNext(item: SavedItem) {
  if (item.kind === "song") {
    if (!playNext([item.id])) playHere({ videoId: item.id });
    return;
  }
  if (blockEmpty(item.id)) return;
  if (!isPlayerLoaded()) return playHere(savedTarget(item));
  if (item.id === SAVED_LIST_ID) return playNext(savedSongIds());
  if (isOwnList(item.id)) return playNext(ownListIds(item.id));
  playNext(mergeAdded(await listTracks(item.id), listItem(item.id)?.added));
}

/** Play next and save/unsave for a card's song or list, at the pointer, kept inside the window. */
export function CardMenu({ menu, onClose }: { menu: CardMenuState; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const { item } = menu;
  // A single is saved as its song (to a playlist you pick), not as a one-track playlist card.
  const isSingle = item.kind === "playlist" && item.badge === "Single";
  const [singleSong, setSingleSong] = useState<string | null>(null);
  useEffect(() => {
    if (!isSingle) return;
    let alive = true;
    // shortcut: a single's first track is its title song; B-sides aren't saved.
    listTracks(item.id).then((ids) => alive && setSingleSong(ids[0] ?? null));
    return () => {
      alive = false;
    };
  }, [isSingle, item.id]);
  const saved = useSaved().some((x) => x.kind === item.kind && x.id === item.id);
  // The pinned demo and the Saved songs list are always on the shelf: nothing to save or remove.
  // A single's menu offers saving once its song is known.
  const canSave = !isPinned(item.kind, item.id) && item.id !== SAVED_LIST_ID && (!isSingle || !!singleSong);
  const isSong = item.kind === "song" || isSingle;

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
    if (isSingle) return openSavePicker({ id: singleSong! });
    if (isSong) return openSavePicker({ id: item.id, title: item.title, subtitle: item.subtitle, image: item.image });
    if (saved) return removeItem(item.kind, item.id);
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
        <Item onClick={act(toggleSave)} icon={<HeartIcon filled={!isSong && saved} />}>
          {isSong ? "Save to playlist…" : saved ? "Remove from your playlists" : "Save to your playlists"}
        </Item>
      )}
      {/* Synced lists follow YouTube; only your own ones are edited here. */}
      {isOwnList(item.id) && (
        <Item onClick={act(() => openEditPlaylist(item.id))} icon={<EditIcon />}>
          Edit playlist
        </Item>
      )}
    </motion.div>
  );
}

const EditIcon = () => <path d="M4 20h4L19 9l-4-4L4 16v4ZM13.5 6.5l4 4" />;
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
