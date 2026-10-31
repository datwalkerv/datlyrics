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

/** A song the user added to a list, and the track that was on top when they did. */
export type Added = { id: string; before: string | null };

/**
 * A list's tracks with the user's added songs woven in: oldest add first, each goes right above the
 * track that was on top when it was added (its neighbour), or to the top if that track is gone.
 */
export function mergeAdded(live: string[], added: Added[] = []): string[] {
  const list = [...live];
  for (const a of [...added].reverse()) {
    const had = list.indexOf(a.id);
    if (had >= 0) list.splice(had, 1);
    const at = a.before ? list.indexOf(a.before) : -1;
    list.splice(Math.max(at, 0), 0, a.id);
  }
  return list;
}
