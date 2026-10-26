import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { findArtistId, getArtist, isChannelId, type ArtistRelease } from "@/lib/artist-source";
import { Cover } from "./Cover";

type Props = PageProps<"/artist/[id]">;

/** Artist links from the player carry a name; resolve it once and land on the stable channel URL. */
async function load(params: Props["params"]) {
  const { id: raw } = await params;
  let id = raw;
  try {
    id = decodeURIComponent(raw);
  } catch {}
  if (!isChannelId(id)) {
    const name = id.trim();
    if (!name || name.length > 200) notFound();
    const found = await findArtistId(name).catch(() => null);
    if (!found) notFound();
    redirect(`/artist/${found}`);
  }
  const artist = await getArtist(id).catch(() => null);
  if (!artist) notFound();
  return artist;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  if (!isChannelId(id)) return { title: "datlyrics" };
  const artist = await getArtist(id).catch(() => null);
  return { title: artist ? `${artist.name} · datlyrics` : "datlyrics" };
}

export default function ArtistPage({ params }: Props) {
  return (
    <main className="relative min-h-dvh overflow-x-hidden bg-neutral-950 pb-36 text-white">
      <Suspense fallback={<ArtistSkeleton />}>
        <Artist params={params} />
      </Suspense>
    </main>
  );
}

async function Artist({ params }: { params: Props["params"] }) {
  const artist = await load(params);

  return (
    <>
      <header className="relative">
        {/* iTunes has no artist photos, so a failed banner falls back to the newest album's cover. */}
        <Cover
          key={artist.name}
          src={artist.image}
          artist={artist.name}
          album={(artist.albums[0] ?? artist.singles[0])?.title}
          className="absolute inset-0 h-full w-full object-cover opacity-60"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-neutral-950 via-neutral-950/60 to-neutral-950/20" />
        <div className="relative mx-auto flex min-h-[clamp(18rem,45vh,30rem)] max-w-6xl flex-col px-5">
          <Link href="/" className="py-6 text-xl font-extrabold tracking-[-0.04em] text-white/80 hover:text-white sm:py-7">
            datlyrics
          </Link>
          <div className="mt-auto pb-8">
            <h1 className="text-[clamp(2.75rem,8vw,6rem)] font-extrabold leading-none tracking-[-0.05em]">{artist.name}</h1>
            {artist.allSongsListId && (
              <Link
                href={`/play?list=${artist.allSongsListId}`}
                className="mt-6 inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 font-semibold text-neutral-950 transition hover:scale-[1.03] hover:bg-white/90"
              >
                <PlayIcon className="size-5" />
                Play all songs
              </Link>
            )}
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-6xl flex-col gap-16 px-5">
        {artist.songs.length > 0 && (
          <section>
            <SectionTitle>Top songs</SectionTitle>
            <ol className="mt-4">
              {artist.songs.map((song, i) => (
                <li key={song.id}>
                  <Link
                    href={`/play?v=${song.id}`}
                    className="group flex items-center gap-4 rounded-xl px-3 py-2.5 transition hover:bg-white/[0.06]"
                  >
                    <span className="w-5 text-right text-sm font-medium tabular-nums text-white/35">{i + 1}</span>
                    <div className="relative size-12 shrink-0 overflow-hidden rounded-lg bg-white/5">
                      <Cover src={song.image} artist={artist.name} title={song.title} className="h-full w-full object-cover" />
                      <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition group-hover:opacity-100">
                        <PlayIcon className="size-5" />
                      </div>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{song.title}</p>
                      <p className="truncate text-sm text-white/45">{song.album}</p>
                    </div>
                  </Link>
                </li>
              ))}
            </ol>
          </section>
        )}
        <Releases title="Albums" artist={artist.name} items={artist.albums} />
        <Releases title="Singles & EPs" artist={artist.name} items={artist.singles} />
      </div>
    </>
  );
}

function Releases({ title, artist, items }: { title: string; artist: string; items: ArtistRelease[] }) {
  if (!items.length) return null;
  return (
    <section>
      <SectionTitle>{title}</SectionTitle>
      <div className="mt-5 grid grid-cols-2 gap-x-5 gap-y-7 sm:grid-cols-3 lg:grid-cols-5">
        {items.map((r) => (
          <Link key={r.listId} href={`/play?list=${r.listId}`} className="group" title={`Play ${r.title}`}>
            <div className="relative aspect-square overflow-hidden rounded-2xl bg-white/5 ring-1 ring-white/10 transition group-hover:ring-white/30">
              <Cover src={r.image} artist={artist} album={r.title} className="h-full w-full object-cover" />
              <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition group-hover:opacity-100">
                <PlayIcon className="size-10" />
              </div>
            </div>
            <p className="mt-2.5 truncate font-semibold">{r.title}</p>
            <p className="text-sm text-white/45">{r.year}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-2xl font-extrabold tracking-[-0.03em] sm:text-3xl">{children}</h2>;
}

function PlayIcon({ className }: { className: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M8 5.5v13a1 1 0 0 0 1.5.86l11-6.5a1 1 0 0 0 0-1.72l-11-6.5A1 1 0 0 0 8 5.5Z" />
    </svg>
  );
}

function ArtistSkeleton() {
  return (
    <div className="mx-auto max-w-6xl animate-pulse px-5">
      <div className="flex min-h-[clamp(18rem,45vh,30rem)] flex-col justify-end pb-8">
        <div className="h-16 w-2/3 max-w-md rounded-2xl bg-white/[0.06]" />
      </div>
      <div className="mt-4 flex flex-col gap-3">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="h-16 rounded-xl bg-white/[0.04]" />
        ))}
      </div>
    </div>
  );
}
