import type { NextRequest } from "next/server";
import { findCounterpart, type Version } from "@/lib/counterpart-source";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const artist = sp.get("artist")?.trim() ?? "";
  const title = sp.get("title")?.trim() ?? "";
  const want = sp.get("want") as Version;
  const exclude = sp.get("exclude") ?? "";
  if (!title || (want !== "song" && want !== "video")) {
    return Response.json({ error: "title and want=song|video required" }, { status: 400 });
  }

  try {
    const match = await findCounterpart(artist, title, want, exclude);
    return Response.json(
      { id: match?.id ?? null, seconds: match?.seconds ?? 0 },
      { headers: { "Cache-Control": "public, s-maxage=604800, stale-while-revalidate=86400" } },
    );
  } catch {
    return Response.json({ id: null }, { status: 502 });
  }
}
