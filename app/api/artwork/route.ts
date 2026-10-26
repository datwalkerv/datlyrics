import type { NextRequest } from "next/server";
import { findAlbumArtwork, findArtwork } from "@/lib/artwork-source";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const artist = sp.get("artist")?.trim() ?? "";
  const title = sp.get("title")?.trim() ?? "";
  const album = sp.get("album")?.trim() ?? "";
  if (!title && !album) return Response.json({ error: "title or album required" }, { status: 400 });

  try {
    const url = album ? await findAlbumArtwork(artist, album) : await findArtwork(artist, title);
    return Response.json(
      { url },
      { headers: { "Cache-Control": "public, s-maxage=604800, stale-while-revalidate=86400" } },
    );
  } catch {
    return Response.json({ url: null }, { status: 502 });
  }
}
