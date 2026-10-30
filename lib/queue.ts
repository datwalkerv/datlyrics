/**
 * `queue` with `id` moved (or added) right after position `at`, and where the track at `at` ends
 * up. Playing the current track next does nothing.
 */
export function insertNext(queue: string[], at: number, id: string): { queue: string[]; index: number } {
  const current = queue[at];
  if (current === undefined || current === id) return { queue, index: at };
  const index = at - queue.slice(0, at).filter((x) => x === id).length;
  const next = queue.filter((x) => x !== id);
  next.splice(index + 1, 0, id);
  return { queue: next, index };
}
