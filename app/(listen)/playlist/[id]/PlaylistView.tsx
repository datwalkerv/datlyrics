"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { AnimatePresence } from "motion/react";
import { useEffect, useState, useSyncExternalStore } from "react";
import { CardMenu, menuAt, type CardMenuState } from "@/app/(listen)/home/CardMenu";
import { EMPTY_COVER, blockEmpty } from "@/components/PlaylistModals";
import { CoverImage } from "@/components/player/CoverImage";
import { longPress } from "@/components/player/hooks";
import { playHere } from "@/components/player/remote";
import { fetchVideoInfo } from "@/components/player/useTrackMeta";
import { ArtistLink } from "@/components/ArtistLink";
import { cleanTitle } from "@/lib/clean-title";
import { SAVED_LIST_ID, isLocalList, mergeAdded, removeFromList, removeItem, useSaved } from "@/lib/saved";

type Header = { title: string; subtitle: string; image: string | null; badge?: string };

/** A playlist's songs. Your own lists and Saved come from localStorage; YouTube lists from the API, after the songs you added. */
export function PlaylistView() {
  const { id } = useParams<{ id: string }>();
  const saved = useSaved();
  const item = saved.find((x) => x.kind === "playlist" && x.id === id);
  const local = isLocalList(id);
  const [remote, setRemote] = useState<{ header: Header | null; ids: string[] | null; durations: Record<string, string>; failed: boolean }>({
    header: null,
    ids: null,
    durations: {},
    failed: false,
  });

  useEffect(() => {
    if (local || !/^[A-Za-z0-9_-]{10,64}$/.test(id)) return;
    let alive = true;
    const json = (url: string) => fetch(url).then((r) => (r.ok ? r.json() : Promise.reject(new Error(url))));
    Promise.all([
      json(`/api/playlist/${id}`).catch(() => null) as Promise<{ title: string; channel: string; thumbnail: string | null; kind: string | null } | null>,
      json(`/api/playlist/${id}/tracks`).catch(() => null) as Promise<{ ids: string[]; durations?: Record<string, string> } | null>,
    ]).then(([info, tracks]) => {
      if (!alive) return;
      setRemote({
        header: info && { title: info.title, subtitle: info.channel, image: info.thumbnail, badge: info.kind ?? undefined },
        ids: tracks?.ids ?? null,
        durations: tracks?.durations ?? {},
        failed: !info && !tracks,
      });
    });
    return () => {
      alive = false;
    };
  }, [id, local]);

  const savedSongs = saved.filter((x) => x.kind === "song").map((x) => x.id).reverse();
  const ids =
    id === SAVED_LIST_ID ? savedSongs : local ? mergeAdded([], item?.added) : remote.ids && mergeAdded(remote.ids, item?.added);
  const header: Header | null =
    id === SAVED_LIST_ID
      ? { title: "Saved", subtitle: "Your saved songs", image: "/saved.svg" }
      : (item ?? remote.header);
  // localStorage is only read after hydration; until then an own list would look missing.
  const hydrated = useSyncExternalStore(noop, () => true, () => false);
  const missing = (hydrated && local && id !== SAVED_LIST_ID && !item) || remote.failed;

  const [menu, setMenu] = useState<CardMenuState | null>(null);
  // Songs you put here (every song of a local list, the added ones of a synced list) can be removed; the synced tracks can't.
  const addedIds = new Set(local ? ids : item?.added?.map((a) => a.id));
  const remove = (songId: string) => (id === SAVED_LIST_ID ? removeItem("song", songId) : removeFromList(id, songId));

  const play = (videoId?: string) => {
    if (blockEmpty(id)) return;
    playHere({ listId: id, videoId });
  };

  return (
    <main className="relative min-h-dvh overflow-x-hidden bg-neutral-950 pb-[calc(9rem+env(safe-area-inset-bottom))] text-white">
      <div className="pt-safe mx-auto max-w-6xl px-5">
        <Link href="/home" className="inline-block py-6 text-xl font-extrabold tracking-[-0.04em] text-white/80 hover:text-white sm:py-7">
          datlyrics
        </Link>

        {missing ? (
          <p className="mt-16 text-white/50">This playlist isn&apos;t available.</p>
        ) : (
          <>
            <header className="flex flex-col gap-6 pb-10 sm:flex-row sm:items-end">
              <div className="relative size-48 shrink-0 overflow-hidden rounded-2xl bg-white/5 ring-1 ring-white/10 sm:size-56">
                {header?.image ? <CoverImage src={header.image} className="h-full w-full object-cover" /> : <div className={`h-full w-full ${EMPTY_COVER}`} />}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/45">{header?.badge ?? "Playlist"}</p>
                <h1 className="mt-2 text-[clamp(2rem,6vw,4.5rem)] font-extrabold leading-none tracking-[-0.05em]">
                  {header?.title ?? <span className="inline-block h-[0.9em] w-64 animate-pulse rounded-xl bg-white/[0.06]" />}
                </h1>
                <p className="mt-3 text-white/50">
                  {/* An album's subtitle is its artist; a playlist's is its owner or "Your playlist". */}
                  {header?.subtitle && header.badge && header.badge !== "Playlist" ? <ArtistLink name={header.subtitle} /> : header?.subtitle}
                  {ids && ` · ${ids.length} song${ids.length === 1 ? "" : "s"}`}
                </p>
                <button
                  onClick={() => play()}
                  disabled={!ids?.length}
                  className="mt-6 inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 font-semibold text-neutral-950 transition hover:scale-[1.03] hover:bg-white/90 disabled:opacity-50 disabled:hover:scale-100"
                >
                  <PlayIcon className="size-5" />
                  Play
                </button>
              </div>
            </header>

            {ids ? (
              ids.length ? (
                <ol>
                  {ids.map((songId, i) => (
                    <SongRow
                      key={songId}
                      id={songId}
                      index={i}
                      duration={remote.durations[songId]}
                      onPlay={() => play(songId)}
                      {...(addedIds.has(songId) && { onRemove: () => remove(songId) })}
                      onMore={(e, info) =>
                        setMenu(
                          menuAt(e, {
                            kind: "song",
                            id: songId,
                            title: info?.title ?? "",
                            subtitle: info?.artist ?? "",
                            image: `https://i.ytimg.com/vi/${songId}/mqdefault.jpg`,
                            savedAt: 0,
                          }),
                        )
                      }
                    />
                  ))}
                </ol>
              ) : (
                <p className="text-white/50">No songs in this playlist yet.</p>
              )
            ) : (
              <div className="flex animate-pulse flex-col gap-3">
                {Array.from({ length: 5 }, (_, i) => (
                  <div key={i} className="h-16 rounded-xl bg-white/[0.04]" />
                ))}
              </div>
            )}
          </>
        )}
      </div>
      <AnimatePresence>{menu && <CardMenu key={`${menu.item.id}:${menu.x}:${menu.y}`} menu={menu} onClose={() => setMenu(null)} />}</AnimatePresence>
    </main>
  );
}

