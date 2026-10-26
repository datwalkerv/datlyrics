import { describe, expect, it } from "vitest";
import { parseArtist } from "../artist-source";
import { cleanTitle } from "../clean-title";
import { activeLineIndex, parseLrc } from "../lrc";
import { parseYouTubeUrl } from "../parse-youtube-url";

describe("parseYouTubeUrl", () => {
  it.each([
    ["https://www.youtube.com/watch?v=fJ9rUzIMcZQ", { videoId: "fJ9rUzIMcZQ" }],
    ["youtu.be/fJ9rUzIMcZQ?si=abc", { videoId: "fJ9rUzIMcZQ" }],
    ["https://music.youtube.com/watch?v=fJ9rUzIMcZQ&list=RDAMVMfJ9rUzIMcZQ", { videoId: "fJ9rUzIMcZQ", listId: "RDAMVMfJ9rUzIMcZQ" }],
    ["https://www.youtube.com/playlist?list=PLx0sYbCqOb8TBPRdmBHs5Iftvv9TPboYG", { listId: "PLx0sYbCqOb8TBPRdmBHs5Iftvv9TPboYG" }],
    ["https://m.youtube.com/shorts/fJ9rUzIMcZQ", { videoId: "fJ9rUzIMcZQ" }],
    ["fJ9rUzIMcZQ", { videoId: "fJ9rUzIMcZQ" }],
  ])("%s", (input, expected) => expect(parseYouTubeUrl(input)).toEqual(expected));

  it("rejects non-YouTube input", () => {
    expect(parseYouTubeUrl("https://vimeo.com/123")).toBeNull();
    expect(parseYouTubeUrl("hello world")).toBeNull();
  });
});

describe("cleanTitle", () => {
  it.each([
    ["Queen – Bohemian Rhapsody (Official Video Remastered)", "Queen Official", { artist: "Queen", title: "Bohemian Rhapsody" }],
    ["The Weeknd - Blinding Lights (Official Audio)", "TheWeekndVEVO", { artist: "The Weeknd", title: "Blinding Lights" }],
    ["Daft Punk - Get Lucky [Official Music Video] ft. Pharrell", "Daft Punk", { artist: "Daft Punk", title: "Get Lucky ft. Pharrell" }],
    ["Bohemian Rhapsody - Remastered 2011", "Queen - Topic", { artist: "Queen", title: "Bohemian Rhapsody" }],
    ["Hello", "AdeleVEVO", { artist: "Adele", title: "Hello" }],
  ])("%s", (title, channel, expected) => expect(cleanTitle(title, channel)).toEqual(expected));
});

describe("lrc", () => {
  const lines = parseLrc("[ar:Queen]\n[00:00.15] Is this the real life?\n[00:07.13]Caught in a landslide\n[00:10.00][00:20.50]Repeat\n[00:30.00]");
  it("parses lines, repeated tags and empty lines", () => {
    expect(lines.map((l) => [l.time, l.text])).toEqual([
      [0.15, "Is this the real life?"],
      [7.13, "Caught in a landslide"],
      [10, "Repeat"],
      [20.5, "Repeat"],
      [30, ""],
    ]);
  });
  it("finds the active line", () => {
    expect(activeLineIndex(lines, 0)).toBe(-1);
    expect(activeLineIndex(lines, 8)).toBe(1);
    expect(activeLineIndex(lines, 99)).toBe(4);
  });
});

import { mapTimeByLyrics } from "../lrc";

describe("mapTimeByLyrics", () => {
  const song = parseLrc("[00:05.00]Intro line\n[00:10.00]Chorus\n[00:20.00]Verse\n[00:30.00]Chorus");
  const video = parseLrc("[00:25.00]Intro line\n[00:30.00]Chorus\n[00:40.00]Verse\n[01:10.00]Chorus");
  it("maps through intros and breaks, respecting repeated lines", () => {
    expect(mapTimeByLyrics(12, song, video)).toBe(32);
    expect(mapTimeByLyrics(33, song, video)).toBe(73);
  });
  it("anchors on the last sung line during instrumental breaks", () => {
    const a = parseLrc("[00:13.13]Yeah\n[00:16.56]♪\n[00:27.16]I've been tryna call");
    const b = parseLrc("[00:35.99]Yeah\n[00:40.24]\n[00:49.90]I've been tryna call");
    expect(mapTimeByLyrics(17, a, b)).toBeCloseTo(39.86);
  });
  it("maps intro positions relative to the first sung line", () => {
    expect(mapTimeByLyrics(1, song, video)).toBe(21);
    expect(mapTimeByLyrics(1, video, song)).toBe(0);
  });
});

