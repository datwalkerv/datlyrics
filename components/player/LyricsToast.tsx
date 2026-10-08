"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";

/** Shows once per mount for a few seconds; key it by track so each track gets its own toast. */
export function LyricsToast({ message }: { message: string }) {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setVisible(false), 3500);
    return () => clearTimeout(t);
  }, []);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="pointer-events-none fixed bottom-8 left-1/2 z-30 -translate-x-1/2 rounded-full bg-black/45 px-5 py-2.5 text-sm font-semibold text-white/85 shadow-xl ring-1 ring-white/10 backdrop-blur-xl"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 8 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        >
          {message}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
