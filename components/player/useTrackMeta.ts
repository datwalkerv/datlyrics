"use client";

import { useEffect, useState } from "react";
import { classifyUpload, cleanTitle, type SongInfo } from "@/lib/clean-title";
import type { Version } from "@/lib/counterpart-source";
import type { LyricsResult } from "@/lib/lyrics-source";
import type { PlaylistInfo, VideoInfo } from "@/lib/video-source";

export type TrackMeta = SongInfo & {
  videoId: string;
  artwork: string | null; // null while loading; falls back to a YouTube thumbnail
};

// In-memory caches of in-flight/settled requests, shared across tracks.
const cache = new Map<string, Promise<unknown>>();

function cached<T>(key: string, load: () => Promise<T>): Promise<T> {
  let p = cache.get(key) as Promise<T> | undefined;
  if (!p) {
    p = load();
    cache.set(key, p);
    p.catch(() => cache.delete(key)); // allow retry after failures
  }
  return p;
}

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} ${res.status}`);
  return res.json() as Promise<T>;
}

export const thumbnailUrl = (id: string, quality: "maxresdefault" | "hqdefault" = "maxresdefault") =>
  `https://i.ytimg.com/vi/${id}/${quality}.jpg`;

export function fetchVideoInfo(id: string) {
  return cached(`video:${id}`, () => getJson<VideoInfo>(`/api/video/${id}`));
}

export function fetchArtwork({ artist, title }: SongInfo) {
  const q = new URLSearchParams({ artist, title });
  return cached(`art:${q}`, () =>
    getJson<{ url: string | null }>(`/api/artwork?${q}`).then((r) => r.url),
  );
}

function fetchTracks(listId: string) {
  return cached(`tracks:${listId}`, () => getJson<{ ids: string[]; songs?: Record<string, SongInfo> }>(`/api/playlist/${listId}/tracks`));
}

/** An album's title, cover and track ids; null when it isn't an album (OLAK5uy_ lists are). */
function fetchAlbum(listId: string) {
  if (!listId.startsWith("OLAK5uy_")) return Promise.resolve(null);
  return cached(`album:${listId}`, () =>
    Promise.all([
      getJson<PlaylistInfo>(`/api/playlist/${listId}`),
      fetchTracks(listId),
    ]).then(([info, tracks]) => (info.thumbnail ? { title: info.title, cover: info.thumbnail, ids: tracks.ids } : null)),
  );
}

export type Album = { title: string; cover: string };

/**
 * The album while one of its tracks plays: its cover, so a song first released as a single (with
 * another cover) doesn't show that one, and its title. `undefined`: not an album track, use the
 * song's artwork; null: still finding out.
 */
export function useAlbum(listId: string | undefined, videoId: string | null): Album | null | undefined {
  const [album, setAlbum] = useState<{ listId: string; value: (Album & { ids: string[] }) | null } | null>(null);

  useEffect(() => {
    if (!listId) return;
    let alive = true;
    fetchAlbum(listId)
      .catch(() => null)
      .then((value) => alive && setAlbum({ listId, value }));
    return () => {
      alive = false;
    };
  }, [listId]);

  if (!listId?.startsWith("OLAK5uy_")) return undefined;
  if (album?.listId !== listId) return null;
  return videoId && album.value?.ids.includes(videoId) ? album.value : undefined;
}

/** `videoId` is the upload playing; it goes along so a song nobody has synced can be sent to datlrc. */
export function fetchLyrics({ artist, title }: SongInfo, duration: number, videoId?: string) {
  const q = new URLSearchParams({ artist, title, duration: String(Math.round(duration)), ...(videoId && { v: videoId }) });
  const url = `/api/lyrics?${q}`;
  // LRCLIB occasionally times out; one delayed retry covers most blips.
  return cached(`lyrics:${q}`, () =>
    getJson<LyricsResult>(url).catch(
      () => new Promise<LyricsResult>((resolve, reject) => setTimeout(() => getJson<LyricsResult>(url).then(resolve, reject), 1500)),
    ),
  );
}

