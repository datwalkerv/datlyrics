import { GITHUB_URL } from "@/lib/site";
import { UrlForm } from "./UrlForm";

export default function Home() {
  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-neutral-950 px-5 text-white">
      <a
        href={GITHUB_URL}
        target="_blank"
        rel="noreferrer"
        aria-label="datlyrics on GitHub"
        className="absolute right-5 top-5 flex items-center gap-2 rounded-full px-3 py-2 text-sm font-medium text-white/50 transition hover:bg-white/10 hover:text-white sm:right-8 sm:top-7"
      >
        <svg viewBox="0 0 24 24" className="size-5" fill="currentColor" aria-hidden>
          <path d="M12 .5a11.5 11.5 0 0 0-3.64 22.41c.58.1.79-.25.79-.56v-2c-3.2.7-3.88-1.37-3.88-1.37-.52-1.33-1.28-1.69-1.28-1.69-1.05-.71.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.68 0-1.26.45-2.28 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.77 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.83 1.19 3.09 0 4.41-2.69 5.38-5.25 5.67.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 12 .5Z" />
        </svg>
        <span className="max-sm:hidden">GitHub</span>
      </a>
      <div className="relative z-10 flex w-full max-w-3xl flex-col items-center text-center">
        <h1 className="text-[clamp(3.5rem,11vw,9rem)] font-extrabold leading-none tracking-[-0.05em]">datlyrics</h1>
        <p className="mt-5 max-w-xl text-[clamp(1.05rem,2vw,1.4rem)] font-medium text-white/55">
          Paste a YouTube song or playlist. Sit back. Sing along.
        </p>
        <UrlForm />
        <p className="mt-10 text-sm text-white/35">
          Press ⌘K to search songs · Works with youtube.com, youtu.be and music.youtube.com links · Lyrics by LRCLIB
        </p>
      </div>
    </main>
  );
}
