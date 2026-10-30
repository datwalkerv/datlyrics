import type { NextRequest } from "next/server";
import { findArtistId, getArtist, mergeReleases } from "@/lib/artist-source";

/** Albums and singles from the artists you listen to (`?artist=` up to 4 times), newest first. */
export async function GET(req: NextRequest) {
  const names = req.nextUrl.searchParams
    .getAll("artist")
    .map((n) => n.trim().slice(0, 80))
    .filter(Boolean)
    .slice(0, 4);

  const lists = await Promise.all(
    names.map(async (name) => {
      const id = await findArtistId(name).catch(() => null);
      const artist = id ? await getArtist(id).catch(() => null) : null;
      return artist ? [...artist.singles, ...artist.albums].map((r) => ({ ...r, artist: artist.name })) : [];
    }),
  );
  return Response.json(
    { releases: mergeReleases(lists) },
    { headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" } },
  );
}
