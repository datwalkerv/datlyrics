"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Player } from "@/components/player/Player";
import { publishCurrent, useRequested, type Target } from "@/components/player/remote";

/**
 * The player lives in the layout, not the /play page, so going home or browsing an artist page doesn't stop it:
 * Next hides (and cleans up) pages you leave, but keeps layouts mounted.
 */
export function PlayerHost() {
  const pathname = usePathname();
  const sp = useSearchParams();
  const onPlay = pathname === "/play";

  const v = sp.get("v") ?? undefined;
  const list = sp.get("list") ?? undefined;
  const fromUrl: Target = {
    videoId: v && /^[A-Za-z0-9_-]{11}$/.test(v) ? v : undefined,
    listId: list && /^[A-Za-z0-9_-]+$/.test(list) ? list : undefined,
  };
  const hasUrlTarget = onPlay && !!(fromUrl.videoId || fromUrl.listId);

  // Off /play, keep playing whatever /play (or playHere) last asked for.
  const [last, setLast] = useState<Target | null>(null);
  const request = useRequested();
  const [seenRequest, setSeenRequest] = useState(request);
  if (request !== seenRequest) {
    setSeenRequest(request);
    if (request) setLast(request);
  }
  if (hasUrlTarget && (fromUrl.videoId !== last?.videoId || fromUrl.listId !== last?.listId)) setLast(fromUrl);
  const target = hasUrlTarget ? fromUrl : last;

  const videoId = target?.videoId;
  const listId = target?.listId;
  useEffect(() => publishCurrent(videoId || listId ? { videoId, listId } : null), [videoId, listId]);

  if (onPlay && !hasUrlTarget) {
    return (
      <main className="flex h-dvh flex-col items-center justify-center gap-6 bg-neutral-950 text-white">
        <p className="text-2xl font-bold">Nothing to play.</p>
        <Link href="/home" className="rounded-full bg-white px-6 py-3 font-semibold text-black">
          Paste a link
        </Link>
      </main>
    );
  }
  if (!target) return null;
  // Remount the player when the target changes.
  return (
    <Player
      key={`${target.videoId}:${target.listId}`}
      videoId={target.videoId}
      listId={target.listId}
      minimized={!onPlay}
      playbackKeysWhenMinimized={pathname === "/home"}
    />
  );
}
