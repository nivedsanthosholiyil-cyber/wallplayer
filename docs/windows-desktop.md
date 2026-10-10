# Spontaneous Windows desktop

## Build and run

Build on Windows x64 with Node 22.12+ and npm. The lockfile pins Electron and electron-builder; no globally installed Electron or Node is required by the installed application.

```powershell
npm ci
npm test
npm run build
npm run desktop
```

`desktop` builds a dedicated production frontend in `dist-desktop` and runs Electron. `desktop:run` runs an already-built desktop frontend. The existing `npm run dev` / `npm run preview` / `npm start` browser workflow remains available. `npm start` serves the normal `dist` build and uses port 4173 unless `PORT` is configured. Stop that server before starting the desktop application.

```powershell
npm run package:win
```

Outputs:

- Installer: `release/Spontaneous-Setup-0.1.0-x64.exe` (version follows package.json).
- Unpacked app: `release/win-unpacked/Spontaneous.exe`.
- `npm run package:win:dir` creates only the unpacked app for testing.

Packaging uses the pinned npm Electron runtime at `node_modules/electron/dist`, avoiding a second runtime extraction. If a machine blocks Electron's install script, resolve that installation failure first; `node node_modules/electron/install.js` retries the official download/extraction. Do not substitute an untrusted runtime. Build the x64 installer on an x64 Windows machine.

The NSIS installer supports per-user installation and directory selection, using the local Spontaneous icon. It preserves application data on uninstall. No code-signing certificate is configured: the produced installer is **unsigned**, even if electron-builder prints a signing-stage message. A signed publisher build remains a release gate.

### Optional Windows startup

`build/installer.nsh` adds a Startup options page after directory selection. **Open Spontaneous when Windows starts** is unchecked on a fresh install. Checking it writes only the current user's `HKCU/Software/Microsoft/Windows/CurrentVersion/Run/Spontaneous` value, with the quoted installed executable path and `--wallpaper`. This opens the wallpaper at Windows sign-in. No administrative privileges or scheduled task are required.

Updates preserve the existing choice and replace the executable path if the installation folder changes. Unchecking removes the entry; a normal uninstall removes it, while the update uninstaller leaves it for the new installer. Users can disable it in Windows Settings → Apps → Startup. Application preferences, imported files and encrypted Spotify credentials remain in the existing MusicWall profile.

Run `npm run test:installer` on Windows to compile and execute a small NSIS harness against the actual installer hooks. It uses an isolated temporary registry key, exercises opt-in/opt-out/update/uninstall logic, then deletes that key. It does not install the application or touch the real Windows startup entry. See [installer verification](windows-installer-verification.md) for the preview build and manual checks still required.

## Runtime architecture

1. `desktop/main.cjs` obtains a single-instance lock and starts `desktop/server.cjs` using Electron's Node utility process.
2. The child starts `server/production.mjs`, serving `dist-desktop` and existing local API routes. All application paths resolve from module locations, independent of the working directory and valid inside `app.asar`.
3. Electron waits for an explicit readiness message before loading `http://127.0.0.1:4173/`. It never starts Vite. A missing build, port conflict, startup timeout, or unexpected server exit produces an error dialog.
4. On quit, the parent requests HTTP shutdown, then terminates an unresponsive child after a bounded grace period. The child also checks parent liveness. A second launch focuses the existing window.

On Windows, the desktop host can attach the same renderer behind desktop icons. Mode switching, tray actions, helper lifecycle and remaining verification gates are documented in [Windows wallpaper hosting](windows-wallpaper-host.md). `--windowed` forces the original application window. The fixed origin, OAuth relay and storage architecture below are retained.

Port 4173 is deliberately fixed. The server binds exclusively to IPv4 loopback and rejects unexpected Host headers and cross-origin API calls. If occupied, startup fails clearly; it never connects to an unrelated process or chooses a new origin that would orphan IndexedDB/settings and invalidate OAuth configuration.

The renderer is sandboxed, with context isolation, Node integration disabled, web security enabled and no webviews. Narrow sandboxed preload bridges support wallpaper pointer/input reporting and encrypted Spotify credentials; they expose no generic filesystem or shell access. File inputs, drag/drop, IndexedDB, and blob URLs continue using the browser APIs already present. Existing local-file relinking and wallpaper object-URL cleanup remain unchanged.

CSP denies sources by default, permits executable scripts only from the local app and Spotify's SDK host, and restricts frames/connect/media to the required services. Inline styles support the existing React/motion styling; inline scripts and eval are prohibited. HTTPS artwork URLs are permitted as images. Top-level navigation stays on the app origin; only validated Spotify authorization and a small HTTPS attribution-link allowlist open in the system browser. Permission requests are denied except the SDK's media-key-system request; this does not supply a DRM module.

## Spotify dashboard configuration

Register this **exact** additional redirect URI for the same public Spotify Client ID:

```text
http://127.0.0.1:4173/callback
```

Retain the existing browser-development URI:

```text
http://127.0.0.1:5173/callback
```

Use `127.0.0.1`, not `localhost`, in registered loopback redirects. The desktop build explicitly sets the 4173 callback, so `.env.local` development overrides cannot accidentally send it to Vite. Set the public Client ID through the existing Settings UI or `VITE_SPOTIFY_CLIENT_ID` at build time. Never ship a client secret. Allow the test account in the Spotify app dashboard where required by the app's development access mode.

The existing renderer generates the PKCE verifier/challenge/state. Electron intercepts only the validated Spotify authorization navigation and opens the system browser. The loopback server accepts only a matching, unexpired, one-time callback. The parent returns its code/state to the **same** app WebContents on the app root URL, retaining the sessionStorage verifier. Existing `spotifyAuth.completeRedirect()` validates state again and exchanges the code. Neither main nor server logs or persists authorization codes/tokens/verifiers. The callback browser page contains only a completion message and never reflects credentials.

