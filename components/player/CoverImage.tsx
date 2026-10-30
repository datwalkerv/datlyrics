"use client";

import { useState } from "react";

/** <img> that degrades maxresdefault -> hqdefault for YouTube thumbnails that lack a max-res version. */
export function CoverImage({
  src,
  className,
  alt = "",
  loading,
  onError,
}: {
  src: string;
  className?: string;
  alt?: string;
  loading?: "lazy";
  /** When the image can't load at all (after the hqdefault fallback, for YouTube thumbnails). */
  onError?: () => void;
}) {
  const [failed, setFailed] = useState<string | null>(null);
  const url = failed === src ? src.replace("maxresdefault", "hqdefault") : src;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt={alt}
      className={className}
      draggable={false}
      loading={loading}
      onError={() => (src.includes("maxresdefault") && failed !== src ? setFailed(src) : onError?.())}
      onLoad={(e) => {
        // YouTube serves a 120x90 grey placeholder (with 200 OK on some CDNs) when maxres is missing.
        if (src.includes("maxresdefault") && e.currentTarget.naturalWidth <= 120) setFailed(src);
      }}
    />
  );
}
