import { cacheLife } from "next/cache";

export type VideoInfo = { title: string; channel: string };

export async function getVideoInfo(id: string): Promise<VideoInfo | null> {
  "use cache";
  cacheLife("days");

  const url = `https://www.youtube.com/watch?v=${id}`;
  const res = await fetch(`https://www.youtube.com/oembed?${new URLSearchParams({ url, format: "json" })}`);
  if (res.status === 404 || res.status === 401 || res.status === 400) return null; // private/removed
  if (!res.ok) throw new Error(`oEmbed ${res.status}`);
  const data = (await res.json()) as { title: string; author_name: string };
  return { title: data.title, channel: data.author_name };
}