The PKCE flow and playback service remain in place. Authorization opens in the system browser while MusicWall retains its current wallpaper/window mode. Callback navigation uses the same WebContents and does not overwrite the user's saved mode. Closing the browser before completing login requires starting Connect again (reload MusicWall if necessary).

Desktop access/refresh tokens are persisted in `%APPDATA%/MusicWall/spotify-session.bin` using Electron's asynchronous `safeStorage` API (Windows DPAPI). Only the application's current main frame can read/write/clear the fixed credential record through a narrow sandboxed preload bridge; no paths or generic IPC are exposed. The store serializes writes and disconnect cleanup, validates records, writes encrypted bytes atomically and never falls back to plaintext. No Spotify password or client secret is stored. Browser builds use origin-local persistent storage; the short-lived PKCE transaction remains in sessionStorage. Legacy tab credentials migrate when available.

Startup restores credentials and the existing poller refreshes expired access tokens automatically. Offline/service/rate-limit errors retain the refresh token for retry. Spotify `invalid_grant` or explicit Disconnect clears the saved credentials. Spotify may require reauthorization, including its [six-month refresh-token expiration](https://developer.spotify.com/blog/2026-06-18-refresh-token-expiration); persistence cannot guarantee permanent authorization. Settings and IndexedDB persist separately.

Credential lifecycle and callback/mode tests pass, including a real Windows encrypted-store round-trip with test credentials. On 2026-10-09 the user confirmed real-account sign-in remained in wallpaper mode. A full MusicWall process shutdown and cold launch through its Startup shortcut then restored Spotify without a sign-in: the running UI showed a new real track, progressing time, artwork and lyrics, and Settings reported Connected to Spotify. Actual Windows reboot, long-lived token refresh/expiration, audible output and all release gates beyond these observations remain unverified.

Spotify Web API control of an active Spotify device and in-app SDK streaming are separate checks. This package includes no provisioned Widevine CDM; treat protected Spotify SDK playback as unsupported/unverified until validated for the distribution. Use an active Spotify desktop/phone device for initial Web API verification. This foundation does not promise that MusicWall itself can stream Spotify audio.

## Lyrics and optional backend configuration

The desktop frontend uses `/api/lyrics`. By default, the production server forwards to public LRCLIB over HTTPS, with no key required. The same bounded handler is shared by Vite's optional provider middleware and production; it allows only `/get` and `/search`, limits query fields and response size, has a timeout, and does not follow upstream redirects.

Optional desktop configuration belongs in `%APPDATA%/MusicWall/server.env` (outside the installer):

```dotenv
LYRICS_API_URL=https://your-lrclib-compatible-provider.example/api
LYRICS_API_KEY=your_private_provider_key
# Existing optional visual search backend only:
# PEXELS_API_KEY=your_key
# MUSICWALL_VISUALS_DIR=C:/Users/you/AppData/Local/MusicWall/musicwall-data/visuals
```

These values are server-only; do not use `VITE_` for keys. OS environment values override the file. Restart after changes. `MUSICWALL_VISUALS_DIR` must be absolute. Browser `npm start` reads the project's `.env`, `.env.local`, `.env.production`, `.env.production.local` in that order, with OS environment values taking precedence. Files use Node's dotenv parser (no shell expansion).

The package includes frontend assets, fonts, theme images, desktop entrypoints and built-in-Node backend modules. React and fonts are compiled into the frontend; the backend requires no third-party Node modules. `node_modules`, source tests, `.env` files, reports and developer tooling are excluded from the application archive.

## Storage and diagnosis

Electron uses its persistent profile under `%APPDATA%/MusicWall`; localStorage and IndexedDB stay bound to the fixed 4173 origin. Existing browser data at port 5173 is a separate browser profile/origin and is not automatically migrated. Imported audio remains local in IndexedDB. Existing downloaded visuals retain their `%LOCALAPPDATA%/MusicWall/musicwall-data/visuals` location unless configured otherwise. Installer updates retain the profile. The Spontaneous display-name change preserves com.musicwall.desktop, the explicit MusicWall user-data directory and the 4173 origin.

`%APPDATA%/MusicWall/desktop.log` records readiness, document load, shutdown and startup failures, without OAuth query strings. A loaded window document establishes navigation only, not visual correctness or playback.

## Manual release gates

- Install and uninstall as a standard Windows user; verify shortcuts, installer directory selection, profile retention, and update installation.
- Launch from another working directory; confirm assets render, single-instance focusing, closing releases port 4173, and port conflicts show a useful error. Repeat after reboot.
- Connect a real Spotify account through the system browser; test approval, denial, retry, reconnect, active-device discovery, track changes, play/pause, seeking and volume. Confirm lyrics follow the audible device. Do not equate callback unit tests with successful OAuth.
- Import real MP3/WAV/OGG/M4A/AAC/FLAC files supported by the runtime. Verify audible output, seeking, queue advancement, pause-volume behavior, relinking, and persistence after restart.
- Check video wallpapers on the target Windows GPU/codecs, muted previews, failed decoding fallback, and cleanup after replacement/removal.
- Inspect all five themes, Browse Music, every Settings page, Dual Split anchors, album-art transitions, readability, small window sizes, Motion OFF and OS reduced motion.
- Verify publisher signing before a stable Windows release. The local application icon is now included. Review build-tool dependency advisories before release.

References: [Electron security](https://www.electronjs.org/docs/latest/tutorial/security), [utility processes](https://www.electronjs.org/docs/latest/api/utility-process), [Spotify redirect rules](https://developer.spotify.com/documentation/web-api/concepts/redirect_uri), [NSIS packaging](https://www.electron.build/v26/docs/nsis/).
