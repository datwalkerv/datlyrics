"use client";

import { useEffect, useRef, useState } from "react";
import { SearchBox } from "@/components/SearchBox";

/** The Cmd+K search, inline on the home page. Results float over the page instead of pushing it. */
export function HomeSearch() {
  const ref = useRef<HTMLDivElement>(null);
  const [listMax, setListMax] = useState(320);

  // Keep the results list within the space left below the search bar.
  useEffect(() => {
    const measure = () => {
      const top = ref.current?.getBoundingClientRect().top ?? 0;
      setListMax(Math.max(window.innerHeight - top - 68 - 24, 160));
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  return (
    <div ref={ref} className="relative mt-12 h-[68px] w-full max-w-2xl">
      <div className="absolute inset-x-0 top-0 z-20 overflow-hidden rounded-3xl bg-neutral-900/80 text-left shadow-lg shadow-black/20 ring-1 ring-white/10 backdrop-blur-2xl transition focus-within:ring-white/25">
        <SearchBox autoFocus listMaxHeight={`${listMax}px`} />
      </div>
    </div>
  );
}
