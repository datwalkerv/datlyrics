export type SongInfo = { artist: string; title: string };

// Noise commonly appended to music video titles.
const NOISE =
  /\s*[\(\[【](?:[^\)\]】]*?(?:official|video|audio|lyrics?|visuali[sz]er|mv|m\/v|hd|hq|4k|remaster(?:ed)?|live|explicit|clean|color coded|performance|music video|from)[^\)\]】]*?)[\)\]】]/gi;

const SEPARATORS = [" - ", " – ", " — ", " -- ", " | ", " ~ "];

export function cleanChannel(channel: string): string {
  return channel
    .replace(/\s*-\s*Topic$/i, "")
    .replace(/VEVO$/i, "")
    .replace(/\s*(Official|Music|Records|TV)$/gi, "")
    .replace(/\s*Official\s*(YouTube\s*)?(Channel)?$/i, "")
    .trim();
}

function stripNoise(s: string): string {
  return s
    .replace(NOISE, "")
    .replace(/\s*\|\s*.*$/, "") // "Title | Some Show"
    .replace(/\s*(?:official\s+)?(?:music\s+)?video$/i, "")
    .replace(/["“”]/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/** Strip featured artists for search: "Song (feat. X)" -> "Song". */
export function withoutFeat(s: string): string {
  return s.replace(/\s*[\(\[]?\s*(?:feat\.?|ft\.?|featuring|with)\s+[^\)\]]*[\)\]]?/gi, "").trim();
}

/** "Artist - Title (Official Video) [4K]" -> { artist, title } */
export function cleanTitle(rawTitle: string, channel = ""): SongInfo {
  // Auto-generated "Artist - Topic" uploads: the title is just the song name.
  if (/\s-\sTopic$/i.test(channel)) {
    const title = stripNoise(rawTitle.replace(/\s+[-–—]\s+(?:\d{4}\s+)?remaster(?:ed)?.*$/i, ""));
    return { artist: cleanChannel(channel), title: title || rawTitle };
  }
  const noNoise = rawTitle.replace(NOISE, "");
  for (const sep of SEPARATORS) {
    const i = noNoise.indexOf(sep);
    if (i > 0) {
      const artist = stripNoise(noNoise.slice(0, i));
      const title = stripNoise(noNoise.slice(i + sep.length));
      if (artist && title) return { artist, title };
    }
  }
  return { artist: cleanChannel(channel), title: stripNoise(rawTitle) || rawTitle };
}

export type UploadKind = "song" | "video" | "other";

/**
 * Rough YouTube Music classification of an upload: "song" = audio track (Topic uploads, official
 * audio, lyric videos), "video" = a music video or visualizer.
 */
export function classifyUpload(rawTitle: string, channel: string): UploadKind {
  if (/\s-\sTopic$/i.test(channel)) return "song";
  // Visualizers sit on YouTube Music's video side, so they count as videos.
  if (/official\s+(music\s+)?video|visuali[sz]er|\bm\/?v\b|\(video\)|\[video\]/i.test(rawTitle)) return "video";
  if (/\b(official\s+)?(audio|lyrics?(\s+video)?)\b/i.test(rawTitle)) return "song";
  if (/vevo$/i.test(channel)) return "video";
  return "other";
}
