"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { parseYouTubeUrl, targetToQuery } from "@/lib/parse-youtube-url";
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
}: {
  onNavigate?: () => void;
  onEscape?: () => void;
  autoFocus?: boolean;
  /** Shown under the input while it is empty; omit for no hint row. */
  hint?: string;
  /** CSS max-height of the results list. */
  listMaxHeight?: string;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [data, setData] = useState<Results | null>(null);
  const [selected, setSelected] = useState(0);

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
      <div className="flex items-center gap-3 px-6">
        <svg
          viewBox="0 0 24 24"
          className="size-5 shrink-0 text-white/40"
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
          className="min-w-0 flex-1 bg-transparent py-5 text-xl text-white placeholder:text-white/30 focus:outline-none"
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
              <svg viewBox="0 0 24 24" className="ml-0.5 size-5" fill="currentColor">
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
            <li key={r.id} role="option" aria-selected={i === selected}>
              <button
                onMouseEnter={() => setSelected(i)}
                onClick={() => play(`/play?v=${r.id}`)}
                className={`flex w-full items-center gap-4 rounded-2xl px-3 py-2.5 text-left transition-colors ${
                  i === selected ? "bg-white/10" : ""
                }`}
              >
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
                <span className="shrink-0 text-sm tabular-nums text-white/40">{r.duration}</span>
              </button>
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
