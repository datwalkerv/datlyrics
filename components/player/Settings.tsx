"use client";

import { motion } from "motion/react";
import { useRef, useState } from "react";
import { deleteAllData, exportData, importData } from "@/lib/backup";

// A backup is a few KB; anything this big isn't one.
const MAX_FILE_BYTES = 5 * 1024 * 1024;

/** Settings: export, import or delete everything datlyrics keeps in this browser. */
export function Settings({ onClose }: { onClose: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<{ text: string; error?: boolean } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > MAX_FILE_BYTES) return setStatus({ text: "That file is too big to be a datlyrics backup.", error: true });
    const n = importData(await file.text());
    setStatus(
      n === null
        ? { text: "That file isn't a datlyrics backup. Nothing was changed.", error: true }
        : { text: `Imported ${n} item${n === 1 ? "" : "s"}. Player preferences apply next time you open a song.` },
    );
  };

  return (
    <motion.div
      className="cursor-show fixed inset-0 z-50 flex items-start justify-center bg-black/40 px-4 pt-[14vh] backdrop-blur-xl"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <motion.div
        role="dialog"
        aria-modal
        aria-labelledby="settings-title"
        className="w-full max-w-lg rounded-3xl bg-neutral-900/80 p-6 text-white shadow-[0_40px_120px_-20px_rgba(0,0,0,0.8)] ring-1 ring-white/10 backdrop-blur-2xl sm:p-8"
        initial={{ opacity: 0, y: -12, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -8, scale: 0.98 }}
        transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="flex items-center justify-between">
          <h2 id="settings-title" className="text-2xl font-extrabold tracking-[-0.03em]">
            Settings
          </h2>
          <button
            onClick={onClose}
            aria-label="Close settings"
            className="flex size-8 items-center justify-center rounded-full text-white/60 transition hover:bg-white/10 hover:text-white"
          >
            <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
              <path d="M6 6l12 12M18 6 6 18" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <p className="mt-2 text-sm leading-relaxed text-white/50">
          Your saved songs and playlists, play history and player preferences live only in this browser. Back them up,
          move them to another device, or wipe them.
        </p>

        <div className="mt-6 flex flex-col divide-y divide-white/[0.07] rounded-2xl bg-white/[0.04] ring-1 ring-white/10">
          <Row title="Export your data" body="Download everything as a backup file.">
            <button
              onClick={() => {
                const n = exportData();
                setStatus({ text: `Exported ${n} item${n === 1 ? "" : "s"}.` });
              }}
              className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-neutral-950 transition hover:bg-white/90"
            >
              Export
            </button>
          </Row>
          <Row title="Import data" body="Restore a backup. It replaces what's here now.">
            <button
              onClick={() => fileRef.current?.click()}
              className="rounded-full bg-white/10 px-4 py-2 text-sm font-semibold ring-1 ring-white/15 transition hover:bg-white/20"
            >
              Import
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => {
                void onFile(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
          </Row>
          <Row title="Delete all data" body="Remove saved items, history and preferences from this browser.">
            <button
              onClick={() => {
                if (!confirmDelete) return setConfirmDelete(true);
                deleteAllData();
                setConfirmDelete(false);
                setStatus({ text: "All your data was deleted from this browser." });
              }}
              onBlur={() => setConfirmDelete(false)}
              className={`rounded-full px-4 py-2 text-sm font-semibold ring-1 transition ${
                confirmDelete
                  ? "bg-red-500 text-white ring-red-400 hover:bg-red-400"
                  : "bg-red-500/10 text-red-300 ring-red-400/30 hover:bg-red-500/20"
              }`}
            >
              {confirmDelete ? "Click to confirm" : "Delete"}
            </button>
          </Row>
        </div>

        <p role="status" className={`mt-4 min-h-5 text-sm ${status?.error ? "text-red-300" : "text-white/50"}`}>
          {status?.text}
        </p>
      </motion.div>
    </motion.div>
  );
}

function Row({ title, body, children }: { title: string; body: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 px-5 py-4">
      <div className="min-w-0">
        <p className="font-semibold">{title}</p>
        <p className="mt-0.5 text-sm text-white/45">{body}</p>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}
