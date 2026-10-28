/**
 * Hosts the YouTube player for the app (see components/player/bridge.ts). YouTube refuses label
 * videos embedded directly on lyrics.datwalkerv.app but not on the vercel.app domain, and it only
 * checks the frame that embeds it, so the app frames this page from there and drives it by messages.
 */
const HTML = `<!doctype html>
<html><head><meta charset="utf-8"><title>datlyrics player</title>
<style>html,body{margin:0;height:100%;overflow:hidden;background:#000}#p{width:100%;height:100%;display:block}</style>
</head><body><div id="p"></div><script>
const vars = Object.fromEntries(new URLSearchParams(location.search));
for (const k in vars) if (/^\\d+$/.test(vars[k])) vars[k] = Number(vars[k]);
vars.origin = location.origin;
const CALLS = new Set(["loadPlaylist", "playVideoAt", "playVideo", "pauseVideo", "seekTo", "setVolume", "mute", "unMute", "unloadModule"]);
let p = null;
const snap = () => {
  if (!p || typeof p.getVideoData !== "function") return null;
  const v = p.getVideoData() || {};
  return {
    time: p.getCurrentTime() || 0,
    duration: p.getDuration() || 0,
    rate: p.getPlaybackRate() || 1,
    video: { video_id: v.video_id || "", title: v.title || "", author: v.author || "" },
    playlist: p.getPlaylist() || null,
    index: p.getPlaylistIndex() ?? -1,
  };
};
const send = (type, data) => parent.postMessage({ datlyrics: true, type, data, snap: snap() }, "*");
addEventListener("message", (e) => {
  if (e.source !== parent || !e.data || !e.data.datlyrics || !p) return;
  const { method, args } = e.data;
  if (CALLS.has(method) && typeof p[method] === "function") p[method](...args);
  send("sync");
});
window.onYouTubeIframeAPIReady = () => {
  p = new YT.Player("p", {
    width: "100%",
    height: "100%",
    playerVars: vars,
    events: {
      onReady: () => {
        send("ready");
        setInterval(() => send("sync"), 250);
      },
      onStateChange: (e) => send("state", e.data),
      onError: (e) => send("error", e.data),
    },
  });
};
</script><script src="https://www.youtube.com/iframe_api"></script></body></html>`;

export function GET() {
  return new Response(HTML, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}
