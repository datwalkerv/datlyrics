"use client";

import { AnimatePresence, Reorder, motion, useDragControls } from "motion/react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { fetchVideoInfo } from "@/components/player/useTrackMeta";
import { cleanTitle } from "@/lib/clean-title";
import { parseYouTubeUrl } from "@/lib/parse-youtube-url";
import {
  SAVED_LIMIT,
  addToList,
  createOwnList,
  isEmptyList,
  isOwnList,
  isPinned,
  mergeAdded,
  removeFromList,
  removeItem,
  resolveSaved,
  saveItem,
  setListSongs,
  updateItem,
  usePinned,
  useSaved,
  type SavedItem,
} from "@/lib/saved";

const CREATE_EVENT = "datlyrics:create-playlist";
const PICK_EVENT = "datlyrics:save-picker";
const EDIT_EVENT = "datlyrics:edit-playlist";
const TOAST_EVENT = "datlyrics:toast";

/** A short message above the mini bar, from anywhere. */
export function showToast(text: string) {
  window.dispatchEvent(new CustomEvent(TOAST_EVENT, { detail: text }));
}

/** An empty playlist doesn't start the player: it says so instead. Returns true when it did. */
export function blockEmpty(listId: string) {
  if (!isEmptyList(listId)) return false;
  showToast("This playlist is empty. Add a song first.");
  return true;
}

/** An own playlist without a cover: the Saved card's dark gradient, without the heart. */
export const EMPTY_COVER = "bg-gradient-to-b from-[#191919] to-[#080808]";

/** The song the picker saves; details are looked up when missing. */
export type PickerSong = { id: string; title?: string; subtitle?: string; image?: string | null };

/** Open the create playlist modal from anywhere, optionally starting from a song. */
export function openCreatePlaylist(songId?: string) {
  window.dispatchEvent(new CustomEvent(CREATE_EVENT, { detail: songId }));
}

/** Rename, re-cover and reorder one of your own (not synced) playlists. */
export function openEditPlaylist(listId: string) {
  window.dispatchEvent(new CustomEvent(EDIT_EVENT, { detail: listId }));
}

/** Ask which playlist to save a song to. */
export function openSavePicker(song: PickerSong) {
  window.dispatchEvent(new CustomEvent(PICK_EVENT, { detail: song }));
}

export function PlaylistModals() {
  const [create, setCreate] = useState<{ songId?: string } | null>(null);
  const [pick, setPick] = useState<PickerSong | null>(null);
  const [edit, setEdit] = useState<string | null>(null);
  const [toast, setToast] = useState<{ id: number; text: string } | null>(null);
  const flash = (text: string) => {
    const id = Date.now();
    setToast({ id, text });
    setTimeout(() => setToast((t) => (t?.id === id ? null : t)), 2500);
  };
  const flashRef = useRef(flash);
  useEffect(() => {
    flashRef.current = flash;
  });

  useEffect(() => {
    const onCreate = (e: Event) => {
      setPick(null);
      setCreate({ songId: (e as CustomEvent<string | undefined>).detail });
    };
    const onPick = (e: Event) => setPick((e as CustomEvent<PickerSong>).detail);
    const onEdit = (e: Event) => setEdit((e as CustomEvent<string>).detail);
    const onToast = (e: Event) => flashRef.current((e as CustomEvent<string>).detail);
    window.addEventListener(TOAST_EVENT, onToast);
    window.addEventListener(CREATE_EVENT, onCreate);
    window.addEventListener(PICK_EVENT, onPick);
    window.addEventListener(EDIT_EVENT, onEdit);
    return () => {
      window.removeEventListener(CREATE_EVENT, onCreate);
      window.removeEventListener(PICK_EVENT, onPick);
      window.removeEventListener(EDIT_EVENT, onEdit);
      window.removeEventListener(TOAST_EVENT, onToast);
    };
  }, []);

  return (
    <AnimatePresence>
      {toast && (
        <motion.div
          key={toast.id}
          role="status"
          className="pointer-events-none fixed bottom-24 left-1/2 z-50 max-w-[calc(100vw-2rem)] -translate-x-1/2 truncate rounded-full bg-neutral-900/85 px-4 py-2 text-sm font-semibold text-white/85 shadow-xl ring-1 ring-white/10 backdrop-blur-2xl"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
        >
          {toast.text}
        </motion.div>
      )}
      {create && <CreateModal key="create" songId={create.songId} onClose={() => setCreate(null)} />}
      {pick && (
        <SavePicker
          key={`pick:${pick.id}`}
          song={pick}
          onClose={() => setPick(null)}
          onAdded={(text) => {
            setPick(null);
            flash(text);
          }}
        />
      )}
      {edit && <EditModal key={`edit:${edit}`} listId={edit} onClose={() => setEdit(null)} />}
    </AnimatePresence>
  );
}

