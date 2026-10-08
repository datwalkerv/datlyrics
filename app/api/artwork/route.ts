import type { NextRequest } from "next/server";
import { findArtwork } from "@/lib/artwork-source";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const artist = sp.get("artist")?.trim() ?? "";
  const title = sp.get("title")?.trim() ?? "";
  if (!title) return Response.json({ error: "title required" }, { status: 400 });

  try {
    const url = await findArtwork(artist, title);
    return Response.json(
      { url },
      { headers: { "Cache-Control": "public, s-maxage=604800, stale-while-revalidate=86400" } },
    );
  } catch {
    return Response.json({ url: null }, { status: 502 });
  }
}
