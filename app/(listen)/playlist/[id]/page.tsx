import type { Metadata } from "next";
import { Suspense } from "react";
import { PlaylistView } from "./PlaylistView";

export const metadata: Metadata = { title: "Playlist · datlyrics" };

export default function PlaylistPage() {
  return (
    <Suspense fallback={<main className="min-h-dvh bg-neutral-950" />}>
      <PlaylistView />
    </Suspense>
  );
}
