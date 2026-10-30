import { getDiscover } from "@/lib/discover-source";

export async function GET() {
  try {
    return Response.json(
      { shelves: await getDiscover() },
      { headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" } },
    );
  } catch {
    return Response.json({ error: "lookup failed" }, { status: 502 });
  }
}
