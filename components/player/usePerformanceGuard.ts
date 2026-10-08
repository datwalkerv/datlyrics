"use client";

import { useEffect, useRef } from "react";

/** Likely too weak for the moving background: few cores, little memory, or reduced motion asked. */
export function isLowEndDevice(): boolean {
  if (typeof window === "undefined") return false;
  const nav = navigator as Navigator & { deviceMemory?: number };
  return (
    (navigator.hardwareConcurrency ?? 8) <= 4 ||
    (nav.deviceMemory ?? 8) <= 4 ||
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

const SLOW_FRAME_MS = 22; // ~45 fps
const SLOW_SECONDS = 4;
// Sample in bursts: a continuous rAF loop would itself make the page render every frame.
const SAMPLE_MS = 6000;
const PAUSE_MS = 24000;

/**
 * While background effects are on, watches the frame rate; if frames stay slow for a few seconds,
 * calls `onSlow` (which turns effects off). Once the user turns effects back on by hand, it trusts
 * them for the rest of the session.
 */
export function usePerformanceGuard({
  effects,
  manualOverride,
  onSlow,
}: {
  effects: boolean;
  /** True once the user re-enabled effects themselves after an automatic switch-off. */
  manualOverride: boolean;
  onSlow: () => void;
}) {
  const onSlowRef = useRef(onSlow);
  useEffect(() => {
    onSlowRef.current = onSlow;
  });

  useEffect(() => {
    if (!effects || manualOverride) return;
    let raf = 0;
    let pause: ReturnType<typeof setTimeout> | undefined;
    let last = 0;
    let deltas: number[] = [];
    let windowStart = 0;
    let slowSeconds = 0;
    let burstEnd = 0;

    const startBurst = () => {
      last = 0;
      deltas = [];
      windowStart = 0;
      slowSeconds = 0;
      burstEnd = performance.now() + SAMPLE_MS;
      raf = requestAnimationFrame(tick);
    };

    const tick = (now: number) => {
      if (now > burstEnd) {
        pause = setTimeout(startBurst, PAUSE_MS);
        return;
      }
      if (last && document.visibilityState === "visible") {
        deltas.push(now - last);
        if (!windowStart) windowStart = now;
        if (now - windowStart >= 1000) {
          const sorted = deltas.sort((a, b) => a - b);
          const median = sorted[Math.floor(sorted.length / 2)];
          slowSeconds = median > SLOW_FRAME_MS ? slowSeconds + 1 : 0;
          deltas = [];
          windowStart = now;
          if (slowSeconds >= SLOW_SECONDS) {
            onSlowRef.current();
            return;
          }
        }
      }
      last = now;
      raf = requestAnimationFrame(tick);
    };
    // Give the page a moment to settle (cover loading, player start) before the first burst.
    pause = setTimeout(startBurst, 3000);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(pause);
    };
  }, [effects, manualOverride]);
}
