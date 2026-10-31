import { after, type NextRequest } from "next/server";
import { findItunesSong } from "@/lib/artwork-source";
import { findLyrics, reportNeed } from "@/lib/lyrics-source";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const artist = sp.get("artist")?.trim() ?? "";
  const title = sp.get("title")?.trim() ?? "";
  const duration = Number(sp.get("duration")) || 0;
  const v = sp.get("v");
  const videoId = v && /^[\w-]{11}$/.test(v) ? v : null;
  if (!title) return Response.json({ error: "title required" }, { status: 400 });

  try {
    const { needed, ...result } = await findLyrics(artist, title, duration);
    // Nobody has it synced: send it to datlrc's "Needs lyrics" list with the cover the player shows
    // (the same cached iTunes lookup), after the response so playback doesn't wait.
    if (needed)
      after(async () => {
        const itunes = await findItunesSong(artist, title).catch(() => null);
        await reportNeed({
          artistName: artist,
          trackName: title,
          albumName: itunes?.album ?? null,
          duration: Math.round(duration),
          artworkUrl: itunes?.artwork ?? (videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : null),
          videoId,
        }).catch(() => {});
      });
    return Response.json(result, {
      headers: { "Cache-Control": "public, s-maxage=604800, stale-while-revalidate=86400" },
    });
  } catch {
    return Response.json({ error: "lyrics lookup failed" }, { status: 502 });
  }
}