/**
 * Which upload to play for a track in the given mode, like YouTube Music's Song/Video switch:
 * a song (audio/Topic upload) in video mode becomes its official music video and vice versa.
 * Falls back to the original upload when there's no counterpart or it's neither kind.
 */
export type PickedVersion = { id: string; song: SongInfo; seconds: number };

export function pickVersion(id: string, want: Version): Promise<PickedVersion> {
  return cached(`version:${want}:${id}`, async () => {
    const info = await fetchVideoInfo(id);
    const song = cleanTitle(info.title, info.channel);
    const kind = classifyUpload(info.title, info.channel);
    if (kind === "other" || kind === want) return { id, song, seconds: 0 };
    const q = new URLSearchParams({ artist: song.artist, title: song.title, want, exclude: id });
    const r = await getJson<{ id: string | null; seconds: number }>(`/api/counterpart?${q}`).catch(() => null);
    return r?.id ? { id: r.id, song, seconds: r.seconds } : { id, song, seconds: 0 };
  });
}

/** Resolves song info for a video id: player metadata if available, else oEmbed. */
export function useSongInfo(videoId: string | null, rawTitle: string, channel: string): SongInfo | null {
  const [fromApi, setFromApi] = useState<{ id: string; info: SongInfo } | null>(null);

  useEffect(() => {
    if (!videoId || rawTitle) return;
    let alive = true;
    fetchVideoInfo(videoId)
      .then((v) => alive && setFromApi({ id: videoId, info: cleanTitle(v.title, v.channel) }))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [videoId, rawTitle]);

  if (!videoId) return null;
  if (rawTitle) return cleanTitle(rawTitle, channel);
  return fromApi?.id === videoId ? fromApi.info : null;
}

const NO_SONGS: Record<string, SongInfo> = {};

/**
 * The list's own title and artists by video id, which keep the credits a Topic upload drops
 * ("Song (feat. X)", "A & B"). For display: lookups stay on the upload's main artist.
 */
export function useListSongs(listId: string | undefined): Record<string, SongInfo> {
  const [songs, setSongs] = useState<{ listId: string; value: Record<string, SongInfo> } | null>(null);

  useEffect(() => {
    if (!listId) return;
    let alive = true;
    fetchTracks(listId)
      .then((t) => alive && setSongs({ listId, value: t.songs ?? {} }))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [listId]);

  return (listId && songs?.listId === listId && songs?.value) || NO_SONGS;
}

/** Album artwork URL for a song, or the YouTube thumbnail if no match. `null` while loading. */
export function useArtwork(videoId: string | null, song: SongInfo | null): string | null {
  const [state, setState] = useState<{ key: string; url: string } | null>(null);
  const key = videoId && song ? `${videoId}|${song.artist}|${song.title}` : null;

  useEffect(() => {
    if (!key || !videoId || !song) return;
    let alive = true;
    fetchArtwork(song)
      .catch(() => null)
      .then((url) => alive && setState({ key, url: url ?? thumbnailUrl(videoId) }));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return state?.key === key ? state.url : null;
}

export type LyricsState = { status: "loading" } | { status: "error" } | ({ status: "ready" } & LyricsResult);

export function useLyrics(song: SongInfo | null, duration: number, videoId?: string | null): LyricsState {
  const [state, setState] = useState<{ key: string; value: LyricsState } | null>(null);
  // Wait for the real duration: it's the strongest signal for picking the right LRC.
  const key = song && duration > 0 ? `${song.artist}|${song.title}|${Math.round(duration)}` : null;

  useEffect(() => {
    if (!key || !song) return;
    let alive = true;
    fetchLyrics(song, duration, videoId ?? undefined)
      .then((r) => alive && setState({ key, value: { status: "ready", ...r } }))
      .catch(() => alive && setState({ key, value: { status: "error" } }));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return state?.key === key ? state.value : { status: "loading" };
}
