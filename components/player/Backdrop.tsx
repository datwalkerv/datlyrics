"use client";

import { AnimatePresence, motion } from "motion/react";
import { CoverImage } from "./CoverImage";

export function Backdrop({ src }: { src: string | null }) {
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
            <CoverImage src={src} className="backdrop-drift absolute left-1/2 top-1/2 h-[140vmax] w-[140vmax] max-w-none object-cover" />
          </motion.div>
        )}
      </AnimatePresence>
      {/* Darken + vignette so white lyrics always read. */}
      <div className="absolute inset-0 bg-black/45" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,rgba(0,0,0,0.55)_100%)]" />
    </div>
  );
}
