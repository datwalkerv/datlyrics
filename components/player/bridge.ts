"use client";

import { PLAYER_ORIGIN } from "@/lib/site";

/**
 * Stands in for `YT.Player`, with the subset `useYouTubePlayer` uses. The real player runs in
 * app/embed (on PLAYER_ORIGIN in production): commands go to it as messages, and it reports its
 * state back, which the getters answer from.
 */
type Snap = {
  time: number;
  duration: number;
  rate: number;
  video: { video_id: string; title: string; author: string };
  playlist: string[] | null;
  index: number;
};

type Options = { width?: number; height?: number; playerVars: YT.PlayerVars; events: Events };

type Events = {
  onReady?: (e: { target: YT.Player }) => void;
  onStateChange?: (e: YT.OnStateChangeEvent) => void;
  onError?: (e: YT.OnErrorEvent) => void;
};

const PlayerState = { UNSTARTED: -1, ENDED: 0, PLAYING: 1, PAUSED: 2, BUFFERING: 3, CUED: 5 } as typeof YT.PlayerState;

class BridgePlayer {
  private frame: HTMLIFrameElement;
  private snap: Snap = {
    time: 0,
    duration: 0,
    rate: 1,
    video: { video_id: "", title: "", author: "" },
    playlist: null,
    index: -1,
  };
  private onMessage: (e: MessageEvent) => void;

  constructor(host: HTMLElement, { playerVars, events }: Options) {
    const origin = process.env.NODE_ENV === "production" ? PLAYER_ORIGIN : window.location.origin;
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(playerVars)) if (v !== undefined) params.set(k, String(v));
    this.frame = document.createElement("iframe");
    this.frame.src = `${origin}/embed?${params}`;
    this.frame.title = "YouTube player";
    this.frame.allow = "autoplay; encrypted-media; picture-in-picture";
    host.replaceWith(this.frame);

    const target = this as unknown as YT.Player;
    this.onMessage = (e) => {
      if (e.source !== this.frame.contentWindow || !e.data?.datlyrics) return;
      if (e.data.snap) this.snap = e.data.snap;
      if (e.data.type === "ready") events.onReady?.({ target });
      else if (e.data.type === "state") events.onStateChange?.({ target, data: e.data.data } as YT.OnStateChangeEvent);
      else if (e.data.type === "error") events.onError?.({ target, data: e.data.data } as YT.OnErrorEvent);
    };
    window.addEventListener("message", this.onMessage);
  }

  private call(method: string, ...args: unknown[]) {
    this.frame.contentWindow?.postMessage({ datlyrics: true, method, args }, "*");
  }

  getCurrentTime = () => this.snap.time;
  getDuration = () => this.snap.duration;
  getPlaybackRate = () => this.snap.rate;
  getVideoData = () => this.snap.video;
  getPlaylist = () => this.snap.playlist;
  getPlaylistIndex = () => this.snap.index;

  loadPlaylist = (list: string[], index: number, start: number) => this.call("loadPlaylist", list, index, start);
  playVideoAt = (index: number) => this.call("playVideoAt", index);
  playVideo = () => this.call("playVideo");
  pauseVideo = () => this.call("pauseVideo");
  seekTo = (s: number, allowSeekAhead: boolean) => {
    this.snap.time = s; // answer getCurrentTime right away, not after the next report
    this.call("seekTo", s, allowSeekAhead);
  };
  setVolume = (v: number) => this.call("setVolume", v);
  mute = () => this.call("mute");
  unMute = () => this.call("unMute");
  unloadModule = (m: string) => this.call("unloadModule", m);
  destroy = () => {
    window.removeEventListener("message", this.onMessage);
    this.frame.remove();
  };
}

export const YouTubeBridge = {
  Player: BridgePlayer as unknown as new (host: HTMLElement, options: Options) => YT.Player,
  PlayerState,
};
