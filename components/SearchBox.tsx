"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { parseYouTubeUrl, targetToQuery } from "@/lib/parse-youtube-url";
import { useSaved } from "@/lib/saved";
import { openSavePicker } from "./PlaylistModals";
import { playHere, playNext } from "./player/remote";
import type { SearchResult } from "@/lib/search-source";

type Results = { q: string; results: SearchResult[]; failed: boolean };

/**
 * Song search + link input with live YouTube suggestions. Shared by the home page and the
 * Cmd+K palette; the caller provides the surrounding card.
 */
export function SearchBox({
  onNavigate,
  onEscape,
  autoFocus = false,
  hint,
  listMaxHeight = "min(56vh, 32rem)",
  compact = false,
}: {
  onNavigate?: () => void;
  onEscape?: () => void;
  autoFocus?: boolean;
  /** Shown under the input while it is empty; omit for no hint row. */
  hint?: string;
  /** CSS max-height of the results list. */
  listMaxHeight?: string;
  /** Toolbar size (the /home header) instead of the landing page's hero size. */
  compact?: boolean;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [data, setData] = useState<Results | null>(null);
  const [selected, setSelected] = useState(0);

  // Songs in Saved or added to any of your playlists.
  const savedSongs = new Set(useSaved().flatMap((x) => (x.kind === "song" ? [x.id] : (x.added ?? []).map((a) => a.id))));

  const q = query.trim();
  const link = parseYouTubeUrl(q);
  const isWords = q.length >= 2 && !link;

  // Debounced search; stale results stay on screen until fresh ones arrive.
  useEffect(() => {
    if (!isWords) return;
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      fetch(`/api/search?${new URLSearchParams({ q })}`, { signal: ctrl.signal })
        .then((r) => r.json() as Promise<{ results: SearchResult[]; error?: string }>)
        .then((r) => {
          setData({ q, results: r.results, failed: !!r.error });
          setSelected(0);
        })
        .catch((e) => {
          if (e.name !== "AbortError") setData({ q, results: [], failed: true });
        });
    }, 250);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q, isWords]);

  const results = isWords ? (data?.results ?? []) : [];
  const loading = isWords && data?.q !== q;

  const play = (path: string) => {
    // Pages stay alive for back navigation, so don't leave the query behind.
    setQuery("");
    onNavigate?.();
    router.push(path);
  };

  const submit = () => {
    if (link) return play(`/play?${targetToQuery(link)}`);
    const r = results[selected];
    if (r) play(`/play?v=${r.id}`);
  };

  return (
    <>
      <div className={`flex items-center ${compact ? "gap-2.5 px-4" : "gap-3 px-6"}`}>
        <svg
          viewBox="0 0 24 24"
          className={`shrink-0 text-white/40 ${compact ? "size-4" : "size-5"}`}
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" strokeLinecap="round" />
        </svg>
        <input
          ref={inputRef}
          autoFocus={autoFocus}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.preventDefault();
              if (onEscape) onEscape();
              else setQuery("");
            } else if (e.key === "Enter") {
              e.preventDefault();
              submit();
            } else if (e.key === "ArrowDown" && results.length) {
              e.preventDefault();
              setSelected((s) => (s + 1) % results.length);
            } else if (e.key === "ArrowUp" && results.length) {
              e.preventDefault();
              setSelected((s) => (s - 1 + results.length) % results.length);
            }
          }}
          placeholder="Search a song, or paste a YouTube link"
          aria-label="Search songs or paste a YouTube link"
          className={`min-w-0 flex-1 bg-transparent text-white placeholder:text-white/30 focus:outline-none ${
            compact ? "py-2.5 text-[15px] leading-6" : "py-5 text-xl"
          }`}
          spellCheck={false}
          autoComplete="off"
        />
        {loading && (
          <div className="size-4 shrink-0 animate-spin rounded-full border-2 border-white/15 border-t-white/70" />
        )}
      </div>

      {link && (
        <div className="border-t border-white/10 p-2">
          <button
            onClick={submit}
            className="flex w-full items-center gap-4 rounded-2xl bg-white/10 px-4 py-3 text-left text-white"
          >
            <span className="flex size-10 items-center justify-center rounded-full bg-white text-black">
              <svg viewBox="0 0 24 24" className="size-5" fill="currentColor">
                <path d="M8 5.5v13a1 1 0 0 0 1.5.86l11-6.5a1 1 0 0 0 0-1.72l-11-6.5A1 1 0 0 0 8 5.5Z" />
              </svg>
            </span>
            <span className="font-semibold">{link.listId ? "Play this playlist" : "Play this video"}</span>
            <span className="ml-auto text-sm text-white/40">Enter ↵</span>
          </button>
        </div>
      )}

      {isWords && (results.length > 0 || (!loading && data)) && (
        <ul
          style={{ maxHeight: listMaxHeight }}
          className="overflow-y-auto border-t border-white/10 p-2"
          role="listbox"
        >
          {results.map((r, i) => (
            <li
              key={r.id}
              role="option"
              aria-selected={i === selected}
              onMouseEnter={() => setSelected(i)}
              className={`flex items-center rounded-2xl transition-colors ${i === selected ? "bg-white/10" : ""}`}
            >
              <button onClick={() => play(`/play?v=${r.id}`)} className="flex min-w-0 flex-1 items-center gap-4 py-2.5 pl-3 text-left">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`https://i.ytimg.com/vi/${r.id}/mqdefault.jpg`}
                  alt=""
                  className="aspect-video w-24 shrink-0 rounded-lg object-cover"
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold text-white">{r.title}</span>
                  <span className="block truncate text-sm text-white/50">{r.channel}</span>
                </span>
              </button>
              {/* Hovering the duration slides out quick actions; leaving hides them again. */}
              <div className="group/actions flex shrink-0 items-center self-stretch py-2.5 pl-3 pr-3">
                <span className="text-sm tabular-nums text-white/40">{r.duration}</span>
                <div className="flex max-w-0 items-center gap-1 overflow-hidden opacity-0 transition-all duration-200 ease-out group-hover/actions:ml-2 group-hover/actions:max-w-20 group-hover/actions:opacity-100 focus-within:ml-2 focus-within:max-w-20 focus-within:opacity-100">
                  <ResultAction
                    label="Play next"
                    onClick={() => {
                      // With nothing playing there's nothing to queue after: start it in place.
                      if (!playNext([r.id])) playHere({ videoId: r.id });
                    }}
                  >
                    <path d="M4 6h11M4 12h11M4 18h7M17 15l4 3-4 3z" />
                  </ResultAction>
                  <ResultAction label="Save to playlist" onClick={() => openSavePicker({ id: r.id })}>
                    <path
                      d="M12 20.5s-7.5-4.6-7.5-10.1A4.4 4.4 0 0 1 12 7.6a4.4 4.4 0 0 1 7.5 2.8c0 5.5-7.5 10.1-7.5 10.1Z"
                      fill={savedSongs.has(r.id) ? "currentColor" : "none"}
                    />
                  </ResultAction>
                </div>
              </div>
            </li>
          ))}
          {!loading && data && results.length === 0 && (
            <li className="px-4 py-6 text-center text-white/45">
              {data.failed ? "Search isn't responding right now." : "No results."}
            </li>
          )}
        </ul>
      )}

      {!q && hint && <p className="border-t border-white/10 px-6 py-3 text-xs text-white/35">{hint}</p>}
    </>
  );
}

function ResultAction({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      className="flex size-8 shrink-0 items-center justify-center rounded-full text-white/60 transition hover:bg-white/10 hover:text-white"
    >
      <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        {children}
      </svg>
    </button>
  );
}
