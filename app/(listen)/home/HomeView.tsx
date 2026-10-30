"use client";

import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import type { ArtistRelease } from "@/lib/artist-source";
import { useHistory, type HistoryEntry } from "@/lib/history";
import { PINNED, SAVED_LIST_ID, isPinned, resolveSaved, savedTarget, useSaved, type SavedItem } from "@/lib/saved";
import type { RadioTrack } from "@/lib/video-source";
import { HomeSearch } from "../HomeSearch";
import { playHere, usePlayerHref } from "@/components/player/remote";
import { SavedCard, SavedShelf } from "../SavedShelf";
import { CardMenu, menuAt, type CardMenuState } from "./CardMenu";

const CARD = "w-36 snap-start sm:w-40";

type Release = ArtistRelease & { artist: string };

/** The app's home for returning listeners: search, recommendations, history, your playlists, new releases. */
export function HomeView() {
  const history = useHistory();
  const saved = useSaved();
  const playerHref = usePlayerHref();

  const recent = distinct(history, (h) => h.id).slice(0, 20);
  // Recommendations follow what you played last, or else what you saved last.
  const seed = history[0]?.id ?? [...saved].reverse().find((x) => x.kind === "song")?.id ?? null;
  const radio = useRadio(seed);
  const recentIds = new Set(recent.map((h) => h.id));
  const recommended = radio?.filter((t) => !recentIds.has(t.id)).slice(0, 16);

  // Where you left off in each playlist. Saved ones resume from their own card; the rest lead the shelf.
  const lastInList = distinct(history.filter((h) => h.listId), (h) => h.listId!);
  const resume = new Map(lastInList.map((h) => [h.listId!, h]));
  const isOnShelf = (listId: string) =>
    listId === SAVED_LIST_ID || isPinned("playlist", listId) || saved.some((x) => x.kind === "playlist" && x.id === listId);
  const unsaved = lastInList.filter((h) => !isOnShelf(h.listId!)).slice(0, 6);

  // From your library only, not what's playing: it stays put until you save or remove something.
  const releases = useReleases(libraryQuery(saved));
  const glow = history[0]?.image ?? null;

  const play = (item: Pick<SavedItem, "kind" | "id">) => playHere(savedTarget(item));
  // Every card's right-click menu: play next, save / unsave.
  const [menu, setMenu] = useState<CardMenuState | null>(null);
  const closeMenu = useCallback(() => setMenu(null), []);
  const openMenu = (e: React.MouseEvent, item: SavedItem) => setMenu(menuAt(e, item));

  const card = (item: SavedItem) => (
    <SavedCard item={item} className={CARD} pinned onPlay={() => play(item)} onContextMenu={(e) => openMenu(e, item)} />
  );

  return (
    <main className="relative min-h-dvh overflow-x-clip bg-neutral-950 pb-36 text-white">
      {/* What you played last tints the page, like the player's own backdrop. */}
      <AnimatePresence>
        {glow && (
          <motion.img
            key={glow}
            src={glow}
            alt=""
            aria-hidden
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.25 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.2 }}
            className="pointer-events-none absolute -top-40 left-1/2 w-[1100px] max-w-none -translate-x-1/2 blur-[110px]"
          />
        )}
      </AnimatePresence>

      {/* Search is the page's main action, so it lives in the bar and stays in reach while scrolling. */}
      <header className="sticky top-0 z-30 border-b border-white/[0.06]">
        {/* The bar's frost sits on its own layer: a blurred header would keep the search's own blur from reaching the page. */}
        <div aria-hidden className="absolute inset-0 -z-10 bg-neutral-950/60 backdrop-blur-2xl" />
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-5 sm:gap-8">
          {/* Already home: the logo goes to what's playing instead. */}
          <Link href={playerHref ?? "/home"} className="shrink-0 text-xl font-extrabold tracking-[-0.04em]">
            datlyrics
          </Link>
          <div className="flex min-w-0 flex-1 justify-center">
            <HomeSearch compact />
          </div>
          {/* Balances the logo so the search sits in the middle. */}
          <span aria-hidden className="w-[88px] shrink-0 max-lg:hidden" />
        </div>
      </header>

      <div className="relative z-10 mx-auto mt-10 flex max-w-6xl flex-col gap-14 px-5 sm:mt-14">
        {seed && recommended?.length !== 0 && (
          <Section title="Recommended for you">
            <Row>
              {recommended
                ? recommended.map((t) => (
                    <Animated key={t.id}>{card(songItem(t.id, t.title, t.artist, t.image))}</Animated>
                  ))
                : <Skeletons />}
            </Row>
          </Section>
        )}

        {recent.length > 0 && (
          <Section title="Recently played">
            <Row>
              {recent.map((h) => (
                <Animated key={h.id}>{card(songItem(h.id, h.title, h.artist, h.image))}</Animated>
              ))}
            </Row>
          </Section>
        )}

        <Section title="Your playlists">
          <SavedShelf
            variant="home"
            resume={resume}
            onCardMenu={openMenu}
            leading={unsaved.map((h) => (
              <ContinueCard key={h.listId} entry={h} onContextMenu={openMenu} />
            ))}
          />
        </Section>

        {releases !== undefined && (releases === null || releases.singles.length + releases.albums.length > 0) && (
          <Section title="New from your artists">
            <div className="flex flex-col gap-8">
              {(["singles", "albums"] as const).map(
                (kind) =>
                  (!releases || releases[kind].length > 0) && (
                    <div key={kind}>
                      <h3 className="mb-4 text-sm font-semibold uppercase tracking-[0.16em] text-white/40">
                        {kind === "singles" ? "Singles & EPs" : "Albums"}
                      </h3>
                      <Row>
                        {releases
                          ? releases[kind].map((r) => (
                              <Animated key={r.listId}>{card(releaseItem(r))}</Animated>
                            ))
                          : <Skeletons />}
                      </Row>
                    </div>
                  ),
              )}
            </div>
          </Section>
        )}
      </div>

      <AnimatePresence>{menu && <CardMenu key={`${menu.item.id}:${menu.x}:${menu.y}`} menu={menu} onClose={closeMenu} />}</AnimatePresence>
    </main>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section aria-label={title}>
      <h2 className="mb-5 text-2xl font-extrabold tracking-[-0.03em] sm:text-3xl">{title}</h2>
      {children}
    </section>
  );
}

