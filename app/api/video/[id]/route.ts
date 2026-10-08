import type { NextRequest } from "next/server";
import { getVideoInfo } from "@/lib/video-source";

export async function GET(_req: NextRequest, ctx: RouteContext<"/api/video/[id]">) {
  const { id } = await ctx.params;
  if (!/^[A-Za-z0-9_-]{11}$/.test(id)) return Response.json({ error: "bad id" }, { status: 400 });

  try {
    const info = await getVideoInfo(id);
    if (!info) return Response.json({ error: "unavailable" }, { status: 404 });
    return Response.json(info, {
      headers: { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=86400" },
    });
  } catch {
    return Response.json({ error: "lookup failed" }, { status: 502 });
  }
}
