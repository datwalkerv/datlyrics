import type { NextRequest } from "next/server";
import { searchVideos } from "@/lib/search-source";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim().slice(0, 120) ?? "";
  if (!q) return Response.json({ results: [] });

  try {
    const results = await searchVideos(q.toLowerCase());
    return Response.json(
      { results },
      { headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" } },
    );
  } catch {
    return Response.json({ results: [], error: "search failed" }, { status: 502 });
  }
}
