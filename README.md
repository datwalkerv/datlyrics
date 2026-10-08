<div align="center">

<img src="./app/icon.svg" width="10%" alt="datlyrics" style="border-radius: 16px; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);" />

# datlyrics

**Paste a song. Sit back. Sing along.**

A TV-style synced lyrics player for YouTube songs and playlists, made for the big screen.

</div>

## ✨ Key Features

- **📺 Made for the Big Screen**: Blurred cover art fills the background, the cover and title sit on the left, and the lyrics play on the right. The cursor hides itself when you stop moving the mouse.
- **🎤 Synced Lyrics**: The current line lights up and the lines around it fade back, with dots during intros and breaks. Click any line to jump to it.
- **📜 Plain Lyrics, Too**: When a song only has unsynced lyrics, they scroll along slowly with the song instead.
- **🔍 Search or Paste**: Search a song, or paste any youtube.com, youtu.be or music.youtube.com link. A playlist link plays the whole playlist. ⌘K opens search anywhere.
- **🎬 Song / Video Switch**: Press V to switch between the song and its official music video, like on YouTube Music. Playback carries on at the same lyric line, even when the video has a longer intro or extra breaks.
- **🖼️ Real Album Art**: Covers come from iTunes and prefer the original release over remixes, so you see the album cover, not a video still.
- **📃 Queue & Up Next**: Press Q to open the queue and jump to any track. An "Up next" card shows up near the end of each song.
- **⏯️ Seekable Progress Bar**: Click or drag the progress bar to seek.
- **⌨️ Keyboard Only**: No buttons on screen. Everything has a shortcut.
- **🔑 No Account, No Keys**: Nothing to sign up for, and no API keys to set up.

## ⌨️ Keyboard Shortcuts

| Key | Action |
| --- | --- |
| `⌘K` / `Ctrl K` / `/` | Search, or paste a link |
| `Space` / `K` | Play / pause |
| `←` `→` | Seek 5 seconds |
| `J` `L` | Seek 10 seconds |
| `N` / `P` | Next / previous track |
| `V` | Switch between song and music video |
| `Q` | Open the queue (playlists) |
| `[` `]` | Move the lyrics 0.25s earlier / later |
| `F` | Fullscreen |
| `Esc` | Close the queue, or go back home |

## 🛠️ Technology Stack

- **Framework**: [Next.js 16 (App Router)](https://nextjs.org/)
- **Runtime & View Library**: [React 19](https://react.dev/)
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/)
- **Animation**: [Motion](https://motion.dev/)
- **Type Safety**: [TypeScript](https://www.typescriptlang.org/)
- **Playback**: [YouTube IFrame Player API](https://developers.google.com/youtube/iframe_api_reference)
- **Lyrics**: [LRCLIB](https://lrclib.net/)
- **Album Art**: [iTunes Search API](https://performance-partners.apple.com/search-api)
- **Testing**: [Vitest](https://vitest.dev/)
- **Fonts**: [Geist](https://vercel.com/font), self-hosted

## 🎶 How It Works

### Playback
- Songs play in YouTube's own embedded player, which stays hidden unless you switch to the music video.
- Playlists are only used to read the track list. Each track then plays on its own, so any track can play as its song or its video.
- Videos the owner doesn't allow outside YouTube are skipped in playlists.

### Lyrics
- Lyrics come from LRCLIB, matched by artist, title and the length of the upload that's playing.
- A music video often has a different timeline from the album audio. LRCLIB sometimes has the album timing filed under the video's length, so timings that clearly belong to a different-length upload are ranked down.
- To switch between the song and the video, the two lyric files are aligned line by line. That keeps playback on the right line, even on hooks that repeat dozens of times.

### Song / Video Matching
- The other version comes from YouTube Music's own search, which keeps songs and music videos apart.
- Only uploads credited to the artist count, and covers, live versions, remixes, sped-up edits and fan uploads are skipped. If there's no official video, the cover stays.

## ⚖️ Privacy

- datlyrics has **no accounts, no database, no analytics and no cookies**.
- The only thing saved is whether you last chose song or video, in your own browser's local storage.
- Search terms, song titles and video IDs go through datlyrics' server to YouTube, LRCLIB and iTunes, so your browser doesn't contact those services itself. Responses are cached, and nothing is logged or stored about you.
- Playback happens in YouTube's embedded player, so YouTube's own privacy policy applies to what you watch.

<br>

**By artist for artists. 🎧**  
*Paste a song. Sit back. Sing along.*
