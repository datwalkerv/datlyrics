"use client";

/** Everything datlyrics keeps in the browser lives under this localStorage prefix. */
const PREFIX = "datlyrics:";
const APP = "datlyrics";
const VERSION = 1;

type Backup = { app: typeof APP; version: number; exportedAt: string; data: Record<string, string> };

function ownKeys(): string[] {
  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k?.startsWith(PREFIX)) keys.push(k);
  }
  return keys;
}

// The saved/history stores also listen for "storage", so this refreshes every open view.
const notify = () => window.dispatchEvent(new StorageEvent("storage"));

/** Download all of this browser's datlyrics data as a JSON file. Returns how many entries it holds. */
export function exportData(): number {
  const data = Object.fromEntries(ownKeys().map((k) => [k, localStorage.getItem(k) ?? ""]));
  const backup: Backup = { app: APP, version: VERSION, exportedAt: new Date().toISOString(), data };
  const url = URL.createObjectURL(new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `datlyrics-backup-${backup.exportedAt.slice(0, 10)}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return Object.keys(data).length;
}

/** The entries in a backup file's text, or null if it isn't a datlyrics backup. Only datlyrics keys get through. */
export function parseBackup(text: string): Record<string, string> | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return null;
  }
  const b = parsed as Partial<Backup> | null;
  if (!b || b.app !== APP || typeof b.data !== "object" || b.data === null || Array.isArray(b.data)) return null;
  const entries = Object.entries(b.data).filter(([k, v]) => k.startsWith(PREFIX) && typeof v === "string");
  return Object.fromEntries(entries);
}

/** Replace this browser's datlyrics data with a backup's. Returns how many entries were restored, or null for a bad file. */
export function importData(text: string): number | null {
  const data = parseBackup(text);
  if (!data) return null;
  for (const k of ownKeys()) localStorage.removeItem(k);
  for (const [k, v] of Object.entries(data)) localStorage.setItem(k, v);
  notify();
  return Object.keys(data).length;
}

/** Forget everything: saved songs and playlists, history and preferences. */
export function deleteAllData() {
  for (const k of ownKeys()) localStorage.removeItem(k);
  notify();
}
