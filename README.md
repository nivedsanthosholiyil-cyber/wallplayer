# MusicWall

A cinematic, single-screen music player built with React, Vite, Tailwind CSS, TypeScript, Framer Motion, and Lucide React. It starts with a local mock playlist and can connect to Spotify for current playback state and remote controls.

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

The browser uses Authorization Code with PKCE. Access and refresh tokens are held in session storage and cleared on Disconnect. The Client ID is public and saved in local storage when entered in Settings. The app requests `user-read-playback-state` and `user-modify-playback-state`.

## Current behavior

- While disconnected, previous, play/pause, next, seeking, and volume operate a local three-track playlist. The mock clock advances automatically. There is no bundled audio.
- Local Music accepts MP3, WAV, OGG, M4A, AAC, and FLAC files from the file picker or drag and drop. Audio stays in the browser: files are stored in IndexedDB and played through local object URLs with the existing controls. URLs are revoked when the app closes. MP3 ID3 title, artist, and album tags are read when available; other files use their filename with fallback metadata. If a stored file is missing, its row offers a relink action.
- While connected, `GET /me/player` supplies track, artist IDs, album, artwork, duration, position, play state, and device capabilities. MusicWall refreshes playback on a changing interval and extrapolates position between checks. Existing controls issue Spotify commands where supported.
- Spotify tracks have no timed lyrics until a lyrics provider is integrated. MusicWall shows a quiet unavailable message rather than displaying incorrect mock lyrics.
- Lyrics follow explicit start/end timestamps and singer IDs. Centered, duet/split, minimal, and cinematic layouts are available from Settings. The two duet voices have separate timed streams.
- Settings includes seven distinct lyric typography presets, a font-family override, size, weight, tracking, line height, opacity, brightness, glow, blur, animation, position, line count, and alignment controls. A small live preview updates immediately. Duet singers can inherit the main style or receive independent overrides. Preferences are saved locally in the browser, including migration from the earlier appearance settings.
- The preset fonts are bundled locally from OFL-licensed Fontsource packages, so lyric styles do not depend on a live font CDN.
- The portable lyrics widget stays inside the page and can be dragged, resized, and customized from Settings. It contains only lyrics.
- Volume and mute state are wired to video sources and Spotify where the active device supports volume. The bundled still image has no sound. Space toggles playback when focus is outside a control or Settings.
- The bundled visual is a local still image with subtle motion and overlays. `VideoBackground` also accepts a video source when one is available later.

## Integration boundaries

- `src/types/music.ts` defines track, singer, visual, and timestamped lyric contracts.
- `src/data/mockTrack.ts` contains the local playlist and speaker metadata.
- `src/store/playerStore.ts` owns normalized mock or Spotify transport state. `src/hooks/usePlayback.ts` advances the local clock and exposes player actions.
- `src/services/spotify/auth.ts` owns PKCE, callback validation, refresh, and disconnect. `client.ts` owns authenticated requests and HTTP errors. `playback.ts` normalizes `/me/player` and isolates control endpoints. `src/hooks/useSpotify.ts` owns polling, backoff, and command dispatch.
- `src/services/localMusic/localMusic.ts` stores local audio blobs in IndexedDB and reads available MP3 metadata. `src/hooks/useLocalMusic.ts` restores the library and manages playback object URLs. Local files use the same player store, timeline, and controls as the other playback sources.
- `src/hooks/useLyrics.ts` determines previous/current/next lines, the active singer, and independent duet streams.
- `src/data/lyricStyles.ts` defines the typography presets, font mapping, and shared style variables used by the player and Settings preview.
- `src/hooks/usePlayerControls.ts` owns idle visibility and the Space shortcut. `src/hooks/useLyricsPreferences.ts` persists display settings.
- `src/components/` separates the player shell, background, lyrics, controls, settings, and portable lyrics.
- `src/services/{youtube,lyrics}/` still contains only future provider interfaces.

No YouTube, lyrics API, database, or backend code is included. Spotify's [Developer Policy](https://developer.spotify.com/policy) prohibits synchronizing Spotify sound recordings with visual media. Resolve this product constraint with Spotify before shipping the proposed music-video synchronization.

## Spotify playback and lyrics

Spotify playback uses PKCE and a single normalized player store. Browser SDK events are used when the token includes `streaming`; Web API polling reconciles other devices, playback commands, and device changes. Existing connections with older scopes continue to work through the Web API. Disconnect and reconnect once to grant the newly requested `user-read-currently-playing` and `streaming` scopes. The SDK does not automatically transfer playback away from your current Spotify device; browser streaming requires an eligible Spotify account and browser.

Lyrics come independently from LRCLIB, never Spotify. Exact track/artist/album/duration lookup is followed, when needed, by a strict artist/title and duration match for synchronized lyrics on another release. Lyrics are cached per track, aborted on track changes, and timed against the Spotify playback position. Plain lyrics remain readable and scrollable when no synchronized version exists. Singer attribution is not fabricated: tracks without singer metadata use a single lyric stream even if the saved layout is duet.

No lyrics key is needed for the default public provider. Optional `VITE_LYRICS_API_URL` changes the public LRCLIB-compatible API base URL. To use an authenticated provider, set server-only `LYRICS_API_URL` and `LYRICS_API_KEY`: Vite dev/preview provides `/api/lyrics/get` and `/api/lyrics/search`, with the key sent upstream as a Bearer header. A production static hosting deployment must implement these same server routes separately; never place a provider secret in a `VITE_` variable. Other API schemas require a new `LyricsProvider` adapter.

Development console diagnostics use `[Spotify]` and `[Lyrics]`, without tokens. Diagnostics are excluded from production builds. Background video and theme settings operate independently of this integration.
