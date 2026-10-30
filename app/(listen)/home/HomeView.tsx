"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import type { DiscoverShelf } from "@/lib/discover-source";
import { useHistory, type HistoryEntry } from "@/lib/history";
import { SAVED_LIST_ID, resolveSaved, savedHref, useSaved, type SavedItem } from "@/lib/saved";
import type { RadioTrack } from "@/lib/video-source";
import { HomeSearch } from "../HomeSearch";
import { SavedCard, SavedShelf } from "../SavedShelf";

const CARD = "w-36 snap-start sm:w-40";

/** The app's home for returning listeners: search, history, your playlists, recommendations, discovery. */
export function HomeView() {
  const history = useHistory();
  const saved = useSaved();
  const router = useRouter();
  const greeting = useGreeting();

  const playlists = distinct(history.filter((h) => h.listId), (h) => h.listId!).slice(0, 8);
  const recent = distinct(history, (h) => h.id).slice(0, 20);
  // Recommendations follow what you played last, or else what you saved last.
  const seed = history[0]?.id ?? [...saved].reverse().find((x) => x.kind === "song")?.id ?? null;
  const radio = useRadio(seed);
  const recentIds = new Set(recent.map((h) => h.id));
  const recommended = radio?.filter((t) => !recentIds.has(t.id)).slice(0, 16);
  const discover = useDiscover();
  const glow = history[0]?.image ?? null;

  const play = (item: Pick<SavedItem, "kind" | "id">) => router.push(savedHref(item));

  return (
    <main className="relative min-h-dvh overflow-x-hidden bg-neutral-950 pb-36 text-white">
      {/* What you played last tints the page, like the player's own backdrop. */}
      {glow && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={glow}
          alt=""
          aria-hidden
          className="pointer-events-none absolute -top-48 left-1/2 w-[1100px] max-w-none -translate-x-1/2 opacity-25 blur-[110px]"
        />
      )}
      <header className="relative z-30 mx-auto flex max-w-6xl items-center justify-between px-5 py-5 sm:py-7">
        <Link href="/home" className="text-xl font-extrabold tracking-[-0.04em]">
          datlyrics
        </Link>
      </header>

      <section className="relative z-20 mx-auto max-w-6xl px-5 pt-4 sm:pt-8">
        <h1 className="text-[clamp(2.5rem,6vw,4.5rem)] font-extrabold leading-[0.95] tracking-[-0.05em]">{greeting}</h1>
        <p className="mt-4 text-lg text-white/50">Search a song, paste a link, or pick up where you left off.</p>
        <HomeSearch />
      </section>

      <div className="relative z-10 mx-auto mt-16 flex max-w-6xl flex-col gap-14 px-5">
        {playlists.length > 0 && (
          <Section title="Continue listening">
            <Row>
              {playlists.map((h) => (
                <ContinueCard key={h.listId} entry={h} />
              ))}
            </Row>
          </Section>
        )}

        <Section title="Your playlists">
          <SavedShelf variant="home" />
        </Section>

        {recent.length > 0 && (
          <Section title="Recently played">
            <Row>
              {recent.map((h) => (
                <SavedCard key={h.id} item={songItem(h.id, h.title, h.artist, h.image)} className={CARD} pinned onPlay={() => play({ kind: "song", id: h.id })} />
              ))}
            </Row>
          </Section>
        )}

        {seed && recommended?.length !== 0 && (
          <Section title="Recommended for you">
            <Row>
              {recommended
                ? recommended.map((t) => (
                    <SavedCard key={t.id} item={songItem(t.id, t.title, t.artist, t.image)} className={CARD} pinned onPlay={() => play({ kind: "song", id: t.id })} />
                  ))
                : <Skeletons />}
            </Row>
          </Section>
        )}

        {discover === null ? (
          <Section title="Discover">
            <Row>
              <Skeletons />
            </Row>
          </Section>
        ) : (
          discover.map((shelf, i) => (
            <Section key={shelf.title} eyebrow={i === 0 ? "Discover" : undefined} title={shelf.title}>
              <Row>
                {shelf.items.map((item) => (
                  <SavedCard
                    key={`${item.kind}:${item.id}`}
                    item={{ ...item, savedAt: 0 }}
                    className={CARD}
                    pinned
                    onPlay={() => play(item)}
                  />
                ))}
              </Row>
            </Section>
          ))
        )}
      </div>
    </main>
  );
}

function Section({ eyebrow, title, children }: { eyebrow?: string; title: string; children: ReactNode }) {
  return (
    <section aria-label={title}>
      {eyebrow && <p className="mb-2 text-xs font-medium uppercase tracking-[0.2em] text-white/30">{eyebrow}</p>}
      <h2 className="mb-5 text-2xl font-extrabold tracking-[-0.03em] sm:text-3xl">{title}</h2>
      {children}
    </section>
  );
}

/** A horizontally scrolling row that bleeds to the page edge and fades out there. */
function Row({ children }: { children: ReactNode }) {
  return (
    <div className="-mx-5 snap-x scroll-px-5 overflow-x-auto px-5 py-1 [mask-image:linear-gradient(to_right,transparent,#000_1.25rem,#000_calc(100%-1.25rem),transparent)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <div className="flex w-max gap-4 sm:gap-5">{children}</div>
    </div>
  );
}

function Skeletons() {
  return Array.from({ length: 7 }, (_, i) => (
    <div key={i} className={CARD} aria-hidden>
      <div className="aspect-square w-full animate-pulse rounded-2xl bg-white/[0.06]" />
      <div className="mt-2.5 h-3.5 w-3/4 rounded bg-white/[0.06]" />
      <div className="mt-1.5 h-3 w-1/2 rounded bg-white/[0.04]" />
    </div>
  ));
}

/** A playlist you were in the middle of: its cover and name, resuming at the track you were on. */
function ContinueCard({ entry }: { entry: HistoryEntry }) {
  const router = useRouter();
  const listId = entry.listId!;
  const [list, setList] = useState<Pick<SavedItem, "title" | "image"> | null>(
    listId === SAVED_LIST_ID ? { title: "Saved", image: "/saved.svg" } : null,
  );

  useEffect(() => {
    if (listId === SAVED_LIST_ID) return;
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
  return (
    <SavedCard
      item={item}
      className={CARD}
      pinned
      onPlay={() => router.push(`/play?${new URLSearchParams({ list: listId, v: entry.id })}`)}
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

/** YouTube Music's home shelves; null while loading, empty if they couldn't be loaded. */
function useDiscover(): DiscoverShelf[] | null {
  const [shelves, setShelves] = useState<DiscoverShelf[] | null>(null);
  useEffect(() => {
    let alive = true;
    fetch("/api/discover")
      .then((res) => (res.ok ? (res.json() as Promise<{ shelves: DiscoverShelf[] }>) : { shelves: [] }))
      .then((data) => alive && setShelves(data.shelves))
      .catch(() => alive && setShelves([]));
    return () => {
      alive = false;
    };
  }, []);
  return shelves;
}

const noSubscribe = () => () => {};
const greetingFor = (hour: number) =>
  hour >= 5 && hour < 12 ? "Good morning" : hour >= 12 && hour < 18 ? "Good afternoon" : "Good evening";

/** By the visitor's own clock, so it's only known in the browser. */
function useGreeting() {
  return useSyncExternalStore(noSubscribe, () => greetingFor(new Date().getHours()), () => "Welcome back");
}