/** A centered card over a dimmed page; a click outside it or Esc closes it. */
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    // The player's shortcuts listen on window: keep every key here (Space on a row, S, Esc) away from them.
    const onKey = (e: KeyboardEvent) => {
      e.stopPropagation();
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 px-4 pt-[14vh] backdrop-blur-xl"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <motion.div
        role="dialog"
        aria-modal
        aria-label={title}
        className="w-full max-w-md overflow-hidden rounded-3xl bg-neutral-900/80 p-6 text-white shadow-[0_40px_120px_-20px_rgba(0,0,0,0.8)] ring-1 ring-white/10 backdrop-blur-2xl"
        initial={{ opacity: 0, y: -12, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -8, scale: 0.98 }}
        transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
      >
        <h2 className="mb-5 text-lg font-bold tracking-tight">{title}</h2>
        {children}
      </motion.div>
    </motion.div>
  );
}

const INPUT =
  "w-full rounded-xl bg-white/[0.06] px-4 py-3 text-sm text-white ring-1 ring-white/15 placeholder:text-white/30 focus:outline-none focus:ring-white/35";

/** A new playlist: your own (name, cover, maybe a first song), or a linked YouTube playlist from its link. */
function CreateModal({ songId, onClose }: { songId?: string; onClose: () => void }) {
  const [name, setName] = useState("");
  const [link, setLink] = useState(songId ? `https://youtu.be/${songId}` : "");
  const [cover, setCover] = useState<string | null>(null);
  const [synced, setSynced] = useState(true);
  const [state, setState] = useState<"idle" | "saving" | "error" | "full" | "badfile">("idle");
  const isListLink = !!parseYouTubeUrl(link.trim())?.listId;

  const submit = async () => {
    const target = link.trim() ? parseYouTubeUrl(link.trim()) : null;
    if (link.trim() && !target) return setState("error");
    if (!target && !name.trim()) return setState("error");
    setState("saving");
    try {
      let ok: boolean;
      if (target?.listId) {
        const list = await resolveSaved({ listId: target.listId });
        const title = name.trim() || list.title;
        const image = cover ?? list.image;
        if (synced) ok = saveItem({ ...list, title, image });
        else {
          // Not synced: copy today's tracks into your own playlist, to edit freely.
          const songs = await listTracks(target.listId);
          if (!songs.length) throw new Error("no tracks");
          ok = createOwnList({ title, image, songs });
        }
      } else if (target?.videoId) {
        const song = await resolveSaved({ videoId: target.videoId });
        ok = createOwnList({ title: name.trim() || song.title, image: cover ?? song.image, songs: [song.id] });
      } else {
        ok = createOwnList({ title: name.trim(), image: cover });
      }
      if (!ok) return setState("full");
      onClose();
    } catch {
      setState("error");
    }
  };

  const pickCover = async (file: File | undefined) => {
    if (!file) return;
    try {
      setCover(await squareCover(file));
      setState("idle");
    } catch {
      setState("badfile");
    }
  };

  return (
    <Modal title="Create playlist" onClose={onClose}>
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <div className="flex gap-4">
          <label
            className="group relative flex size-28 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-2xl border border-dashed border-white/15 text-white/35 transition hover:border-white/35 hover:text-white/70 focus-within:ring-2 focus-within:ring-white/35"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              pickCover(e.dataTransfer.files[0]);
            }}
          >
            {cover ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={cover} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="px-2 text-center text-xs font-medium">Upload cover</span>
            )}
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              aria-label="Cover image"
              onChange={(e) => pickCover(e.target.files?.[0])}
            />
          </label>
          <div className="flex min-w-0 flex-1 flex-col gap-3">
            <input
              autoFocus
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setState("idle");
              }}
              placeholder="Playlist name"
              aria-label="Playlist name"
              maxLength={80}
              autoComplete="off"
              className={INPUT}
            />
            <input
              value={link}
              onChange={(e) => {
                setLink(e.target.value);
                setState("idle");
              }}
              placeholder="Song or playlist link (optional)"
              aria-label="Start from a song or playlist link"
              spellCheck={false}
              autoComplete="off"
              className={INPUT}
            />
          </div>
        </div>
        {isListLink && <SyncToggle synced={synced} onChange={setSynced} />}
        <p className="min-h-4 text-xs text-white/40">
          {state === "saving"
            ? "Creating…"
            : state === "error"
              ? link.trim()
                ? "Couldn't use that link."
                : "Give it a name or a link."
              : state === "full"
                ? `You can have up to ${SAVED_LIMIT} playlists. Remove one first.`
                : state === "badfile"
                  ? "Couldn't read that image."
                  : "A song link starts your playlist with it; a playlist link imports that playlist."}
        </p>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full px-4 py-2 text-sm font-semibold text-white/60 transition hover:text-white"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={state === "saving"}
            className="rounded-full bg-white px-5 py-2 text-sm font-semibold text-neutral-950 transition hover:bg-white/85 disabled:opacity-50"
          >
            Create
          </button>
        </div>
      </form>
    </Modal>
  );
}

