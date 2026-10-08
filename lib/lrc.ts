export type LyricLine = { time: number; text: string };

const TIME_TAG = /\[(\d{1,3}):(\d{1,2}(?:[.:]\d{1,3})?)\]/g;

export function parseLrc(lrc: string): LyricLine[] {
  const lines: LyricLine[] = [];
  for (const row of lrc.split(/\r?\n/)) {
    const times: number[] = [];
    let m: RegExpExecArray | null;
    TIME_TAG.lastIndex = 0;
    let lastEnd = 0;
    while ((m = TIME_TAG.exec(row))) {
      times.push(Number(m[1]) * 60 + Number(m[2].replace(":", ".")));
      lastEnd = TIME_TAG.lastIndex;
    }
    if (!times.length) continue; // metadata ([ar:], [ti:]…) or junk
    const text = row
      .slice(lastEnd)
      .replace(/<\d{1,3}:\d{1,2}(?:\.\d{1,3})?>/g, "") // enhanced-LRC word tags
      .trim();
    for (const time of times) lines.push({ time, text });
  }
  return lines.sort((a, b) => a.time - b.time);
}

/** Index of the last line whose time is <= t, or -1 before the first line. */
export function activeLineIndex(lines: LyricLine[], t: number): number {
  let lo = 0;
  let hi = lines.length - 1;
  let ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (lines[mid].time <= t) {
      ans = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  return ans;
}

const normLine = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");

/**
 * Pair up the sung lines of two versions of a song (e.g. album audio vs. music video, which add
 * intros, skits or breaks) with a longest-common-subsequence alignment on the line text. Unlike
 * matching line-by-line, this stays correct for hooks that repeat dozens of times and for LRCs
 * that split a line differently.
 */
export function alignLyrics(from: LyricLine[], to: LyricLine[]): [number, number][] {
  const a = from.map((l) => normLine(l.text));
  const b = to.map((l) => normLine(l.text));
  const n = a.length;
  const m = b.length;
  // dp[i][j] = LCS length of a[i:] and b[j:]
  const dp = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = a[i] && a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const pairs: [number, number][] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] && a[i] === b[j]) {
      pairs.push([from[i].time, to[j].time]);
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) i++;
    else j++;
  }
  return pairs;
}

/**
 * Map a playback position from one version's timeline to another's using aligned line pairs:
 * keep the same distance from the nearest aligned line at or before `t` (or the first one, in
 * the intro). Returns null when the versions share too few lines to trust the mapping.
 */
export function mapTimeByLyrics(t: number, from: LyricLine[], to: LyricLine[]): number | null {
  const pairs = alignLyrics(from, to);
  const sung = from.filter((l) => normLine(l.text)).length;
  if (pairs.length < Math.max(2, sung * 0.5)) return null;
  let k = 0;
  while (k + 1 < pairs.length && pairs[k + 1][0] <= t) k++;
  const [fa, tb] = pairs[k];
  return Math.max(tb + (t - fa), 0);
}

/** Lines like "♪" or "" mark instrumental passages rather than words to sing. */
export const isInstrumentalLine = (text: string) => !normLine(text);
