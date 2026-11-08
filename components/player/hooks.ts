"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";

/** True once the pointer has been idle for `ms`; flips back on any movement. */
export function useIdle(ms = 2500, enabled = true): boolean {
  const [idle, setIdle] = useState(false);
  useEffect(() => {
    if (!enabled) return;
    let timer = setTimeout(() => setIdle(true), ms);
    const wake = () => {
      setIdle(false);
      clearTimeout(timer);
      timer = setTimeout(() => setIdle(true), ms);
    };
    const events = ["mousemove", "mousedown", "touchstart", "wheel"] as const;
    events.forEach((e) => window.addEventListener(e, wake, { passive: true }));
    return () => {
      clearTimeout(timer);
      events.forEach((e) => window.removeEventListener(e, wake));
    };
  }, [ms, enabled]);
  return enabled && idle;
}

export function toggleFullscreen() {
  if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  else document.documentElement.requestFullscreen?.().catch(() => {});
}

export function useKeyboard(handlers: Record<string, (e: KeyboardEvent) => void>) {
  // Always dispatch to the latest handlers, so they never act on stale state.
  const ref = useRef(handlers);
  useEffect(() => {
    ref.current = handlers;
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const fn = ref.current[e.key] ?? ref.current[e.key.toLowerCase()];
      if (fn) {
        e.preventDefault();
        fn(e);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}

/** One press is tracked at a time (one finger opens one menu), so plain props work inside lists. */
const press = { timer: undefined as ReturnType<typeof setTimeout> | undefined, x: 0, y: 0, active: false, fired: false };
const cancelPress = () => {
  clearTimeout(press.timer);
  press.active = false;
};

/**
 * Long-press for touch, the phone's right-click: iOS never fires contextmenu. Spread the props on
 * the element next to its onContextMenu; the handler gets the pointer event (a MouseEvent), so
 * menu helpers built for right-click work unchanged. The click that ends a long-press is swallowed.
 */
export function longPress(onLongPress: (e: React.PointerEvent) => void, ms = 450) {
  return {
    onPointerDown: (e: React.PointerEvent) => {
      press.fired = false;
      if (e.pointerType === "mouse") return;
      cancelPress();
      Object.assign(press, { x: e.clientX, y: e.clientY, active: true });
      const target = e.currentTarget;
      // menuAt reads currentTarget and calls preventDefault after the event is long gone.
      const ev = { clientX: e.clientX, clientY: e.clientY, currentTarget: target, preventDefault: () => {} };
      press.timer = setTimeout(() => {
        press.active = false;
        press.fired = true;
        onLongPress(ev as unknown as React.PointerEvent);
      }, ms);
    },
    onPointerMove: (e: React.PointerEvent) => {
      if (press.active && Math.hypot(e.clientX - press.x, e.clientY - press.y) > 10) cancelPress();
    },
    onPointerUp: cancelPress,
    onPointerCancel: cancelPress,
    // Android fires its own contextmenu a moment later: the menu is already open.
    onContextMenuCapture: (e: React.MouseEvent) => {
      if (press.fired) {
        e.preventDefault();
        e.stopPropagation();
      }
    },
    onClickCapture: (e: React.MouseEvent) => {
      if (press.fired) {
        e.preventDefault();
        e.stopPropagation();
        press.fired = false;
      }
    },
  };
}

const COARSE = "(pointer: coarse)";
/** True on touch screens (phones, tablets): they get swipes and sheets instead of hover and right-click. */
export function useCoarsePointer(): boolean {
  return useSyncExternalStore(
    (fn) => {
      const mq = window.matchMedia(COARSE);
      mq.addEventListener("change", fn);
      return () => mq.removeEventListener("change", fn);
    },
    () => window.matchMedia(COARSE).matches,
    () => false,
  );
}