const noop = () => () => {};

// shortcut: one title lookup per row (cached), like the edit modal; fine for ~100 songs, batch it if lists get much longer.
type Info = { title: string; artist: string };

function SongRow({
  id,
  index,
  duration,
  onPlay,
  onRemove,
  onMore,
}: {
  id: string;
  index: number;
  /** Only known for a synced list's own tracks (it comes with them); other songs show none rather than cost a lookup each. */
  duration?: string;
  onPlay: () => void;
  onRemove?: () => void;
  onMore: (e: React.MouseEvent, info: Info | null) => void;
}) {
  const [info, setInfo] = useState<Info | null>(null);
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
    <li className="no-callout group/row relative rounded-xl transition hover:bg-white/[0.06]" onContextMenu={(e) => onMore(e, info)} {...longPress((e) => onMore(e, info))}>
      {/* The whole row plays; it's a layer under the content so the artist can be its own link. */}
      <button onClick={onPlay} aria-label={`Play ${info?.title ?? "song"}`} className="absolute inset-0 rounded-xl" />
      <div className="pointer-events-none relative flex w-full items-center gap-4 px-3 py-2.5">
        <span className="w-6 text-right text-sm font-medium tabular-nums text-white/35">{index + 1}</span>
        <div className="relative size-12 shrink-0 overflow-hidden rounded-lg bg-white/5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`https://i.ytimg.com/vi/${id}/mqdefault.jpg`} alt="" loading="lazy" className="h-full w-full object-cover" />
          <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition group-hover/row:opacity-100">
            <PlayIcon className="size-5" />
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{info?.title ?? "…"}</p>
          <p className="truncate text-sm text-white/45">{info?.artist && <ArtistLink name={info.artist} className="pointer-events-auto" />}</p>
        </div>
        {duration && <span className="shrink-0 text-sm tabular-nums text-white/40">{duration}</span>}
        {/* Room for the hover actions, so a long title doesn't run under them. */}
        <span className={`shrink-0 ${onRemove ? "w-20" : "w-10"}`} />
      </div>
      <div className="absolute inset-y-0 right-3 flex items-center gap-1 opacity-0 transition group-hover/row:opacity-100 focus-within:opacity-100 touch:opacity-100">
        <RowAction label={`More for ${info?.title ?? "song"}`} onClick={(e) => onMore(e, info)}>
          <circle cx="5" cy="12" r="1.6" fill="currentColor" />
          <circle cx="12" cy="12" r="1.6" fill="currentColor" />
          <circle cx="19" cy="12" r="1.6" fill="currentColor" />
        </RowAction>
        {onRemove && (
          <RowAction label={`Remove ${info?.title ?? "song"} from this playlist`} onClick={onRemove}>
            <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" />
          </RowAction>
        )}
      </div>
    </li>
  );
}

function RowAction({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: (e: React.MouseEvent) => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      className="flex size-9 items-center justify-center rounded-full text-white/55 transition hover:bg-white/10 hover:text-white"
    >
      <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        {children}
      </svg>
    </button>
  );
}

function PlayIcon({ className }: { className: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M8 5.5v13a1 1 0 0 0 1.5.86l11-6.5a1 1 0 0 0 0-1.72l-11-6.5A1 1 0 0 0 8 5.5Z" />
    </svg>
  );
}
