"use client";

import { useEffect, useRef, useState } from "react";
import { SearchBox } from "@/components/SearchBox";

/**
 * The Cmd+K search, inline on the landing page (hero size) and in /home's header (`compact`).
 * Results float over the page instead of pushing it.
 */
export function HomeSearch({ compact = false }: { compact?: boolean }) {
  const height = compact ? 44 : 68;
  const ref = useRef<HTMLDivElement>(null);
  const [listMax, setListMax] = useState(320);

  // Keep the results list within the space left below the search bar.
  useEffect(() => {
    const measure = () => {
      const top = ref.current?.getBoundingClientRect().top ?? 0;
      setListMax(Math.max(window.innerHeight - top - height - 24, 160));
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [height]);

  return (
    <div ref={ref} className={`relative w-full ${compact ? "h-11 max-w-xl" : "mt-12 h-[68px] max-w-2xl"}`}>
      <div
        className={`absolute inset-x-0 top-0 z-20 overflow-hidden text-left ring-1 backdrop-blur-2xl transition ${
          compact
            ? // See-through on the frosted bar; solid only while results drop down over the page.
              "rounded-[22px] bg-transparent ring-white/15 hover:ring-white/25 focus-within:ring-white/30 has-[ul,button]:bg-neutral-900/95 has-[ul,button]:shadow-2xl has-[ul,button]:shadow-black/50"
            : "rounded-3xl bg-neutral-900/80 shadow-lg shadow-black/20 ring-white/10 focus-within:ring-white/25"
        }`}
      >
        <SearchBox autoFocus compact={compact} listMaxHeight={`${listMax}px`} />
      </div>
    </div>
  );
}
