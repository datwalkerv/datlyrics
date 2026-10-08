import { describe, expect, it } from "vitest";
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
