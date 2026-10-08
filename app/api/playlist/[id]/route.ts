import type { NextRequest } from "next/server";
import { getPlaylistInfo } from "@/lib/video-source";

export async function GET(_req: NextRequest, ctx: RouteContext<"/api/playlist/[id]">) {
  const { id } = await ctx.params;
  if (!/^[A-Za-z0-9_-]{10,64}$/.test(id)) return Response.json({ error: "bad id" }, { status: 400 });

  try {
    const info = await getPlaylistInfo(id);
    if (!info) return Response.json({ error: "unavailable" }, { status: 404 });
    return Response.json(info, {
      headers: { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=86400" },
    });
  } catch {
    return Response.json({ error: "lookup failed" }, { status: 502 });
  }
}
