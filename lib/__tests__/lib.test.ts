import { describe, expect, it } from "vitest";
import { parseBackup } from "../backup";
import { insertNext, mergeAdded } from "../queue";
import { mergeReleases, parseArtist, parsePlaylistArtists, rankArtists } from "../artist-source";
import { cleanTitle } from "../clean-title";
import { pickRedHit } from "../lyrics-source";
import { activeLineIndex, parseLrc } from "../lrc";
import { parseYouTubeUrl } from "../parse-youtube-url";
import { mergeResults } from "../search-source";
import { parseRadio } from "../video-source";

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
      albums: [{ listId: "OLAK5uy_octane", title: "OCTANE", year: "2026", image: "img:OCTANE", kind: "Album" }],
      singles: [{ listId: "OLAK5uy_chop", title: "CHOPTANE", year: "2026", image: "img:CHOPTANE", kind: "EP" }],
    });
  });

  it("returns null without an artist header", () => {
    expect(parseArtist({ contents: {} })).toBeNull();
  });
});

describe("parseRadio", () => {
  const track = (videoId: string) => ({
    playlistPanelVideoRenderer: {
      videoId,
      title: { runs: [{ text: `title:${videoId}` }] },
      shortBylineText: { runs: [{ text: `artist:${videoId}` }] },
      thumbnail: { thumbnails: [{ url: `small:${videoId}`, width: 60 }, { url: `big:${videoId}`, width: 400 }] },
    },
  });
  it("lists related tracks in order, without the seed or repeats", () => {
    const response = { contents: { tabs: [{ content: { contents: [track("seed"), track("a"), track("b"), track("a")] } }] } };
    expect(parseRadio(response, "seed")).toEqual([
      { id: "a", title: "title:a", artist: "artist:a", image: "big:a" },
      { id: "b", title: "title:b", artist: "artist:b", image: "big:b" },
    ]);
  });
});

describe("mergeResults", () => {
  const r = (id: string) => ({ id, title: id, channel: "", duration: "3:00" });
  it("puts songs first and fills the rest with videos it doesn't already have", () => {
    const songs = ["s1", "s2", "s3", "s4", "s5", "s6", "s7"].map(r);
    const videos = ["s1", "v1", "v2", "v3"].map(r);
    expect(mergeResults(songs, videos).map((x) => x.id)).toEqual(["s1", "s2", "s3", "s4", "s5", "s6", "v1", "v2"]);
  });
  it("falls back to videos when there are no songs", () => {
    expect(mergeResults([], ["v1", "v2"].map(r)).map((x) => x.id)).toEqual(["v1", "v2"]);
  });
});

describe("mergeReleases", () => {
  const rel = (listId: string, year: string) => ({ listId, title: listId, year, image: null, kind: "Single" as const });
  it("lists newest first, taking turns between artists within a year, without repeats", () => {
    const a = [rel("a26", "2026"), rel("a26b", "2026"), rel("a24", "2024")];
    const b = [rel("b26", "2026"), rel("b25", "2025"), rel("a26", "2026")];
    expect(mergeReleases([a, b]).map((r) => r.listId)).toEqual(["a26", "b26", "a26b", "b25", "a24"]);
  });
});

describe("parsePlaylistArtists", () => {
  const artist = (browseId: string) => ({
    browseEndpoint: { browseId, browseEndpointContextSupportedConfigs: { browseEndpointContextMusicConfig: { pageType: "MUSIC_PAGE_TYPE_ARTIST" } } },
  });
  const album = { browseEndpoint: { browseId: "MPREb_x", browseEndpointContextSupportedConfigs: { browseEndpointContextMusicConfig: { pageType: "MUSIC_PAGE_TYPE_ALBUM" } } } };
  const A = "UCaaaaaaaaaaaaaaaaaaaaaa";
  const B = "UCbbbbbbbbbbbbbbbbbbbbbb";
  it("collects artist credits with repeats, skipping albums and odd ids", () => {
    const rows = [{ runs: [{ navigationEndpoint: artist(A) }, { navigationEndpoint: album }] }, { runs: [{ navigationEndpoint: artist(A) }] }, { runs: [{ navigationEndpoint: artist(B) }, { navigationEndpoint: artist("UCshort") }] }];
    expect(parsePlaylistArtists({ contents: rows })).toEqual([A, A, B]);
  });
});

