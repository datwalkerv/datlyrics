"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { parseYouTubeUrl, targetToQuery } from "@/lib/parse-youtube-url";

export function UrlForm() {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [error, setError] = useState(false);

  const go = (input: string) => {
    const target = parseYouTubeUrl(input);
    if (!target) {
      setError(true);
      return;
    }
    // Next keeps this page's state alive for back navigation, so clear it before leaving.
    setValue("");
    router.push(`/play?${targetToQuery(target)}`);
  };

  return (
    <form
      className="mt-12 w-full"
      onSubmit={(e) => {
        e.preventDefault();
        go(value);
      }}
    >
      <div
        className={`flex w-full items-center gap-2 rounded-full bg-white/[0.07] p-2 pl-7 ring-1 backdrop-blur-xl transition focus-within:bg-white/[0.1] ${
          error ? "ring-red-400/70" : "ring-white/15 focus-within:ring-white/40"
        }`}
      >
        <input
          autoFocus
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setError(false);
          }}
          onPaste={(e) => {
            const text = e.clipboardData.getData("text");
            if (parseYouTubeUrl(text)) {
              e.preventDefault();
              go(text);
            }
          }}
          placeholder="https://www.youtube.com/watch?v=…"
          aria-label="YouTube video or playlist URL"
          className="min-w-0 flex-1 bg-transparent py-3 text-lg text-white placeholder:text-white/30 focus:outline-none"
          spellCheck={false}
          autoComplete="off"
        />
        <button
          type="submit"
          className="shrink-0 rounded-full bg-white px-7 py-3 text-base font-bold text-black transition hover:scale-[1.03] active:scale-[0.98]"
        >
          Play
        </button>
      </div>
      <p className={`mt-3 h-5 text-sm text-red-300 transition-opacity ${error ? "opacity-100" : "opacity-0"}`}>
        That doesn&apos;t look like a YouTube video or playlist link.
      </p>
    </form>
  );
}
