import type { NextRequest } from "next/server";
import { getPlaylistTracks } from "@/lib/artist-source";

/** A playlist's track ids, for queueing it after what's playing. */
export async function GET(_req: NextRequest, ctx: RouteContext<"/api/playlist/[id]/tracks">) {
  const { id } = await ctx.params;
  if (!/^[A-Za-z0-9_-]{10,64}$/.test(id)) return Response.json({ error: "bad id" }, { status: 400 });

  try {
    return Response.json(
      { ids: await getPlaylistTracks(id) },
      { headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" } },
    );
  } catch {
    return Response.json({ error: "lookup failed" }, { status: 502 });
  }
}
