import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// findLyrics is a "use cache" function; outside Next its cache helpers are no-ops.
vi.mock("next/cache", () => ({ cacheLife: () => {} }));

const SYNCED = (text: string) => `[00:01.00]${text}\n[00:03.00]second line`;
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

type Route = (url: URL, init?: RequestInit) => Response;

/** Fakes LRCLIB, lrc.red and datlrc; records every request so tests can check what was asked. */
function serve(routes: { lrclib: Route; lrcred: Route; datlrc: Route }) {
  const calls: { url: URL; init?: RequestInit }[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string, init?: RequestInit) => {
      const url = new URL(input);
      calls.push({ url, init });
      if (url.host === "lrclib.net") return routes.lrclib(url, init);
      if (url.host === "lrc.red") return routes.lrcred(url, init);
      return routes.datlrc(url, init);
    }),
  );
  return calls;
}

const down = () => new Response("", { status: 503 });
const missing = () => new Response("", { status: 404 });
const redHas = (lrc: string, duration = 200): Route => (url) =>
  url.pathname === "/search.json"
    ? json({ hits: [{ isrc: "USAAA1234567", title: "Song", artist: "Artist", duration }] })
    : new Response(lrc);

async function lookup() {
  const { findLyrics } = await import("../lyrics-source");
  return findLyrics("Artist", "Song", 200);
}

beforeEach(() => {
  vi.resetModules();
  vi.stubEnv("LYRICS_API", "https://datlrc.test/api");
  vi.stubEnv("LYRICS_API_KEY", "dlrc_test");
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("findLyrics source order", () => {
  it("uses LRCLIB's synced lyrics without asking lrc.red or datlrc", async () => {
    const calls = serve({
      lrclib: (url) =>
        url.pathname.endsWith("/get")
          ? json({ id: 1, trackName: "Song", artistName: "Artist", duration: 200, instrumental: false, plainLyrics: "x", syncedLyrics: SYNCED("from lrclib") })
          : json([]),
      lrcred: () => {
        throw new Error("lrc.red should not be asked");
      },
      datlrc: () => {
        throw new Error("datlrc should not be asked");
      },
    });
    expect((await lookup()).synced?.[0].text).toBe("from lrclib");
    expect(calls.every((c) => c.url.host === "lrclib.net")).toBe(true);
  });

  it("falls back to lrc.red's timed lyrics when LRCLIB is down", async () => {
    serve({ lrclib: down, lrcred: redHas(SYNCED("from lrc.red")), datlrc: missing });
    expect((await lookup()).synced?.[0].text).toBe("from lrc.red");
  });

  it("falls back to datlrc when LRCLIB is down and lrc.red only has untimed lyrics", async () => {
    const calls = serve({
      lrclib: down,
      lrcred: redHas("just words\nno timestamps"),
      datlrc: () => json({ id: "lrc_1", trackName: "Song", artistName: "Artist", duration: 200, instrumental: false, plainLyrics: "x", syncedLyrics: SYNCED("from datlrc") }),
    });
    expect((await lookup()).synced?.[0].text).toBe("from datlrc");
    expect(calls.find((c) => c.url.host === "datlrc.test")?.init?.headers).toMatchObject({ "x-api-key": "dlrc_test" });
  });

  it("flags a song nobody has synced as needed, and returns LRCLIB's plain lyrics", async () => {
    serve({
      lrclib: (url) =>
        url.pathname.endsWith("/get")
          ? json({ id: 1, trackName: "Song", artistName: "Artist", duration: 200, instrumental: false, plainLyrics: "plain words", syncedLyrics: null })
          : json([]),
      lrcred: () => json({ hits: [] }),
      datlrc: missing,
    });
    expect(await lookup()).toMatchObject({ synced: null, plain: "plain words", needed: true });
  });

  it("doesn't flag a song LRCLIB has synced for another length (e.g. a longer music video)", async () => {
    serve({
      lrclib: (url) =>
        url.pathname.endsWith("/get")
          ? missing()
          : json([{ id: 2, trackName: "Song", artistName: "Artist", duration: 300, instrumental: false, plainLyrics: "x", syncedLyrics: SYNCED("album") }]),
      lrcred: () => json({ hits: [] }),
      datlrc: missing,
    });
    expect((await lookup()).needed).toBe(false);
  });

  it("throws (so nothing is cached or reported) when a source is down and nobody has it synced", async () => {
    serve({ lrclib: down, lrcred: () => json({ hits: [] }), datlrc: missing });
    await expect(lookup()).rejects.toThrow();
  });
});

describe("reportNeed", () => {
  it("sends the song's details to datlrc's /needs with the API key", async () => {
    const calls = serve({ lrclib: missing, lrcred: missing, datlrc: () => json({ ok: true }, 202) });
    const { reportNeed } = await import("../lyrics-source");
    const song = {
      artistName: "Artist",
      trackName: "Song (feat. Someone)",
      albumName: "Album",
      duration: 200,
      artworkUrl: "https://is1-ssl.mzstatic.com/a/1000x1000bb.jpg",
      videoId: "dQw4w9WgXcQ",
    };
    await reportNeed(song);
    expect(calls[0].url.href).toBe("https://datlrc.test/api/needs");
    expect(calls[0].init?.headers).toMatchObject({ "x-api-key": "dlrc_test" });
    expect(JSON.parse(String(calls[0].init?.body))).toEqual({ ...song, trackName: "Song" });
  });
});