/** An uploaded image cropped to a 400px square JPEG, small enough for localStorage. */
async function squareCover(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 400;
  canvas.getContext("2d")!.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, 400, 400);
  bitmap.close();
  return canvas.toDataURL("image/jpeg", 0.82);
}

/** A YouTube playlist's track ids, or none if the lookup fails. */
const listTracks = (listId: string): Promise<string[]> =>
  fetch(`/api/playlist/${listId}/tracks`)
    .then((res) => (res.ok ? (res.json() as Promise<{ ids: string[] }>) : { ids: [] }))
    .then((d) => d.ids)
    .catch(() => []);

function SyncToggle({ synced, onChange }: { synced: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={synced}
      onClick={() => onChange(!synced)}
      className="flex items-center gap-3 rounded-xl px-1 text-left"
    >
      <span className={`relative h-6 w-10 shrink-0 rounded-full transition ${synced ? "bg-white" : "bg-white/15"}`}>
        <span
          className={`absolute top-1 size-4 rounded-full transition-all ${synced ? "left-5 bg-neutral-950" : "left-1 bg-white/70"}`}
        />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-white/85">Keep synced with YouTube</span>
        <span className="block text-xs text-white/40">
          {synced
            ? "Follows the playlist's changes; you can add songs and remove the ones you added."
            : "A copy of today's tracks you can rename, reorder and edit freely."}
        </span>
      </span>
    </button>
  );
}

