import { cacheLife } from "next/cache";

export type SearchResult = {
  id: string;
  title: string;
  channel: string;
  duration: string;
};

type Run = { text: string };
type VideoRenderer = {
  videoId?: string;
  title?: { runs?: Run[] };
  ownerText?: { runs?: Run[] };
  lengthText?: { simpleText?: string };
};

// YouTube's own web client endpoint: no API key or quota, but unofficial, so parse defensively.
const ENDPOINT = "https://www.youtube.com/youtubei/v1/search?prettyPrint=false";
const VIDEOS_ONLY = "EgIQAQ%3D%3D";

function collect(node: unknown, out: VideoRenderer[]) {
  if (Array.isArray(node)) {
    for (const x of node) collect(x, out);
  } else if (node && typeof node === "object") {
    const o = node as Record<string, unknown>;
    if (o.videoRenderer) out.push(o.videoRenderer as VideoRenderer);
    for (const v of Object.values(o)) collect(v, out);
  }
}

export async function searchVideos(query: string): Promise<SearchResult[]> {
  "use cache";
  cacheLife("hours");

  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      context: { client: { clientName: "WEB", clientVersion: "2.20250101.00.00", hl: "en" } },
      query,
      params: decodeURIComponent(VIDEOS_ONLY),
    }),
  });
  if (!res.ok) throw new Error(`YouTube search ${res.status}`);

  const renderers: VideoRenderer[] = [];
  collect(await res.json(), renderers);

  const seen = new Set<string>();
  const results: SearchResult[] = [];
  for (const v of renderers) {
    // Live streams have no length; they don't make sense for a lyrics player.
    if (!v.videoId || !v.lengthText?.simpleText || seen.has(v.videoId)) continue;
    seen.add(v.videoId);
    results.push({
      id: v.videoId,
      title: v.title?.runs?.map((r) => r.text).join("") ?? "",
      channel: v.ownerText?.runs?.[0]?.text ?? "",
      duration: v.lengthText.simpleText,
    });
    if (results.length >= 8) break;
  }
  return results;
}
