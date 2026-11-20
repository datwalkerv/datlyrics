import type { NextRequest } from "next/server";
import { mergeResults, searchAlbums, searchSongs, searchVideos } from "@/lib/search-source";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim().slice(0, 120) ?? "";
  if (!q) return Response.json({ results: [], albums: [] });

  try {
    const query = q.toLowerCase();
    // Either side may fail on its own; only a total failure is an error.
    const [songs, videos, albums] = await Promise.all([
      searchSongs(query).catch(() => null),
      searchVideos(query).catch(() => null),
      searchAlbums(query).catch(() => []),
    ]);
    if (!songs && !videos) throw new Error("search failed");
    const results = mergeResults(songs ?? [], videos ?? []);
    return Response.json(
      { results, albums },
      { headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" } },
    );
  } catch {
    return Response.json({ results: [], albums: [], error: "search failed" }, { status: 502 });
  }
}
