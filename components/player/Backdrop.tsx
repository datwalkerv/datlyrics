"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef } from "react";

/**
 * Full-screen backdrop built from the cover art. Both modes render the same blurred cover; with
 * `animated` it comes alive: the cover drifts, soft patches of it flow over it, and a pool of
 * light wanders. Off, it's the same picture, standing still.
 */
export function Backdrop({
  src,
  animated,
  children,
}: {
  src: string | null;
  animated: boolean;
  /** Light layers drawn above the darkening but below the lyrics (the torch cursor). */
  children?: React.ReactNode;
}) {
  return (
    <div aria-hidden className="fixed inset-0 -z-10 overflow-hidden bg-neutral-950">
      <AnimatePresence>
        {src && (
          <motion.div
            key={src}
            className="absolute inset-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.6, ease: "easeInOut" }}
          >
            <CoverLayers src={src} animated={animated} />
          </motion.div>
        )}
      </AnimatePresence>
      <div
        className={`ambient-light absolute inset-0 transition-opacity duration-1000 ${animated ? "opacity-100" : "opacity-0"}`}
      />
      {/* Darken + vignette so white lyrics always read. */}
      <div className="absolute inset-0 bg-black/45" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,rgba(0,0,0,0.55)_100%)]" />
      {children}
      {/* Fine grain keeps big soft gradients from banding on TVs. */}
      <div className="ambient-grain absolute inset-0" />
    </div>
  );
}

const SIZE = 64;
const FILTER = "saturate(1.7) brightness(0.9) blur(2px)";

/**
 * The cover is drawn once into tiny pre-blurred canvases that are stretched to full screen:
 * upscaling a 64px image already gives a soft wash, so there's no live CSS blur at all, and the
 * motion is pure transform/opacity that the compositor handles without repainting, even on 4K.
 * Canvases are only displayed, never read back, so cross-origin covers work without CORS.
 */
function CoverLayers({ src, animated }: { src: string; animated: boolean }) {
  const base = useRef<HTMLCanvasElement>(null);
  const glowA = useRef<HTMLCanvasElement>(null);
  const glowB = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let cancelled = false;
    const img = new Image();
    img.onload = () => {
      if (cancelled) return;
      // Centre-crop to a square, like the cover itself.
      const side = Math.min(img.naturalWidth, img.naturalHeight);
      const sx = (img.naturalWidth - side) / 2;
      const sy = (img.naturalHeight - side) / 2;
      for (const canvas of [base.current, glowA.current, glowB.current]) {
        const ctx = canvas?.getContext("2d");
        if (!ctx) continue;
        ctx.filter = FILTER;
        // Slightly oversized so the blur doesn't pull dark edges in from outside the image.
        ctx.drawImage(img, sx, sy, side, side, -4, -4, SIZE + 8, SIZE + 8);
      }
    };
    // YouTube thumbnails without a max-res version 404; fall back like CoverImage does.
    img.onerror = () => {
      if (src.includes("maxresdefault")) img.src = src.replace("maxresdefault", "hqdefault");
    };
    img.src = src;
    return () => {
      cancelled = true;
    };
  }, [src]);

  return (
    <div className="absolute inset-0">
      <canvas ref={base} width={SIZE} height={SIZE} className={`cover-base ${animated ? "cover-base-moving" : ""}`} />
      <canvas
        ref={glowA}
        width={SIZE}
        height={SIZE}
        className={`cover-glow cover-glow-a transition-opacity duration-1000 ${animated ? "opacity-75" : "opacity-0"}`}
      />
      <canvas
        ref={glowB}
        width={SIZE}
        height={SIZE}
        className={`cover-glow cover-glow-b transition-opacity duration-1000 ${animated ? "opacity-60" : "opacity-0"}`}
      />
    </div>
  );
}

