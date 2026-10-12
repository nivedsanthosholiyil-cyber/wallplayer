# Spotify wallpaper mode and saved connection — 2026-10-09

Branch `feature/windows-live-wallpaper`. Existing dirty native/input work was preserved. Nothing was pushed, packaged or installed.

## Confirmed causes and fixes

1. Desktop OAuth forcibly switched to normal-window mode and saved that preference. The system browser now handles sign-in while the existing wallpaper HWND remains attached. Callback navigation preserves the current desired mode, including deliberate tray changes during sign-in, and refreshes input regions after navigation.
2. Credentials existed only in sessionStorage. Desktop tokens now use a narrowly validated sandboxed preload API and fixed encrypted file `%APPDATA%/MusicWall/spotify-session.bin`. Electron asynchronous safeStorage uses Windows DPAPI. Writes and clears are serialized, files are replaced atomically, and the desktop never intentionally falls back to plaintext credential persistence. Browser builds retain credentials in origin-local storage. PKCE transactions stay short-lived in sessionStorage.
3. Refresh failure previously discarded credentials even when offline or Spotify was temporarily unavailable. Only invalid authorization clears credentials; temporary failures preserve the refresh token for the existing retry behavior. Explicit Disconnect clears both persistent and legacy storage. Late refresh/restore completion cannot undo Disconnect.

## Actual verification

- User performed real Spotify sign-in after the update and confirmed **it stayed in wallpaper mode**.
- An encrypted connection file was created (628 bytes; no real token contents were printed or recorded).
- MusicWall was opened in normal mode for inspection; real Spotify track/artwork/progress/lyrics were visible. Native Close cleanly stopped its Electron/server/helper processes.
- The existing Windows Startup shortcut cold-launched a new process in wallpaper mode. Returning that process to an ordinary window for inspection showed the current Spotify track, artwork, changing progress and synchronized lyrics **without a new sign-in**. Settings accessibility text reported **Connected to Spotify** and **Disconnect Spotify**.
- Settings was closed and MusicWall returned to wallpaper mode. This tests shortcut launch, not a real Windows reboot/sign-in.
- A separate test launched the actual Electron runtime and round-tripped fixture credentials using real Windows safeStorage, verified encrypted bytes did not contain the fixture refresh token, recreated the store, and cleared it. These were fixture credentials, not an OAuth integration substitute.

## Commands/results

- Focused auth/store/preload/lifecycle tests: 4 files, 27 tests PASS; an additional disconnect/restore regression subsequently passed in the full suite.
- `npm test`: 26 files, **115 tests PASS**, twice at 21:31:28 (9.33s) and 21:39:43 (9.92s). The later run includes the desktop fail-closed guard.
- `npm run build:desktop`: PASS, including final guard; `npm run build`: PASS. Existing Vite chunk-size warning remains.
- Actual `desktop:run -- --windowed`/`--wallpaper`, clean Close and cold launch through `MusicWall.lnk`: successful. Second-instance launches retain existing occasional cache access warnings; the primary process reported no attachment errors.

Evidence: ignored `tmp/wallpaper-qa/spotify-before-restart.jpg`, `spotify-after-restart.jpg`, `spotify-after-restart-accessibility.txt`, `spotify-persistence-shutdown.json`, `spotify-restored-wallpaper-status.json`; primary startup stdout/stderr `spotify-persistence-launch.log` and `spotify-persistence-errors.log`.

NOT TESTED: real Windows reboot, waiting for actual access/refresh-token expiration, live offline boot, revoked consent, audible output/GPU decoding, installer update/install/uninstall. No permanent sign-in guarantee: [Spotify refresh tokens expire after six months](https://developer.spotify.com/blog/2026-06-18-refresh-token-expiration) and authorization can also be revoked.
