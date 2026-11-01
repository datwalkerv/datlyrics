"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import { EMPTY_COVER, blockEmpty } from "@/components/PlaylistModals";
import { CoverImage } from "@/components/player/CoverImage";
import { playHere } from "@/components/player/remote";
import { fetchVideoInfo } from "@/components/player/useTrackMeta";
import { cleanTitle } from "@/lib/clean-title";
import { SAVED_LIST_ID, isLocalList, mergeAdded, useSaved } from "@/lib/saved";

type Header = { title: string; subtitle: string; image: string | null; badge?: string };

/** A playlist's songs. Your own lists and Saved come from localStorage; YouTube lists from the API, after the songs you added. */
export function PlaylistView() {
  const { id } = useParams<{ id: string }>();
  const saved = useSaved();
  const item = saved.find((x) => x.kind === "playlist" && x.id === id);
  const local = isLocalList(id);
  const [remote, setRemote] = useState<{ header: Header | null; ids: string[] | null; failed: boolean }>({
    header: null,
    ids: null,
    failed: false,
  });

  useEffect(() => {
    if (local || !/^[A-Za-z0-9_-]{10,64}$/.test(id)) return;
    let alive = true;
    const json = (url: string) => fetch(url).then((r) => (r.ok ? r.json() : Promise.reject(new Error(url))));
    Promise.all([
      json(`/api/playlist/${id}`).catch(() => null) as Promise<{ title: string; channel: string; thumbnail: string | null; kind: string | null } | null>,
      json(`/api/playlist/${id}/tracks`).then((d: { ids: string[] }) => d.ids).catch(() => null),
    ]).then(([info, ids]) => {
      if (!alive) return;
      setRemote({
        header: info && { title: info.title, subtitle: info.channel, image: info.thumbnail, badge: info.kind ?? undefined },
        ids,
        failed: !info && !ids,
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

  const play = (videoId?: string) => {
    if (blockEmpty(id)) return;
    playHere({ listId: id, videoId });
  };

  return (
    <main className="relative min-h-dvh overflow-x-hidden bg-neutral-950 pb-36 text-white">
      <div className="mx-auto max-w-6xl px-5">
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
                  {header?.subtitle}
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
                    <SongRow key={songId} id={songId} index={i} onPlay={() => play(songId)} />
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
    </main>
  );
}

const noop = () => () => {};

// shortcut: one title lookup per row (cached), like the edit modal; fine for ~100 songs, batch it if lists get much longer.
function SongRow({ id, index, onPlay }: { id: string; index: number; onPlay: () => void }) {
  const [info, setInfo] = useState<{ title: string; artist: string } | null>(null);
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
    <li>
      <button onClick={onPlay} className="group flex w-full items-center gap-4 rounded-xl px-3 py-2.5 text-left transition hover:bg-white/[0.06]">
        <span className="w-6 text-right text-sm font-medium tabular-nums text-white/35">{index + 1}</span>
        <div className="relative size-12 shrink-0 overflow-hidden rounded-lg bg-white/5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`https://i.ytimg.com/vi/${id}/mqdefault.jpg`} alt="" loading="lazy" className="h-full w-full object-cover" />
          <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition group-hover:opacity-100">
            <PlayIcon className="size-5" />
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{info?.title ?? "…"}</p>
          <p className="truncate text-sm text-white/45">{info?.artist ?? ""}</p>
        </div>
      </button>
    </li>
  );
}

function PlayIcon({ className }: { className: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M8 5.5v13a1 1 0 0 0 1.5.86l11-6.5a1 1 0 0 0 0-1.72l-11-6.5A1 1 0 0 0 8 5.5Z" />
    </svg>
  );
}
