"use client";

import { motion, useDragControls } from "motion/react";
import { useEffect, useRef } from "react";

/**
 * Bottom sheet for touch screens: slides up, drag the handle down or tap outside to close. Render it inside
 * <AnimatePresence> so it slides back out.
 */
export function Sheet({
  onClose,
  label,
  children,
  className = "",
}: {
  onClose: () => void;
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  // Drag only from the handle, so lists inside still scroll.
  const drag = useDragControls();
  // Close on a tap that starts on the backdrop, not the release of the long-press that opened us.
  const downOnBackdrop = useRef(false);
  useEffect(() => {
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <motion.div
      className="cursor-show fixed inset-0 z-50 flex items-end bg-black/50 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onPointerDown={(e) => (downOnBackdrop.current = e.target === e.currentTarget)}
      onClick={(e) => e.target === e.currentTarget && downOnBackdrop.current && onClose()}
    >
      <motion.div
        ref={ref}
        role="dialog"
        aria-modal
        aria-label={label}
        tabIndex={-1}
        className={`pb-safe flex max-h-[88dvh] w-full flex-col rounded-t-3xl bg-neutral-900/90 text-white shadow-[0_-30px_80px_-20px_rgba(0,0,0,0.7)] ring-1 ring-white/10 outline-none backdrop-blur-2xl ${className}`}
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", stiffness: 320, damping: 34 }}
        drag="y"
        dragControls={drag}
        dragListener={false}
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0, bottom: 0.6 }}
        onDragEnd={(_, info) => (info.offset.y > 100 || info.velocity.y > 500) && onClose()}
      >
        <div className="flex shrink-0 touch-none justify-center pb-2 pt-3" aria-hidden onPointerDown={(e) => drag.start(e)}>
          <div className="h-1.5 w-10 rounded-full bg-white/25" />
        </div>
        {children}
      </motion.div>
    </motion.div>
  );
}
