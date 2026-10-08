"use client";

import { useEffect, useRef } from "react";

/**
 * Full-screen backdrop built from the cover art, rendered into ONE small canvas that the browser
 * stretches to full screen. Everything in it (the blurred cover, the soft patches flowing over it,
 * a wandering light, the darkening and vignette) is drawn into ~200px of canvas, so each frame is a
 * tiny upload plus one full-screen blit, instead of the GPU blending half a dozen moving
 * full-screen layers per frame. It's all heavy blur, so the low resolution is invisible.
 *
 * Effects off: the same picture, drawn once and left still. Effects on: it moves, redrawn at ~30
 * fps (the motion is slow enough that more frames wouldn't show). Toggling eases the motion in/out.
 */
export function Backdrop({
  src,
  animated,
  children,
}: {
  src: string | null;
  animated: boolean;
  /** Light layers drawn above the backdrop but below the lyrics (the torch cursor). */
  children?: React.ReactNode;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engine = useRef<ReturnType<typeof createEngine> | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const e = createEngine(canvas);
    engine.current = e;
    return () => {
      e.destroy();
      engine.current = null;
    };
  }, []);

  useEffect(() => {
    engine.current?.setAnimated(animated);
  }, [animated]);

  useEffect(() => {
    if (src) engine.current?.setCover(src);
  }, [src]);

  return (
    <div aria-hidden className="fixed inset-0 -z-10 overflow-hidden bg-neutral-950">
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
      {children}
      {/* Fine grain keeps the soft gradients from banding on TVs (static, so it costs nothing). */}
      <div className="ambient-grain absolute inset-0" />
    </div>
  );
}

const SRC_SIZE = 64; // pre-blurred cover sources
const LONG_SIDE = 200; // backdrop canvas resolution (long side)
const FRAME_MS = 33; // ~30 fps while moving
const FADE_S = 1.6; // cover crossfade
const RAMP_S = 1; // effects on/off ease
const FILTER = "saturate(1.7) brightness(0.9) blur(2px)";
const TAU = Math.PI * 2;

type Scene = { base: HTMLCanvasElement; glow: HTMLCanvasElement; alpha: number; target: number };

function makeSources(img: HTMLImageElement): Pick<Scene, "base" | "glow"> {
  const side = Math.min(img.naturalWidth, img.naturalHeight);
  const sx = (img.naturalWidth - side) / 2;
  const sy = (img.naturalHeight - side) / 2;
  const draw = (round: boolean) => {
    const c = document.createElement("canvas");
    c.width = c.height = SRC_SIZE;
    const ctx = c.getContext("2d")!;
    ctx.filter = FILTER;
    // Slightly oversized so the blur doesn't pull dark edges in from outside the image.
    ctx.drawImage(img, sx, sy, side, side, -4, -4, SRC_SIZE + 8, SRC_SIZE + 8);
    if (round) {
      // The patches' soft round edge, baked in once.
      ctx.filter = "none";
      ctx.globalCompositeOperation = "destination-in";
      const r = SRC_SIZE / 2;
      const g = ctx.createRadialGradient(r, r, r * 0.4, r, r, r);
      g.addColorStop(0, "#000");
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, SRC_SIZE, SRC_SIZE);
    }
    return c;
  };
  return { base: draw(false), glow: draw(true) };
}

const approach = (value: number, target: number, maxStep: number) =>
  value + Math.sign(target - value) * Math.min(Math.abs(target - value), maxStep);