/** Saved first, then your playlists, latest created or changed first. A click adds or removes the song. */
function SavePicker({ song, onClose, onAdded }: { song: PickerSong; onClose: () => void; onAdded: (toast: string) => void }) {
  const saved = useSaved();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const inSaved = saved.some((x) => x.kind === "song" && x.id === song.id);
  const pinned = usePinned();
  // Pinned lists are synced ones too: songs can be added to them.
  const lists = [...pinned, ...saved.filter((x) => x.kind === "playlist" && !isPinned(x.kind, x.id) && x.badge !== "Single")].sort(
    (a, b) => (b.updatedAt ?? b.savedAt) - (a.updatedAt ?? a.savedAt),
  );

  const toggleSaved = async () => {
    if (inSaved) return removeItem("song", song.id);
    setBusy("saved");
    try {
      const item = song.title
        ? { kind: "song" as const, id: song.id, title: song.title, subtitle: song.subtitle ?? "", image: song.image ?? null }
        : await resolveSaved({ videoId: song.id });
      saveItem(item);
      onAdded(`${item.title} added to Saved`);
    } catch {
      setError(true);
      setBusy(null);
    }
  };

  // The toast names the song; look it up when the caller didn't pass it (cached per video).
  const songTitle = async () =>
    song.title ??
    (await fetchVideoInfo(song.id)
      .then((v) => cleanTitle(v.title, v.channel).title)
      .catch(() => "Song"));

  const toggleList = async (list: SavedItem) => {
    if (list.added?.some((a) => a.id === song.id)) return removeFromList(list.id, song.id);
    setBusy(list.id);
    // Own lists keep their order in `added`; a linked list needs its live top track as the neighbour.
    const top = isOwnList(list.id) ? null : ((await listTracks(list.id))[0] ?? null);
    addToList(list, song.id, top);
    onAdded(`${await songTitle()} added to ${list.title}`);
  };

  return (
    <Modal title="Save to playlist" onClose={onClose}>
      <div className="-mx-2 flex max-h-[50vh] flex-col overflow-y-auto">
        <Row title="Saved" subtitle="Your saved songs" image="/saved.svg" checked={inSaved} busy={busy === "saved"} onClick={toggleSaved} />
        {lists.map((list) => (
          <Row
            key={list.id}
            title={list.title}
            subtitle={list.subtitle}
            image={list.image}
            checked={!!list.added?.some((a) => a.id === song.id)}
            busy={busy === list.id}
            onClick={() => toggleList(list)}
          />
        ))}
      </div>
      {error && <p className="mt-3 text-xs text-red-300/80">Couldn&apos;t save this song.</p>}
      <button
        onClick={() => openCreatePlaylist(song.id)}
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-white/[0.06] py-2.5 text-sm font-semibold text-white/80 ring-1 ring-white/10 transition hover:bg-white/10 hover:text-white"
      >
        <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <path d="M12 5v14M5 12h14" strokeLinecap="round" />
        </svg>
        New playlist
      </button>
    </Modal>
  );
}

function Row({
  title,
  subtitle,
  image,
  checked,
  busy,
  onClick,
}: {
  title: string;
  subtitle: string;
  image: string | null;
  checked: boolean;
  busy: boolean;
  onClick: () => void;
}) {
  return (
    <button
      aria-pressed={checked}
      disabled={busy}
      onClick={onClick}
      className="flex items-center gap-3 rounded-xl px-2 py-2 text-left outline-none transition hover:bg-white/10 focus-visible:bg-white/10 disabled:opacity-60"
    >
      <span className="size-11 shrink-0 overflow-hidden rounded-lg bg-white/5 ring-1 ring-white/10">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {image ? <img src={image} alt="" className="h-full w-full object-cover" /> : <span className={`block h-full w-full ${EMPTY_COVER}`} />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-white/90">{title}</span>
        <span className="block truncate text-xs text-white/45">{subtitle}</span>
      </span>
      <span
        aria-hidden
        className={`flex size-5 shrink-0 items-center justify-center rounded-full ring-1 transition ${
          checked ? "bg-white text-neutral-950 ring-white" : "ring-white/25"
        }`}
      >
        {checked && (
          <svg viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="3">
            <path d="m5 12 5 5 9-10" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </span>
    </button>
  );
}

/** One of your own playlists: name, cover and songs (drag or Alt+↑/↓ to reorder, × to remove). Changes save as you make them. */
function EditModal({ listId, onClose }: { listId: string; onClose: () => void }) {
  const list = useSaved().find((x) => x.kind === "playlist" && x.id === listId);
  const [badFile, setBadFile] = useState(false);
  // The list was removed meanwhile (another tab, a backup import).
  useEffect(() => {
    if (!list) onClose();
  }, [list, onClose]);
  if (!list) return null;
  const ids = mergeAdded([], list.added);
  const set = (change: Partial<SavedItem>) => updateItem({ ...list, ...change });
  const move = (id: string, by: number) => {
    const at = ids.indexOf(id);
    const to = at + by;
    if (to < 0 || to >= ids.length) return;
    const next = [...ids];
    [next[at], next[to]] = [next[to], next[at]];
    setListSongs(listId, next);
  };

  return (
    <Modal title="Edit playlist" onClose={onClose}>
      <div className="flex gap-4">
        <label className="group relative size-28 shrink-0 cursor-pointer overflow-hidden rounded-2xl ring-1 ring-white/10 focus-within:ring-2 focus-within:ring-white/35">
          {list.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={list.image} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className={`block h-full w-full ${EMPTY_COVER}`} />
          )}
          <span className="absolute inset-0 flex items-center justify-center bg-black/50 text-xs font-semibold opacity-0 transition group-hover:opacity-100 group-focus-within:opacity-100">
            Change cover
          </span>
          <input
            type="file"
            accept="image/*"
            className="sr-only"
            aria-label="Change cover"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              try {
                set({ image: await squareCover(file) });
                setBadFile(false);
              } catch {
                setBadFile(true);
              }
            }}
          />
        </label>
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <input
            defaultValue={list.title}
            onChange={(e) => e.target.value.trim() && set({ title: e.target.value.trim() })}
            placeholder="Playlist name"
            aria-label="Playlist name"
            maxLength={80}
            autoComplete="off"
            className={INPUT}
          />
          <p className="text-xs text-white/40">
            {badFile ? "Couldn't read that image." : `${ids.length} song${ids.length === 1 ? "" : "s"}`}
          </p>
          {list.image && (
            <button onClick={() => set({ image: null })} className="self-start text-xs font-semibold text-white/50 hover:text-white">
              Remove cover
            </button>
          )}
        </div>
      </div>
      <motion.div layoutScroll className="-mx-2 mt-5 max-h-[40vh] overflow-y-auto">
        {ids.length === 0 ? (
          <p className="px-2 py-6 text-center text-sm text-white/40">No songs yet. Press S while a song plays to add it.</p>
        ) : (
          <Reorder.Group axis="y" values={ids} onReorder={(next) => setListSongs(listId, next)} className="flex flex-col">
            {ids.map((id) => (
              <SongRow key={id} id={id} onMove={(by) => move(id, by)} onRemove={() => removeFromList(listId, id)} />
            ))}
          </Reorder.Group>
        )}
      </motion.div>
      <div className="mt-4 flex justify-end">
        <button
          onClick={onClose}
          className="rounded-full bg-white px-5 py-2 text-sm font-semibold text-neutral-950 transition hover:bg-white/85"
        >
          Done
        </button>
      </div>
    </Modal>
  );
}

