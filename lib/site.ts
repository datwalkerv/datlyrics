export const GITHUB_URL = "https://github.com/datwalkerv/datlyrics";

export const DONATE = [
  { coin: "BTC", address: "bc1qf2pnd0uglrq58h0vnvh5p0rajz8w8lgdey00zc" },
  { coin: "SOL", address: "DNf9BRzBXEfudCw8g6JXQ3wJjZ5Su1ddfL5Pchkcyaf5" },
];

/** "zapzarap": pinned on everyone's shelf and used as the landing page demo. */
export const DEMO_PLAYLIST_ID = "PL1hXJKCgMGgiKJCQnpWtaBJT_kYDn3E7D";

/**
 * Where the YouTube player frame is served from in production. YouTube blocks label videos
 * embedded on lyrics.datwalkerv.app, but not on this domain (see app/embed/route.ts).
 */
export const PLAYER_ORIGIN = "https://datlyrics-datwalkervs-projects.vercel.app";
