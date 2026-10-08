import type { NextRequest } from "next/server";
import { findLyrics } from "@/lib/lyrics-source";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const artist = sp.get("artist")?.trim() ?? "";
  const title = sp.get("title")?.trim() ?? "";
  const duration = Number(sp.get("duration")) || 0;
  if (!title) return Response.json({ error: "title required" }, { status: 400 });

  try {
    const result = await findLyrics(artist, title, duration);
    return Response.json(result, {
      headers: { "Cache-Control": "public, s-maxage=604800, stale-while-revalidate=86400" },
    });
  } catch {
    return Response.json({ error: "lyrics lookup failed" }, { status: 502 });
  }
}
