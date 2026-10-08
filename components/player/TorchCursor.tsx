"use client";

import { useEffect, useRef } from "react";

/**
 * The player's cursor: the real one is hidden, and a barely-there soft light follows the mouse
 * instead (gliding a touch behind it). It brightens slightly over clickable things and while
 * pressed, and fades out while idle and over the .cursor-show zones, where the real cursor shows.
 */
// What counts as clickable for the hover brightening: links, buttons, the seek bar, lyric lines.
const CLICKABLE = 'a, button, [role="slider"], [data-clickable]';

export function TorchCursor({ active }: { active: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const activeRef = useRef(active);

  useEffect(() => {
    activeRef.current = active;
  }, [active]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let x = window.innerWidth / 2;
    let y = window.innerHeight / 2;
    let tx = x;
    let ty = y;
    let seen = false;
    let overZone = false;
    let raf = 0;

    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      tx = e.clientX;
      ty = e.clientY;
      // Start where the mouse is, instead of flying in from the centre.
      if (!seen) {
        x = tx;
        y = ty;
        seen = true;
      }
      const target = e.target instanceof Element ? e.target : null;
      el.dataset.hover = String(!!target?.closest(CLICKABLE));
      // Where the real cursor shows (progress bar, search, queue), the torch steps aside.
      overZone = !!target?.closest(".cursor-show");
    };
    const onDown = () => (el.dataset.press = "true");
    const onUp = () => (el.dataset.press = "false");

    // Critically damped spring (frame-rate independent): eases in and settles without overshoot.
    const STIFFNESS = 90;
    const DAMPING = 2 * Math.sqrt(STIFFNESS);
    let vx = 0;
    let vy = 0;
    let swell = 1;
    let last = performance.now();

    const tick = (now: number) => {
      const dt = Math.min((now - last) / 1000, 1 / 20);
      last = now;
      if (reduced) {
        x = tx;
        y = ty;
      } else {
        vx += ((tx - x) * STIFFNESS - vx * DAMPING) * dt;
        vy += ((ty - y) * STIFFNESS - vy * DAMPING) * dt;
        x += vx * dt;
        y += vy * dt;
      }
      // Swell a little with speed, easing back as the mouse slows.
      const speed = Math.hypot(vx, vy);
      const target = 1 + Math.min(speed / 4000, 0.12);
      swell += (target - swell) * Math.min(dt * 4, 1);
      el.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${swell.toFixed(4)})`;
      el.style.opacity = seen && activeRef.current && !overZone ? "1" : "0";
      raf = requestAnimationFrame(tick);
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerdown", onDown, { passive: true });
    window.addEventListener("pointerup", onUp, { passive: true });
    raf = requestAnimationFrame(tick);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointerup", onUp);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div ref={ref} aria-hidden className="torch">
      <span className="torch-light" />
    </div>
  );
}