/** A horizontally scrolling row that bleeds to the page edge and fades out there. */
function Row({ children }: { children: ReactNode }) {
  return (
    <div className="-mx-5 snap-x scroll-px-5 overflow-x-auto px-5 py-1 [mask-image:linear-gradient(to_right,transparent,#000_1.25rem,#000_calc(100%-1.25rem),transparent)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <div className="flex w-max gap-4 sm:gap-5">
        <AnimatePresence initial={false} mode="popLayout">
          {children}
        </AnimatePresence>
      </div>
    </div>
  );
}

/** A card that slides into place when the row changes (a new play moves to the front, fresh picks fade in). */
function Animated({ children }: { children: ReactNode }) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.92, y: 8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.92 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}

function Skeletons() {
  return Array.from({ length: 7 }, (_, i) => (
    <div key={`skeleton:${i}`} className={CARD} aria-hidden>
      <div className="aspect-square w-full animate-pulse rounded-2xl bg-white/[0.06]" />
      <div className="mt-2.5 h-3.5 w-3/4 rounded bg-white/[0.06]" />
      <div className="mt-1.5 h-3 w-1/2 rounded bg-white/[0.04]" />
    </div>
  ));
}

/** A playlist you were in the middle of but didn't save: its cover and name, resuming at your track. */
function ContinueCard({
  entry,
  onContextMenu,
}: {
  entry: HistoryEntry;
  onContextMenu: (e: React.MouseEvent, item: SavedItem) => void;
}) {
  const listId = entry.listId!;
  const [list, setList] = useState<Pick<SavedItem, "title" | "image" | "badge"> | null>(null);

  useEffect(() => {
    let alive = true;
    resolveSaved({ listId })
      .then((p) => alive && setList(p))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [listId]);

  const item: SavedItem = {
    kind: "playlist",
    id: listId,
    // Until (or unless) the playlist loads, show the track.
    title: list?.title ?? entry.title,
    subtitle: `Resume · ${entry.title}`,
    image: list?.image ?? entry.image,
    savedAt: 0,
    badge: list?.badge,
  };
  return (
    <SavedCard
      item={item}
      className="w-36 sm:w-40"
      pinned
      onPlay={() => playHere({ listId, videoId: entry.id })}
      onContextMenu={(e) => onContextMenu(e, item)}
    />
  );
}

const songItem = (id: string, title: string, artist: string, image: string | null): SavedItem => ({
  kind: "song",
  id,
  title,
  subtitle: artist,
  image: image ?? `https://i.ytimg.com/vi/${id}/mqdefault.jpg`,
  savedAt: 0,
});

function distinct<T>(items: T[], key: (x: T) => string): T[] {
  const seen = new Set<string>();
  return items.filter((x) => !seen.has(key(x)) && !!seen.add(key(x)));
}

const releaseItem = (r: Release): SavedItem => ({
  kind: "playlist",
  id: r.listId,
  title: r.title,
  subtitle: [r.artist, r.year].filter(Boolean).join(" · "),
  image: r.image,
  savedAt: 0,
  badge: r.kind,
});

/**
 * The library the releases come from: the pinned playlists everyone has, each saved song's main
 * artist ("A, B feat. C" is A) and each saved playlist.
 */
function libraryQuery(saved: SavedItem[]): string {
  const params = new URLSearchParams();
  for (const p of PINNED) if (p.kind === "playlist") params.append("list", p.id);
  for (const s of saved) {
    if (s.kind === "song") {
      const artist = s.subtitle.split(/\s*(?:,|&|\bfeat\.?|\bft\.?|\bwith\b)\s*/i)[0].trim();
      if (artist) params.append("artist", artist);
    } else if (s.id !== SAVED_LIST_ID && !isPinned(s.kind, s.id)) params.append("list", s.id);
  }
  return params.toString();
}

/** Songs related to `seed`. Keeps showing the last batch while a new seed loads; null until the first. */
function useRadio(seed: string | null): RadioTrack[] | null {
  const [tracks, setTracks] = useState<RadioTrack[] | null>(null);
  useEffect(() => {
    if (!seed) return;
    let alive = true;
    fetch(`/api/radio/${seed}`)
      .then((res) => (res.ok ? (res.json() as Promise<{ tracks: RadioTrack[] }>) : { tracks: [] }))
      .then((data) => alive && setTracks(data.tracks))
      .catch(() => alive && setTracks([]));
    return () => {
      alive = false;
    };
  }, [seed]);
  return tracks;
}

type Releases = { singles: Release[]; albums: Release[] };

/** Releases for this library: undefined when it's empty, null while loading. Refetches only when the library changes. */
function useReleases(query: string): Releases | null | undefined {
  const [state, setState] = useState<{ query: string; releases: Releases } | null>(null);
  useEffect(() => {
    if (!query) return;
    let alive = true;
    const none = { singles: [], albums: [] };
    fetch(`/api/releases?${query}`)
      .then((res) => (res.ok ? (res.json() as Promise<Releases>) : none))
      .then((releases) => alive && setState({ query, releases }))
      .catch(() => alive && setState({ query, releases: none }));
    return () => {
      alive = false;
    };
  }, [query]);
  if (!query) return undefined;
  // Keep showing the previous library's releases while a changed one loads.
  return state?.releases ?? null;
}
