"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Player } from "@/components/player/Player";

export function PlayFromParams() {
  const sp = useSearchParams();
  const v = sp.get("v") ?? undefined;
  const list = sp.get("list") ?? undefined;
  const videoId = v && /^[A-Za-z0-9_-]{11}$/.test(v) ? v : undefined;
  const listId = list && /^[A-Za-z0-9_-]+$/.test(list) ? list : undefined;

  if (!videoId && !listId) {
    return (
      <main className="flex h-dvh flex-col items-center justify-center gap-6 bg-neutral-950 text-white">
        <p className="text-2xl font-bold">Nothing to play.</p>
        <Link href="/" className="rounded-full bg-white px-6 py-3 font-semibold text-black">
          Paste a link
        </Link>
      </main>
    );
  }
  // Remount the player when the target changes.
  return <Player key={`${videoId}:${listId}`} videoId={videoId} listId={listId} />;
}