describe("rankArtists", () => {
  it("ranks by credits, ties in first-seen order", () => {
    expect(rankArtists(["b", "a", "c", "a", "c", "d"], 3)).toEqual(["a", "c", "b"]);
  });
});

describe("parseBackup", () => {
  const file = (data: unknown, app = "datlyrics") => JSON.stringify({ app, version: 1, exportedAt: "2026-10-30", data });
  it("keeps only datlyrics string entries", () => {
    expect(parseBackup(file({ "datlyrics:saved": "[]", "datlyrics:volume": "80", other: "x", "datlyrics:bad": 5 }))).toEqual({
      "datlyrics:saved": "[]",
      "datlyrics:volume": "80",
    });
  });
  it("rejects anything that isn't a datlyrics backup", () => {
    expect(parseBackup("not json")).toBeNull();
    expect(parseBackup(file({}, "other-app"))).toBeNull();
    expect(parseBackup(file(["datlyrics:saved"]))).toBeNull();
    expect(parseBackup("null")).toBeNull();
  });
});

describe("insertNext", () => {
  it("adds a new track right after the current one", () => {
    expect(insertNext(["a", "b", "c"], 0, ["x"])).toEqual({ queue: ["a", "x", "b", "c"], index: 0 });
  });
  it("moves an already queued track, keeping the current one current", () => {
    expect(insertNext(["a", "b", "c", "d"], 2, ["a"])).toEqual({ queue: ["b", "c", "a", "d"], index: 1 });
    expect(insertNext(["a", "b", "c", "d"], 1, ["d"])).toEqual({ queue: ["a", "b", "d", "c"], index: 1 });
  });
  it("queues a whole list in order, skipping the current track", () => {
    expect(insertNext(["a", "b", "c"], 1, ["x", "b", "a", "y"])).toEqual({ queue: ["b", "x", "a", "y", "c"], index: 0 });
  });
  it("leaves the queue alone for the current track", () => {
    expect(insertNext(["a", "b"], 1, ["b"])).toEqual({ queue: ["a", "b"], index: 1 });
  });
});

describe("pickRedHit", () => {
  const hit = (isrc: string, title: string, duration: number, artist = "Taylor Swift") => ({ isrc, title, artist, duration });

  it("picks the same song by name, closest length first", () => {
    const hits = [hit("USCJY1831958", "Shake It Off (Commentary)", 60), hit("USUG12306677", "Shake It Off (Taylor's Version)", 219.2), hit("USCJY1431349", "Shake It Off", 219.2)];
    expect(pickRedHit(hits, "Taylor Swift", "Shake It Off", 219)?.isrc).toBe("USUG12306677");
    expect(pickRedHit(hits, "Taylor Swift", "Shake It Off", 61)?.isrc).toBe("USCJY1831958");
  });

  it("ignores other songs, other artists and malformed ISRCs", () => {
    expect(pickRedHit([hit("USCJY1431349", "Blank Space", 231)], "Taylor Swift", "Shake It Off", 219)).toBeNull();
    expect(pickRedHit([hit("USCJY1431349", "Shake It Off", 219, "Someone Else")], "Taylor Swift", "Shake It Off", 219)).toBeNull();
    expect(pickRedHit([hit("../etc/passwd", "Shake It Off", 219)], "Taylor Swift", "Shake It Off", 219)).toBeNull();
  });
});

describe("mergeAdded", () => {
  it("plays added songs first, in their order, then the list", () => {
    expect(mergeAdded(["a", "b"], [{ id: "y" }, { id: "x" }])).toEqual(["y", "x", "a", "b"]);
  });
  it("plays a song that is also in the list once, with the added ones", () => {
    expect(mergeAdded(["a", "b"], [{ id: "b" }])).toEqual(["b", "a"]);
  });
  it("is just the added songs for an own list", () => {
    expect(mergeAdded([], [{ id: "y" }, { id: "x" }])).toEqual(["y", "x"]);
  });
});
