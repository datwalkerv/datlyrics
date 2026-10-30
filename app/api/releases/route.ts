import type { NextRequest } from "next/server";
import { findArtistId, getArtist, getPlaylistArtists, mergeReleases, rankArtists } from "@/lib/artist-source";

/**
 * Singles and albums from the artists in your library: `?artist=` once per saved song (its main
 * artist) and `?list=` per saved playlist. Same library in, same releases out.
 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const names = sp
    .getAll("artist")
    .map((n) => n.trim().slice(0, 80))
    .filter(Boolean)
    .slice(0, 50);
  const lists = sp
    .getAll("list")
    .filter((id) => /^[A-Za-z0-9_-]{10,64}$/.test(id))
    .slice(0, 10);

  // Look each name up once; a saved song still counts once per song.
  const unique = [...new Set(names)];
  const [ids, listCredits] = await Promise.all([
    Promise.all(unique.map((n) => findArtistId(n).catch(() => null))),
    Promise.all(lists.map((id) => getPlaylistArtists(id).catch(() => []))),
  ]);
  const idByName = new Map(unique.map((n, i) => [n, ids[i]]));
  const credits = [...names.map((n) => idByName.get(n)).filter((id) => id != null), ...listCredits.flat()];

  const artists = (await Promise.all(rankArtists(credits).map((id) => getArtist(id).catch(() => null)))).filter(
    (a) => a !== null,
  );
  const tag = <T,>(list: T[], artist: string) => list.map((r) => ({ ...r, artist }));
  return Response.json(
    {
      singles: mergeReleases(artists.map((a) => tag(a.singles, a.name))),
      albums: mergeReleases(artists.map((a) => tag(a.albums, a.name))),
    },
    { headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" } },
  );
}
