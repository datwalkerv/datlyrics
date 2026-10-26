"use client";

import { useEffect, useRef, useState } from "react";

/**
 * A YouTube Music image that falls back to the iTunes cover for the same song or album when it's
 * missing or fails to load (Google's image host can rate-limit), and to nothing rather than a
 * broken-image icon.
 */
export function Cover({
  src,
  artist,
  title,
  album,
  className,
}: {
  src: string | null;
  artist: string;
  /** Look up by song title… */
  title?: string;
  /** …or by album / single title. */
  album?: string;
  className?: string;
}) {
  const [url, setUrl] = useState(src);
  const [failed, setFailed] = useState(!src);
  const ref = useRef<HTMLImageElement>(null);
  const onError = () => {
    if (failed) setUrl(null);
    else {
      setUrl(null);
      setFailed(true);
    }
  };

  // Server-rendered images can fail before hydration attaches onError; catch those on mount.
  useEffect(() => {
    const img = ref.current;
    if (img?.complete && img.naturalWidth === 0) onError();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!failed || (!title && !album)) return;
    let alive = true;
    const q = new URLSearchParams(album ? { artist, album } : { artist, title: title! });
    fetch(`/api/artwork?${q}`)
      .then((r) => r.json() as Promise<{ url: string | null }>)
      .then((r) => alive && setUrl(r.url))
      .catch(() => alive && setUrl(null));
    return () => {
      alive = false;
    };
  }, [failed, artist, title, album]);

  if (!url) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      ref={ref}
      src={url}
      alt=""
      loading="lazy"
      className={className}
      onError={onError}
    />
  );
}
