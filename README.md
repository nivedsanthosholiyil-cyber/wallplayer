# Spontaneous

A cinematic, single-screen music player built with React, Vite, Tailwind CSS, TypeScript, Framer Motion, and Lucide React. It starts with a local mock playlist and can connect to Spotify for current playback state and remote controls.

## Windows download

[Download Spontaneous Setup for Windows x64](https://github.com/nivedsanthosholiyil-cyber/wallplayer/releases/download/v0.1.0-preview.1/Spontaneous-Setup-0.1.0-x64.exe). This is a preview build; see the [release notes](https://github.com/nivedsanthosholiyil-cyber/wallplayer/releases/tag/v0.1.0-preview.1) and [verification report](docs/windows-installer-verification.md).

Run the single setup file and choose an installation folder. No separate Node.js installation or development server is needed. The **Startup options** page offers **Open Spontaneous when Windows starts**. It is unchecked for a fresh installation; enabling it opens the app as your live wallpaper when you sign in to Windows. Updates preserve the choice. You can disable it later in Windows Settings → Apps → Startup.

The installer includes the Spontaneous application icon, desktop/tray controls, local music, theme artwork and the production frontend/server. It is unsigned. Full installation, update, uninstall and a Windows reboot have not yet been manually verified.

Spotify users must use a public Client ID permitted for their account. Enter it in Settings and register **`http://127.0.0.1:4173/callback`** in that Spotify application's dashboard. Development-mode Spotify applications may require the developer to allow your account. Use an active Spotify desktop/phone playback device; protected in-app Spotify streaming is unverified in Electron. Local audio does not require Spotify. See [desktop configuration](docs/windows-desktop.md).

The name is now Spontaneous; the existing MusicWall application ID, storage directories and saved preferences are preserved.

## Run locally

```bash
npm install
npm run dev
```

Open `http://127.0.0.1:5173/`. For a production check, run `npm run build`; run `npm test` for the Spotify integration tests.

## Connect Spotify

1. Create a Spotify app in the [Spotify Developer Dashboard](https://developer.spotify.com/dashboard).
2. Register `http://127.0.0.1:5173/callback` as an exact redirect URI.
3. Paste its public **Client ID** into MusicWall Settings, then choose **Connect Spotify**. Alternatively, copy `.env.example` to `.env.local`, set `VITE_SPOTIFY_CLIENT_ID`, and restart Vite. Never put a client secret in a `VITE_` variable.
4. Play a track on an active Spotify device. MusicWall detects the track and uses its playback position. Spotify's remote playback controls generally require Premium and an available, unrestricted device.

The app uses Authorization Code with PKCE. Browser tokens persist in origin-local storage; desktop tokens are encrypted using Windows DPAPI. Disconnect clears the saved connection. The short-lived PKCE transaction stays in session storage. The Client ID is public and saved locally when entered in Settings. The app requests `user-read-playback-state`, `user-read-currently-playing`, `streaming`, and `user-modify-playback-state`.

## Current behavior

- While disconnected, previous, play/pause, next, seeking, and volume operate a local three-track playlist. The mock clock advances automatically. There is no bundled audio.
- Local Music accepts MP3, WAV, OGG, M4A, AAC, and FLAC files from the file picker or drag and drop. Audio stays in the browser: files are stored in IndexedDB and played through local object URLs with the existing controls. URLs are revoked when the app closes. MP3 ID3 title, artist, and album tags are read when available; other files use their filename with fallback metadata. If a stored file is missing, its row offers a relink action.
- While connected, `GET /me/player` supplies track, artist IDs, album, artwork, duration, position, play state, and device capabilities. MusicWall refreshes playback on a changing interval and extrapolates position between checks. Existing controls issue Spotify commands where supported.
- Spotify lyrics are retrieved independently from LRCLIB, with synced and plain-lyrics support. Missing lyrics use a quiet fallback.
- Lyrics follow explicit start/end timestamps and singer IDs. Centered, duet/split, minimal, and cinematic layouts are available from Settings. The two duet voices have separate timed streams.
- Settings includes seven distinct lyric typography presets, a font-family override, size, weight, tracking, line height, opacity, brightness, glow, blur, animation, position, line count, and alignment controls. A small live preview updates immediately. Duet singers can inherit the main style or receive independent overrides. Preferences are saved locally in the browser, including migration from the earlier appearance settings.
- The preset fonts are bundled locally from OFL-licensed Fontsource packages, so lyric styles do not depend on a live font CDN.
- The portable lyrics widget stays inside the page and can be dragged, resized, and customized from Settings. It contains only lyrics.
- Volume and mute state are wired to video sources and Spotify where the active device supports volume. The bundled still image has no sound. Space toggles playback when focus is outside a control or Settings.
- The bundled visual is a local still image with subtle motion and overlays. `VideoBackground` also accepts a video source when one is available later.

## Integration boundaries

### Music Library

Carousel headers include small previous/next arrows. Touch scrolling and keyboard Left/Right also browse the same cards without changing their playback behavior.

**Settings → Appearance → Motion** controls optional UI motion. ON defaults to Medium (50%); the intensity slider uses 0/25/50/75/100. OFF and the system's reduced-motion preference remove background movement, mouse parallax, lyric movement, hover transforms, and panel/player slides. Decorative background videos pause on their current frame; music playback is independent. Short state crossfades remain. These preferences use the existing settings storage and survive reloads.

The floating library panel supports compact local track menus, local playlists, recent listening, and in-panel album, artist, and playlist navigation. Audio imports and per-track image/video visuals stay on this computer in IndexedDB. Local playlists and recent track metadata are saved in browser storage.

Connected Spotify search uses bounded pages, request cancellation, and a short cache. **Reconnect for library access** requests the additional playlist, recently played, and saved-track permissions through the existing PKCE flow. Playback-only connections keep working without these permissions. Spotify may restrict access to some playlist contents; the panel shows a small message and preserves Back navigation. Sample Made for You collections are explicitly labelled when personal Spotify data is unavailable.

- `src/types/music.ts` defines track, singer, visual, and timestamped lyric contracts.
- `src/data/mockTrack.ts` contains the local playlist and speaker metadata.
- `src/store/playerStore.ts` owns normalized mock or Spotify transport state. `src/hooks/usePlayback.ts` advances the local clock and exposes player actions.
- `src/services/spotify/auth.ts` owns PKCE, callback validation, refresh, and disconnect. `client.ts` owns authenticated requests and HTTP errors. `playback.ts` normalizes `/me/player` and isolates control endpoints. `src/hooks/useSpotify.ts` owns polling, backoff, and command dispatch.
- `src/services/localMusic/localMusic.ts` stores local audio blobs in IndexedDB and reads available MP3 metadata. `src/hooks/useLocalMusic.ts` restores the library and manages playback object URLs. Local files use the same player store, timeline, and controls as the other playback sources.
- `src/hooks/useLyrics.ts` determines previous/current/next lines, the active singer, and independent duet streams.
- `src/data/lyricStyles.ts` defines the typography presets, font mapping, and shared style variables used by the player and Settings preview.
- `src/hooks/usePlayerControls.ts` owns idle visibility and the Space shortcut. `src/hooks/useLyricsPreferences.ts` persists display settings.
- `src/components/` separates the player shell, background, lyrics, controls, settings, and portable lyrics.
- `src/services/lyrics/` owns the independent lyrics adapter; YouTube remains unimplemented.

No YouTube integration is included. Background clips are independent muted loops, never synchronized to Spotify audio. Spotify's [Developer Policy](https://developer.spotify.com/policy) prohibits synchronizing Spotify sound recordings with visual media. Resolve this product constraint with Spotify before shipping the proposed music-video synchronization.

## Spotify playback and lyrics

Spotify playback uses PKCE and a single normalized player store. Browser SDK events are used when the token includes `streaming`; Web API polling reconciles other devices, playback commands, and device changes. Existing connections with older scopes continue to work through the Web API. Disconnect and reconnect once to grant the newly requested `user-read-currently-playing` and `streaming` scopes. The SDK does not automatically transfer playback away from your current Spotify device; browser streaming requires an eligible Spotify account and browser.

Lyrics come independently from LRCLIB, never Spotify. Exact track/artist/album/duration lookup is followed, when needed, by a strict artist/title and duration match for synchronized lyrics on another release. Lyrics are cached per track, aborted on track changes, and timed against the Spotify playback position. Plain lyrics remain readable and scrollable when no synchronized version exists. Singer attribution is not fabricated: tracks without singer metadata use a single lyric stream even if the saved layout is duet.

No lyrics key is needed for the default public provider. Optional `VITE_LYRICS_API_URL` changes the public LRCLIB-compatible API base URL. To use an authenticated provider, set server-only `LYRICS_API_URL` and `LYRICS_API_KEY`: Vite dev/preview provides `/api/lyrics/get` and `/api/lyrics/search`, with the key sent upstream as a Bearer header. A production static hosting deployment must implement these same server routes separately; never place a provider secret in a `VITE_` variable. Other API schemas require a new `LyricsProvider` adapter.

Development console diagnostics use `[Spotify]` and `[Lyrics]`, without tokens. Diagnostics are excluded from production builds. Background video and theme settings operate independently of this integration.


## Set Background Visual (Pexels)

1. Add `PEXELS_API_KEY=your_key` to `.env.local` at the project root and restart `npm run dev`. This is a server-only variable. Never use `VITE_PEXELS_API_KEY` or commit a real key.
2. With a Spotify track selected, open the small track menu beside its title and choose **Set Visual**. The same action appears in Wallpaper settings.
3. Edit the artist/title search phrase, choose orientation, and submit **Search Pexels**. Preview is muted; **Use Visual** explicitly downloads a selected MP4 to this computer. No Pexels search is performed when playback starts or changes tracks.
4. Reopen the panel to replace or remove the saved visual. Downloads have a 120 MB limit and a 90-second timeout; a failed replacement keeps the previous visual.

The official Pexels Videos API is proxied by `server/visuals.mjs`. The API key is never returned to the browser. Download URLs are obtained again from Pexels's video detail endpoint, not accepted from the browser. Redirects are limited to recognized video CDNs. Local routes are restricted to same-origin requests on localhost/127.0.0.1. Creator and Pexels attribution are shown in search results.

Videos and `metadata.json` are saved under `%LOCALAPPDATA%/MusicWall/musicwall-data/visuals/<spotifyTrackId>/` on Windows, `~/Library/Application Support/MusicWall/musicwall-data/visuals/` on macOS, or the XDG data directory on Linux. Optional server-only `MUSICWALL_VISUALS_DIR` overrides the folder. Files use versioned `visual-<uuid>.mp4` names for atomic replacement and caching. Metadata records track ID, title, artist, source, Pexels ID, creator, resolution, download date, and file size. Only the selected track's video is streamed; list operations read metadata, not video bytes. Browser storage is not used for these downloads.

**Wallpaper → Background Mode** offers Auto, Album Art, and Track Visual. Auto/Track Visual prioritize the current track's saved local video, then Spotify artwork, then the original default scene. Album Art skips saved videos. Existing custom uploads and static wallpapers remain explicit Source overrides. UI themes are independent. Local track visuals always autoplay muted on loop, with no timing connection to Spotify audio; they can pause when the app is hidden. Background brightness, saturation, blur, and overlays remain configurable. Two media layers keep the previous frame visible until the replacement has decoded, then crossfade.

Development and `npm run preview` include the local backend. For the built app, run `npm run build` followed by `npm start` (defaults to `http://127.0.0.1:4173/`; `PORT` is optional). Static-only hosting cannot write local files and needs this local Node server. The standalone server now includes the optional authenticated `/api/lyrics` proxy; the browser build's default public lyrics provider still works directly.

## Windows desktop

Run `npm run desktop` for the Electron production preview, or `npm run package:win` to create the Windows x64 NSIS installer in `release/`. Register `http://127.0.0.1:4173/callback` in the Spotify dashboard in addition to the development callback. See [Windows desktop setup, architecture and release checks](docs/windows-desktop.md). A built installer is not a verified desktop release; real OAuth, audible playback and rendering require manual checks.

For isolated browser QA, `scripts/test-visuals-preview.mjs` uses mocked Spotify/Pexels responses and a local MP4 supplied as `MUSICWALL_QA_VIDEO` (or a temporary `musicwall-test-visual.mp4`). This QA server runs on port 5175, stores fixtures in a temporary folder, and never contacts Spotify/Pexels. It is not part of the production app. Automated tests cover search normalization, credential isolation, downloads, persistence, byte ranges, failed replacement, removal, fallback priority, and background readiness/mute/loop behavior.