function createEngine(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext("2d", { alpha: false })!;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let W = 0;
  let H = 0;
  let scenes: Scene[] = [];
  let animated = false;
  let fx = 0; // 0 = still, 1 = full motion (eased on toggle)
  let t = 0; // motion time; only advances while moving, so stopping freezes in place
  let last = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let raf = 0;
  let loadSeq = 0;

  const drawLayer = (img: HTMLCanvasElement, x: number, y: number, size: number, rot: number, scale: number) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.scale(scale, scale);
    ctx.drawImage(img, -size / 2, -size / 2, size, size);
    ctx.restore();
  };

  const render = () => {
    const vmax = Math.max(W, H) / 100;
    const cx = W / 2;
    const cy = H / 2;
    ctx.globalAlpha = 1;
    ctx.fillStyle = "#0a0a0a";
    ctx.fillRect(0, 0, W, H);

    for (const s of scenes) {
      // Base: the cover, far bigger than the screen, drifting, turning and breathing.
      const w = TAU / 44;
      ctx.globalAlpha = s.alpha;
      drawLayer(
        s.base,
        cx + fx * 6 * vmax * Math.sin(w * t),
        cy - fx * 5 * vmax * Math.sin(0.8 * w * t + 1),
        220 * vmax,
        fx * ((12 * Math.PI) / 180) * Math.sin(0.9 * w * t + 0.5),
        1 + fx * (0.1 + 0.1 * Math.sin(0.7 * w * t + 2)),
      );
      if (fx > 0.001) {
        // Two soft round patches of the cover flowing over it in opposite directions.
        const a = TAU / 30;
        ctx.globalAlpha = s.alpha * fx * 0.75;
        drawLayer(
          s.glow,
          cx + (-2 + 34 * Math.sin(a * t)) * vmax,
          cy + (-1 + 17 * Math.sin(a * t)) * vmax,
          80 * vmax,
          (TAU * t) / 25,
          1.05 + 0.2 * Math.sin(a * t),
        );
        const b = TAU / 38;
        ctx.globalAlpha = s.alpha * fx * 0.6;
        drawLayer(
          s.glow,
          cx + (2 - 32 * Math.sin(b * t)) * vmax,
          cy + (1 + 21 * Math.sin(b * t)) * vmax,
          64 * vmax,
          (-TAU * t) / 30,
          1 - 0.2 * Math.sin(b * t),
        );
      }
    }

    // A faint pool of light wandering slowly.
    if (fx > 0.001) {
      const l = TAU / 50;
      ctx.save();
      ctx.globalAlpha = fx;
      ctx.translate(W * (0.5 + 0.2 * Math.sin(l * t)), H * (0.5 + 0.18 * Math.sin(1.3 * l * t + 1)));
      ctx.scale(W * 0.4, H * 0.5);
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
      g.addColorStop(0, "rgba(255,255,255,0.05)");
      g.addColorStop(0.7, "rgba(255,255,255,0)");
      ctx.fillStyle = g;
      ctx.fillRect(-1, -1, 2, 2);
      ctx.restore();
    }

    // Darken + vignette so white lyrics always read (baked in: no extra full-screen layers).
    ctx.globalAlpha = 1;
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.fillRect(0, 0, W, H);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale((W / 2) * Math.SQRT2, (H / 2) * Math.SQRT2);
    const v = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
    v.addColorStop(0, "rgba(0,0,0,0)");
    v.addColorStop(1, "rgba(0,0,0,0.55)");
    ctx.fillStyle = v;
    ctx.fillRect(-1, -1, 2, 2);
    ctx.restore();
  };

  const step = (now: number) => {
    raf = 0;
    const dt = last ? Math.min((now - last) / 1000, 0.1) : 0;
    last = now;
    const want = animated && !reduced ? 1 : 0;
    fx = approach(fx, want, dt / RAMP_S);
    t += dt * fx;
    for (const s of scenes) s.alpha = approach(s.alpha, s.target, dt / FADE_S);
    scenes = scenes.filter((s) => s.target > 0 || s.alpha > 0);
    render();
    const busy = fx > 0 || want > 0 || scenes.some((s) => s.alpha !== s.target);
    if (busy) {
      // ~30 fps: wait on a timer, then take a frame, so we don't request one every vsync.
      timer = setTimeout(() => {
        timer = undefined;
        raf = requestAnimationFrame(step);
      }, FRAME_MS - 16);
    } else {
      last = 0; // still: nothing to redraw until something changes
    }
  };

  const wake = () => {
    if (raf) return;
    if (timer) {
      clearTimeout(timer);
      timer = undefined;
    }
    raf = requestAnimationFrame(step);
  };

  const resize = () => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    W = vw >= vh ? LONG_SIDE : Math.max(1, Math.round((LONG_SIDE * vw) / vh));
    H = vw >= vh ? Math.max(1, Math.round((LONG_SIDE * vh) / vw)) : LONG_SIDE;
    canvas.width = W;
    canvas.height = H;
    wake();
  };

  window.addEventListener("resize", resize);
  resize();

  return {
    setAnimated(v: boolean) {
      animated = v;
      wake();
    },
    setCover(src: string) {
      const seq = ++loadSeq;
      const img = new Image();
      img.onload = () => {
        if (seq !== loadSeq) return;
        for (const s of scenes) s.target = 0; // the previous cover fades out
        scenes.push({ ...makeSources(img), alpha: 0, target: 1 });
        wake();
      };
      // YouTube thumbnails without a max-res version 404; fall back like CoverImage does.
      img.onerror = () => {
        if (src.includes("maxresdefault")) img.src = src.replace("maxresdefault", "hqdefault");
      };
      img.src = src;
    },
    destroy() {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(raf);
      clearTimeout(timer);
    },
  };
}
