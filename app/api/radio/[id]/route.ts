import type { NextRequest } from "next/server";
import { getRadio } from "@/lib/video-source";

export async function GET(_req: NextRequest, ctx: RouteContext<"/api/radio/[id]">) {
  const { id } = await ctx.params;
  if (!/^[A-Za-z0-9_-]{11}$/.test(id)) return Response.json({ error: "bad id" }, { status: 400 });

  try {
    return Response.json(
      { tracks: await getRadio(id) },
      { headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" } },
    );
  } catch {
    return Response.json({ error: "lookup failed" }, { status: 502 });
  }
}
