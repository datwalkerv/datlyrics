import { ImageResponse } from "next/og";

/** The app mark from app/icon.svg, full-bleed (home screens round the corners themselves). */
export function renderIcon(size: number) {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: "linear-gradient(#191919, #080808)" }}>
        <svg width={size} height={size} viewBox="0 0 128 128">
          <path
            transform="translate(13.4 14.1) scale(4.2)"
            fill="#fff"
            d="M11.5 5.75a1 1 0 0 1 1.5-.86l3.6 2.1a1 1 0 0 1 .5.87v1.27a.6.6 0 0 1-.9.52L13.5 8.4v7.35a3.25 3.25 0 1 1-2-3V5.75Z"
          />
        </svg>
      </div>
    ),
    { width: size, height: size },
  );
}
