import Link from "next/link";
import { DEMO_PLAYLIST_ID, GITHUB_URL } from "@/lib/site";
import { HomeSearch } from "./HomeSearch";
import { SavedShelf } from "./SavedShelf";

const DEMO_HREF = `/play?list=${DEMO_PLAYLIST_ID}`;

const SHOWCASE = [
  {
    src: "/screens/lyrics-2.jpg",
    title: "Lyrics that keep up",
    body: "The current line lights up and the rest fade back, with dots through intros and breaks. Click any line to jump there. Songs with only plain lyrics scroll along slowly instead.",
    keys: ["[", "]"],
    keysLabel: "nudge the timing",
  },
  {
    src: "/screens/video.jpg",
    title: "Song or music video",
    body: "Switch between the album audio and the official video, like YouTube Music. Playback stays on the same lyric line, even when the video has a longer intro.",
    keys: ["V"],
    keysLabel: "switch",
  },
  {
    src: "/screens/queue.jpg",
    title: "Whole playlists",
    body: "Paste a playlist link and it plays start to finish. Open the queue to jump to any track, and an “Up next” card shows up near the end of each song.",
    keys: ["Q"],
    keysLabel: "queue",
  },
  {
    src: "/screens/search.jpg",
    title: "Search or paste",
    body: "Type a song name, or paste any youtube.com, youtu.be or music.youtube.com link. Search opens from anywhere, even mid-song.",
    keys: ["⌘", "K"],
    keysLabel: "search",
  },
];

const EXTRAS = [
  ["Real album art", "Covers come from iTunes and prefer the original release, so you see the album, not a video still."],
  ["Living background", "The blurred cover drifts and breathes behind the lyrics. Built to stay smooth on 4K TVs."],
  ["Saved favorites", "Press S while playing to keep a song or playlist on the home page. Stored in your browser only."],
  ["Loop and shuffle", "Press L to keep one song on repeat, inside a playlist too. Press R to shuffle a playlist."],
  ["Keyboard only", "No buttons on screen and a cursor that hides itself. Everything has a shortcut."],
  ["No account", "No sign-up, no API keys, no cookies, no analytics."],
];

const SHORTCUTS: [string[], string][] = [
  [["⌘", "K"], "Search or paste a link"],
  [["Space"], "Play / pause"],
  [["←", "→"], "Seek 5 seconds"],
  [["↑", "↓"], "Volume"],
  [["N", "P"], "Next / previous"],
  [["V"], "Song / music video"],
  [["Q"], "Queue"],
  [["S"], "Save to home"],
  [["L"], "Loop"],
  [["R"], "Shuffle playlist"],
  [["E"], "Background effects"],
  [["[", "]"], "Lyrics earlier / later"],
  [["F"], "Fullscreen"],
];

