"use client";

import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import type { ArtistRelease } from "@/lib/artist-source";
import { useHistory, type HistoryEntry } from "@/lib/history";
import { SAVED_LIST_ID, isPinned, resolveSaved, savedTarget, useSaved, type SavedItem } from "@/lib/saved";
import type { RadioTrack } from "@/lib/video-source";
import { HomeSearch } from "../HomeSearch";
import { playHere, usePlayerHref } from "../PlayerHost";
import { SavedCard, SavedShelf } from "../SavedShelf";

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

  const artists = topArtists(history, saved);
  const releases = useReleases(artists);
  const glow = history[0]?.image ?? null;

  const play = (item: Pick<SavedItem, "kind" | "id">) => playHere(savedTarget(item));

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
      <header className="sticky top-0 z-30 border-b border-white/[0.06] bg-neutral-950/60 backdrop-blur-2xl">
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
                    <Animated key={t.id}>
                      <SavedCard item={songItem(t.id, t.title, t.artist, t.image)} className={CARD} pinned onPlay={() => play({ kind: "song", id: t.id })} />
                    </Animated>
                  ))
                : <Skeletons />}
            </Row>
          </Section>
        )}

        {recent.length > 0 && (
          <Section title="Recently played">
            <Row>
              {recent.map((h) => (
                <Animated key={h.id}>
                  <SavedCard item={songItem(h.id, h.title, h.artist, h.image)} className={CARD} pinned onPlay={() => play({ kind: "song", id: h.id })} />
                </Animated>
              ))}
            </Row>
          </Section>
        )}

        <Section title="Your playlists">
          <SavedShelf
            variant="home"
            resume={resume}
            leading={unsaved.map((h) => (
              <ContinueCard key={h.listId} entry={h} />
            ))}
          />
        </Section>

        {artists.length > 0 && releases?.length !== 0 && (
          <Section title="New from your artists">
            <Row>
              {releases
                ? releases.map((r) => (
                    <Animated key={r.listId}>
                      <SavedCard
                        item={{ kind: "playlist", id: r.listId, title: r.title, subtitle: [r.artist, r.year].filter(Boolean).join(" · "), image: r.image, savedAt: 0 }}
                        className={CARD}
                        pinned
                        onPlay={() => play({ kind: "playlist", id: r.listId })}
                      />
                    </Animated>
                  ))
                : <Skeletons />}
            </Row>
          </Section>
        )}
      </div>
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
function ContinueCard({ entry }: { entry: HistoryEntry }) {
  const listId = entry.listId!;
  const [list, setList] = useState<Pick<SavedItem, "title" | "image"> | null>(null);

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
  };
  return <SavedCard item={item} className="w-36 sm:w-40" pinned onPlay={() => playHere({ listId, videoId: entry.id })} />;
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

/** The artists you play and save most (saves count double), main artist only: "A, B feat. C" is A. */
function topArtists(history: HistoryEntry[], saved: SavedItem[], max = 4): string[] {
  const score = new Map<string, { name: string; n: number }>();
  const add = (raw: string, n: number) => {
    const name = raw.split(/\s*(?:,|&|\bfeat\.?|\bft\.?|\bwith\b)\s*/i)[0].trim();
    if (!name) return;
    const key = name.toLowerCase();
    const cur = score.get(key) ?? { name, n: 0 };
    score.set(key, { name: cur.name, n: cur.n + n });
  };
  for (const h of history) add(h.artist, 1);
  for (const s of saved) if (s.kind === "song") add(s.subtitle, 2);
  return [...score.values()].sort((a, b) => b.n - a.n).slice(0, max).map((x) => x.name);
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

/** Latest albums and singles from these artists. Keeps the last list while a new one loads; null until the first. */
function useReleases(artists: string[]): Release[] | null {
  const [releases, setReleases] = useState<Release[] | null>(null);
  const query = new URLSearchParams(artists.map((a) => ["artist", a])).toString();
  useEffect(() => {
    if (!query) return;
    let alive = true;
    fetch(`/api/releases?${query}`)
      .then((res) => (res.ok ? (res.json() as Promise<{ releases: Release[] }>) : { releases: [] }))
      .then((data) => alive && setReleases(data.releases))
      .catch(() => alive && setReleases([]));
    return () => {
      alive = false;
    };
  }, [query]);
  return releases;
}