import { classifyUpload } from "../clean-title";

describe("classifyUpload", () => {
  it.each([
    ["GREECE", "DJ Khaled - Topic", "song"],
    ["The Weeknd - Blinding Lights (Official Audio)", "The Weeknd", "song"],
    ["The Weeknd - Blinding Lights (Lyrics)", "7clouds", "song"],
    ["The Weeknd - Blinding Lights (Official Video)", "TheWeekndVEVO", "video"],
    ["DJ Khaled ft. Drake - GREECE (Official Visualizer)", "DJKhaledVEVO", "video"],
    ["Hazetomika-BEVAGYALLVA", "csovi", "other"],
  ])("%s", (title, channel, kind) => expect(classifyUpload(title, channel)).toBe(kind));
});

describe("parseArtist", () => {
  const runs = (...t: string[]) => ({ runs: t.map((text) => ({ text })) });
  const thumbs = (url: string) => ({ thumbnails: [{ url: `${url}-small`, width: 60 }, { url, width: 544 }] });
  const twoRow = (title: string, sub: string[], listId: string) => ({
    musicTwoRowItemRenderer: {
      title: runs(title),
      subtitle: runs(...sub),
      thumbnailRenderer: { musicThumbnailRenderer: { thumbnail: thumbs(`img:${title}`) } },
      thumbnailOverlay: { content: { watchPlaylistEndpoint: { playlistId: listId } } },
    },
  });
  // Trimmed from a real music.youtube.com artist `browse` response.
  const response = {
    header: { musicImmersiveHeaderRenderer: { title: runs("Don Toliver"), thumbnail: thumbs("banner") } },
    contents: {
      sectionListRenderer: {
        contents: [
          {
            musicShelfRenderer: {
              title: { runs: [{ text: "Top songs", navigationEndpoint: { browseEndpoint: { browseId: "VLOLAK5uy_songs" } } }] },
              contents: [
                {
                  musicResponsiveListItemRenderer: {
                    playlistItemData: { videoId: "KIXP--0-Tac" },
                    flexColumns: ["No Pole", "Don Toliver", "100M plays", "Love Sick (Deluxe)"].map((t) => ({
                      musicResponsiveListItemFlexColumnRenderer: { text: runs(t) },
                    })),
                  },
                },
                { musicResponsiveListItemRenderer: { flexColumns: [] } },
              ],
            },
          },
          { musicCarouselShelfRenderer: { header: { title: runs("Albums") }, contents: [twoRow("OCTANE", ["2026"], "OLAK5uy_octane")] } },
          {
            musicCarouselShelfRenderer: {
              header: { title: runs("Singles & EPs") },
              contents: [twoRow("CHOPTANE", ["EP", " • ", "2026"], "OLAK5uy_chop"), twoRow("No list", ["2020"], "PLnotanalbum")],
            },
          },
        ],
      },
    },
  };

  it("reads the header, top songs, albums and singles", () => {
    expect(parseArtist(response)).toEqual({
      name: "Don Toliver",
      image: "banner",
      songs: [{ id: "KIXP--0-Tac", title: "No Pole", album: "Love Sick (Deluxe)", image: null }],
      allSongsListId: "OLAK5uy_songs",
      albums: [{ listId: "OLAK5uy_octane", title: "OCTANE", year: "2026", image: "img:OCTANE" }],
      singles: [{ listId: "OLAK5uy_chop", title: "CHOPTANE", year: "2026", image: "img:CHOPTANE" }],
    });
  });

  it("returns null without an artist header", () => {
    expect(parseArtist({ contents: {} })).toBeNull();
  });
});