function SongRow({ id, onMove, onRemove }: { id: string; onMove: (by: number) => void; onRemove: () => void }) {
  const drag = useDragControls();
  const [info, setInfo] = useState<{ title: string; artist: string } | null>(null);
  // shortcut: each row looks up its own title (cached per video); a long imported list makes many requests at once.
  useEffect(() => {
    let alive = true;
    fetchVideoInfo(id)
      .then((v) => alive && setInfo(cleanTitle(v.title, v.channel)))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [id]);

  return (
    <Reorder.Item
      value={id}
      dragListener={false}
      dragControls={drag}
      className="flex items-center gap-3 rounded-xl bg-neutral-900/0 px-2 py-1.5 hover:bg-white/[0.06]"
    >
      <button
        onPointerDown={(e) => drag.start(e)}
        onKeyDown={(e) => {
          if (!e.altKey || (e.key !== "ArrowUp" && e.key !== "ArrowDown")) return;
          e.preventDefault();
          onMove(e.key === "ArrowUp" ? -1 : 1);
        }}
        aria-label={`Move ${info?.title ?? "song"} (drag, or Alt+Arrow keys)`}
        className="cursor-grab touch-none text-white/30 hover:text-white/70 active:cursor-grabbing"
      >
        <svg viewBox="0 0 24 24" className="size-4" fill="currentColor" aria-hidden>
          <circle cx="9" cy="6" r="1.5" />
          <circle cx="15" cy="6" r="1.5" />
          <circle cx="9" cy="12" r="1.5" />
          <circle cx="15" cy="12" r="1.5" />
          <circle cx="9" cy="18" r="1.5" />
          <circle cx="15" cy="18" r="1.5" />
        </svg>
      </button>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`https://i.ytimg.com/vi/${id}/mqdefault.jpg`} alt="" className="size-10 shrink-0 rounded-md object-cover" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-white/90">{info?.title ?? "…"}</span>
        <span className="block truncate text-xs text-white/45">{info?.artist ?? ""}</span>
      </span>
      <button onClick={onRemove} aria-label={`Remove ${info?.title ?? "song"}`} className="p-1 text-white/35 hover:text-white">
        <svg viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
          <path d="M6 6l12 12M18 6 6 18" strokeLinecap="round" />
        </svg>
      </button>
    </Reorder.Item>
  );
}
