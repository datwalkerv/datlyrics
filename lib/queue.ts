/**
 * `queue` with `ids` moved (or added), in order, right after position `at`, and where the track at
 * `at` ends up. The current track itself stays where it is.
 */
export function insertNext(queue: string[], at: number, ids: string[]): { queue: string[]; index: number } {
  const current = queue[at];
  const moving = new Set(ids.filter((id) => id !== current));
  if (current === undefined || !moving.size) return { queue, index: at };
  const index = at - queue.slice(0, at).filter((x) => moving.has(x)).length;
  const next = queue.filter((x) => !moving.has(x));
  next.splice(index + 1, 0, ...moving);
  return { queue: next, index };
}
