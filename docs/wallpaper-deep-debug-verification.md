# Wallpaper debugging, Spontaneous branding and Search continuation

Verified 2026-10-10 on `feature/windows-live-wallpaper`. Existing user changes and previous packages were preserved. No release was installed, published or merged.

## Confirmed causes and fixes

- A desktop cursor sample could arrive before React installed its listener. The narrow preload bridge now retains/replays the latest sample when requested; inactive mode clears it. Regression test reproduced this lost-first-sample condition before the fix.
- Pointer polling deduplication originally considered cursor position without changed window geometry. Geometry now participates, including negative monitor coordinates. This prevents stale parallax coordinates with a stationary cursor during a mode/bounds change.
- The saved setting was ambient-only. That intentionally disables mouse parallax. The actual Settings UI was changed to **Parallax + smooth ambient motion**. Global Motion OFF and reduced motion remain respected.
- Added bounded development diagnostics for frame cadence, animation timelines, video events, known motion lifecycle events, native status and cursor delivery. Production does not inject the development renderer probe. Logs are sanitized, rotated/bounded, and exported locally only. Atomic snapshot writes now serialize and briefly retry transient Windows file locks rather than losing status writes; the reader-lock regression is tested.
- Search previously submitted a single Spotify URI, so playback ended after that song. It now submits the selected song followed by unique playable recommendations, or artist-filtered search tracks when recommendations are unavailable. Search-result fallback preserves playback if continuation lookup fails. The existing Spotify playback service/player remains in use. Collection and local queues retain their behavior. This is a bounded queue of up to 25 tracks, not unlimited Spotify Autoplay.
- Added the generated **Spontaneous** S ribbon app icon and display name in the native window, tray, menus, browser, SDK device and packaging metadata. Kept `MusicWall` as the internal Electron name and retained the app ID, data directory, storage keys and origin. Existing Spotify connection, local library and theme settings survived the rename. The existing Windows Startup shortcut was renamed and assigned the icon; its target/arguments were preserved. A backup is in `tmp/wallpaper-qa/MusicWall-startup-original.lnk`. A Windows reboot was not performed.

## Files changed for these fixes

- Diagnostics/motion: `desktop/diagnostics.cjs`, `desktop/renderer-probe.js`, `desktop/main.cjs`, `desktop/desktop-status.cjs`, `desktop/wallpaper-input.cjs`, `desktop/wallpaper-preload.cjs`, `src/services/motionDiagnostics.ts`, `src/components/Background/VideoBackground.tsx`, and focused diagnostics/preload/input/album-art tests.
- Search: `src/services/musicBrowser/spotifyBrowser.ts`, `src/components/MusicBrowser/MusicBrowser.tsx`, `tests/spotify-browser.test.ts` (four added continuation regressions; authentication-listener fixture now survives automatic mock clearing).
- Branding: `assets/branding/`, `public/brand/`, `electron-builder.json`, `package.json`, `index.html`, `src/App.tsx`, `src/services/spotify/sdk.ts`, and visible local-library labels. Image tool provenance and final prompt are in `assets/branding/README.md`.

## Commands/results

| Command | Actual result |
| --- | --- |
| Baseline `npm test` | 28 files / 127 tests PASS |
| Debug `npm test`, twice | 29 files / 132 tests PASS; 10.14s and 18.19s |
| Final `npm test` with Search regressions | 29 files / 136 tests PASS; 10.55s |
| `npm run build` | PASS; Vite 3.84s |
| `npm run build:desktop` | PASS; Vite 3.75s; packaging rebuild also PASS |
| `npm run package:win -- --config.directories.output=tmp/wallpaper-qa/spontaneous-package` | PASS; installer exists, 116,023,762 bytes |
| `git diff --check` | PASS; line-ending notices only |

Installer: `C:/Users/User/.codex/worktrees/c633/wallplayer-wallpaper/tmp/wallpaper-qa/spontaneous-package/Spontaneous-Setup-0.1.0-x64.exe`. Built successfully; not a fully verified installed release. Existing chunk-size and duplicate dependency-reference warnings remain. The previous default-icon warning is gone.

## Actual runtime acceptance

Sky captured/inspected actual Electron windows. It cannot capture Explorer's desktop, so desktop visual/interaction results below explicitly rely on the user's direct checks, supported by diagnostics. No mock integration was substituted for the real account.

| Check | Result | Evidence |
| --- | --- | --- |
| Autonomous animation | PASS | Normal-window visual inspection; wallpaper running timelines and ~5.56ms frame interval while unfocused; user reported smooth desktop motion |
| Mouse parallax | PASS | Changed object-position and delivered desktop-pointer counts; user: “works perfectly fine” |
| Wallpaper behind icons, taskbar and Start | PASS, user verified | User confirmed the bundled desktop interaction check; fresh Spontaneous launch again confirmed “Yes, it looks and works correctly” |
| Video/GPU decoding and audible output | NOT TESTED | No video selected; media lifecycle/error tests are automated coverage only |
| Three mode cycles | PASS for native lifecycle and observed returns; desktop cycle 2 visual check interrupted | Three wallpaper/normal status cycles, actual final normal window rendered; no claim that every intermediate desktop frame was captured |
| Minimize/restore during this resumed run | NOT TESTED | Earlier acceptance report covers a prior build; not repeated here |
| Clean shutdown and fresh launch | PASS | Old helper 15204 and server 16972 exited; current-build server 25904 exited; port 4173 released. Fresh launch created helper 17432/server 2372; no errors; user confirmed correct composition |
| Search auto-next with real Spotify | PASS | Entered “Radiohead Creep,” selected Creep; UI showed four queued songs. Sought to 3:52 of 3:58; without another playback action, current track became Fake Plastic Trees with advancing position and Pause button |
| Rename/session compatibility | PASS | Actual title and S icon; current Spotify track/lyrics loaded after restart without signing in; existing local QA tracks and Batman preferences still present |
| Explorer restart, multiple monitors/mixed DPI, sleep/resume | NOT TESTED | No disruptive OS tests performed |
| Installer install/update/uninstall | NOT TESTED | Package built but not installed |

## Evidence locations

Under `tmp/wallpaper-qa/`: `deep-cycle-{1,2,3}-wallpaper.json`, `deep-cycle-{1,2,3}-normal.json`, `deep-final-clean-shutdown.json`, `spontaneous-search-auto-next.png` and `.txt` (real app capture/accessibility), `spontaneous-normal-render.json`, `spontaneous-clean-shutdown.json`, `spontaneous-wallpaper-relaunch.json`, `spontaneous-wallpaper-render.json`, `spontaneous-wallpaper-after-user-check.json`, `spontaneous-startup-shortcut.json`, and Spontaneous launch stdout/stderr files. User desktop confirmations are in this chat; no new desktop screenshot was supplied for the final launch.

Live diagnostics remain under `%APPDATA%/MusicWall/`: `desktop-status.json`, `renderer-status.json`, `desktop.log`, `diagnostics.json`. They retain the legacy directory intentionally.

Next action: perform installer install/update/uninstall testing in a controlled Windows profile, with manual video/audio and sleep/resume checks. The package is ready for that testing; it has not been certified for release. Spontaneous is left running in wallpaper mode.