export default function Home() {
  return (
    <main className="relative overflow-x-hidden bg-neutral-950 text-white">
      <header className="relative z-30 mx-auto flex max-w-6xl items-center justify-between px-5 py-5 sm:py-7">
        <span className="text-xl font-extrabold tracking-[-0.04em]">datlyrics</span>
        <a
          href={GITHUB_URL}
          target="_blank"
          rel="noreferrer"
          aria-label="datlyrics on GitHub"
          className="flex items-center gap-2 rounded-full px-3 py-2 text-sm font-medium text-white/50 transition hover:bg-white/10 hover:text-white"
        >
          <GitHubIcon className="size-5" />
          <span className="max-sm:hidden">GitHub</span>
        </a>
      </header>

      <section className="relative px-5 pb-24 pt-10 lg:pt-16">
        {/* The player's own look: its colors bleed into the page behind the hero. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/screens/hero.jpg"
          alt=""
          aria-hidden
          className="pointer-events-none absolute -top-40 left-1/2 w-[1400px] max-w-none -translate-x-1/2 opacity-25 blur-[100px]"
        />
        <div className="relative z-20 mx-auto grid max-w-6xl items-center gap-14 lg:grid-cols-[1.1fr_1fr]">
          <div className="max-lg:text-center">
            <h1 className="text-[clamp(3rem,7vw,5.5rem)] font-extrabold leading-[0.95] tracking-[-0.05em]">
              Paste a song.
              <br />
              <span className="text-white/40">Sing along.</span>
            </h1>
            <p className="mt-6 max-w-md text-lg text-white/55 max-lg:mx-auto">
              A lyrics player made for the big screen. Drop in a YouTube song or a whole playlist and the words light up
              line by line.
            </p>
            <div className="max-lg:flex max-lg:justify-center [&>div]:mt-9">
              <HomeSearch />
            </div>
          </div>
          <Screen src="/screens/hero.jpg" alt="datlyrics playing Pleasure's Mine with synced lyrics" glow />
        </div>
        <div className="relative z-10 mt-20 flex flex-col items-center">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-white/30">Your shelf</p>
          <SavedShelf />
        </div>
      </section>

      <section id="showcase" className="scroll-mt-10 px-5 pb-28">
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-[clamp(2rem,5vw,3.5rem)] font-extrabold leading-tight tracking-[-0.04em]">
              Karaoke night, on the big screen.
            </h2>
            <p className="mt-4 text-lg text-white/55">
              Blurred cover art fills the room, the song sits on the left and the lyrics play on the right. Hit fullscreen, and enjoy your favorite tracks.
            </p>
          </div>
          <Screen src="/screens/lyrics.jpg" alt="datlyrics playing Shake It Off with synced lyrics" className="mt-14" glow />
          <div className="mt-10 flex flex-col items-center gap-3 text-center">
            <DemoButton />
            <p className="text-sm text-white/40">zapzarap · a ready-made playlist, no setup needed</p>
          </div>
        </div>
      </section>

      <section className="px-5 pb-28" aria-label="Features">
        <div className="mx-auto flex max-w-6xl flex-col gap-24 sm:gap-32">
          {SHOWCASE.map((f, i) => (
            <div key={f.title} className={`grid items-center gap-8 lg:gap-14 ${i % 2 ? "lg:grid-cols-[1.6fr_1fr]" : "lg:grid-cols-[1fr_1.6fr]"}`}>
              <div className={i % 2 ? "lg:order-last" : ""}>
                <h3 className="text-3xl font-extrabold tracking-[-0.03em] sm:text-4xl">{f.title}</h3>
                <p className="mt-4 text-lg leading-relaxed text-white/55">{f.body}</p>
                <p className="mt-6 flex items-center gap-2 text-sm text-white/40">
                  <Keys keys={f.keys} />
                  {f.keysLabel}
                </p>
              </div>
              <Screen src={f.src} alt={f.title} />
            </div>
          ))}
        </div>
      </section>

      <section className="px-5 pb-28" aria-label="More features">
        <div className="mx-auto grid max-w-6xl gap-px overflow-hidden rounded-3xl bg-white/10 ring-1 ring-white/10 sm:grid-cols-2 lg:grid-cols-3">
          {EXTRAS.map(([title, body]) => (
            <div key={title} className="bg-neutral-950 p-7">
              <h3 className="font-bold">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-white/50">{body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="px-5 pb-28" aria-labelledby="shortcuts">
        <div className="mx-auto max-w-4xl">
          <h2 id="shortcuts" className="text-center text-3xl font-extrabold tracking-[-0.03em] sm:text-4xl">
            Everything is a keystroke
          </h2>
          <dl className="mt-10 grid gap-x-10 gap-y-4 sm:grid-cols-2">
            {SHORTCUTS.map(([keys, label]) => (
              <div key={label} className="flex items-center justify-between gap-4 border-b border-white/[0.07] pb-4">
                <dt className="text-white/60">{label}</dt>
                <dd>
                  <Keys keys={keys} />
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section className="px-5 pb-20">
        <div className="mx-auto flex max-w-4xl flex-col items-center rounded-3xl bg-white/[0.04] px-6 py-16 text-center ring-1 ring-white/10">
          <h2 className="text-[clamp(2rem,5vw,3rem)] font-extrabold leading-tight tracking-[-0.04em]">Try it right now.</h2>
          <p className="mt-3 max-w-lg text-white/55">
            Start the demo playlist, or scroll back up and paste your own. No account, nothing to install.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <DemoButton />
            <a
              href="#"
              className="rounded-full px-6 py-3 font-semibold text-white/70 ring-1 ring-white/15 transition hover:bg-white/10 hover:text-white"
            >
              Paste your own
            </a>
          </div>
        </div>
      </section>

      <footer className="flex flex-col items-center gap-3 px-5 pb-12 text-center text-sm text-white/30">
        <p>No accounts, no database, no analytics. Saved songs live in your browser.</p>
        <p>
          Lyrics by{" "}
          <a href="https://lrclib.net" target="_blank" rel="noreferrer" className="underline-offset-4 hover:text-white/60 hover:underline">
            LRCLIB
          </a>{" "}
          · Playback by YouTube ·{" "}
          <a href={GITHUB_URL} target="_blank" rel="noreferrer" className="underline-offset-4 hover:text-white/60 hover:underline">
            Source on GitHub
          </a>
        </p>
      </footer>
    </main>
  );
}

function Screen({ src, alt, className = "", glow = false }: { src: string; alt: string; className?: string; glow?: boolean }) {
  return (
    <div className={`relative ${className}`}>
      {glow && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" aria-hidden className="absolute inset-0 h-full w-full scale-105 rounded-3xl opacity-40 blur-3xl" />
      )}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        width={1600}
        height={900}
        loading="lazy"
        className="relative w-full rounded-2xl shadow-2xl shadow-black/60 ring-1 ring-white/10 sm:rounded-3xl"
      />
    </div>
  );
}

function DemoButton() {
  return (
    <Link
      href={DEMO_HREF}
      className="flex items-center gap-2 rounded-full bg-white px-6 py-3 font-semibold text-neutral-950 transition hover:scale-[1.03] hover:bg-white/90"
    >
      <svg viewBox="0 0 24 24" className="size-5" fill="currentColor" aria-hidden>
        <path d="M8 5.5v13a1 1 0 0 0 1.5.86l11-6.5a1 1 0 0 0 0-1.72l-11-6.5A1 1 0 0 0 8 5.5Z" />
      </svg>
      Play the demo playlist
    </Link>
  );
}

function Keys({ keys }: { keys: string[] }) {
  return (
    <span className="flex gap-1">
      {keys.map((k) => (
        <kbd
          key={k}
          className="min-w-7 rounded-md bg-white/[0.07] px-2 py-1 text-center font-sans text-xs font-semibold text-white/80 ring-1 ring-white/15"
        >
          {k}
        </kbd>
      ))}
    </span>
  );
}

function GitHubIcon({ className }: { className: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M12 .5a11.5 11.5 0 0 0-3.64 22.41c.58.1.79-.25.79-.56v-2c-3.2.7-3.88-1.37-3.88-1.37-.52-1.33-1.28-1.69-1.28-1.69-1.05-.71.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.68 0-1.26.45-2.28 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.77 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.83 1.19 3.09 0 4.41-2.69 5.38-5.25 5.67.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 12 .5Z" />
    </svg>
  );
}
