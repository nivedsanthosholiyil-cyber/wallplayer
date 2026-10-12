# Background pause while using other apps

Implemented on `feature/windows-live-wallpaper`, preserving existing uncommitted fixes and the installed MusicWall profile. No installed application, credentials, startup configuration, previous installer, or release was replaced.

## Behavior and implementation

- The existing Wallpaper setting is now labelled **Pause background while using other apps**. Its stored `pauseWhenInactive` preference is retained and defaults to enabled.
- The native helper reads the foreground HWND during its existing 500 ms health check. It identifies the desktop/taskbar and the application's owned windows; merely running another app does not pause the background. No hooks, window-title collection, input interception, or foreground manipulation were added.
- A boolean activity message travels through the existing helper controller and restricted preload. Diagnostics expose only `desktopActive`, never the identity of the other app.
- Background video pauses without clearing its source or changing its playback position. Breathing and existing parallax transitions freeze at the current frame. Cursor sampling stops while another app is active and resumes on return.
- New track artwork is held while paused; on return, only the most recent requested artwork loads. The normal browser/window background also pauses on focus loss or hidden visibility.
- Playback services, Spotify polling, lyric synchronization, and music controls are unchanged. Disabling the setting keeps background video and autonomous motion running.

Changed production files: `desktop/wallpaper-native.cs`, `desktop/wallpaper-host.ps1`, `desktop/wallpaper-controller.cjs`, `desktop/main.cjs`, `desktop/wallpaper-input.cjs`, `desktop/wallpaper-preload.cjs`, `desktop/desktop-status.cjs`, `src/components/Background/VideoBackground.tsx`, and `src/components/Settings/WallpaperSettingsPage.tsx`. Other pre-existing repairs remain intact.

## Verification

Evidence directory: `tmp/release-install-qa/2026-10-11`.

| Check | Result | Evidence |
| --- | --- | --- |
| Initial existing suite | PASS | `activity-baseline-tests.log`: 30 files, 146 tests |
| Final complete suite | PASS | `activity-tests-3.log`: `npm test`, 30 files, 152 tests |
| Foreground signal, validation, deduplication, input cleanup, server continuity | PASS | Regression tests for helper protocol, input bridge, preload, main lifecycle and diagnostics |
| Artwork held across track changes, latest artwork on return, parallax freeze, setting opt-out | PASS | Background component regression tests |
| Production browser build | PASS | `npm run build`; `activity-build-web-final.log`, built in 5.12 seconds |
| Desktop build | PASS | `npm run build:desktop`; `activity-build-desktop-final.log`, built in 4.51 seconds |
| Windows packaging | PASS | `npx electron-builder --win nsis --x64 --publish never --config.directories.output=tmp/release-install-qa/2026-10-11/activity-candidate`; `activity-package.log` |
| Actual Windows foreground detection and real video pause/resume | PASS in isolated QA window | `activity-foreground.jsonl`, `activity-runtime-samples.jsonl`; built frontend, real local WebM, native read-only foreground probe, existing production preload |
| Local music continues while background is frozen | PASS in isolated QA window | Real WAV imported and played through Music Library. Samples from 04:06:28–04:07:19 UTC show player position 30.3 → 81.6 seconds with `playerPlaying:true`, video fixed at 0.240826 seconds and breathing fixed at 211298.552 ms |
| Installed app behind-icons integration with this change | NOT TESTED | Installed published release is unchanged. QA window was a normal, temporary window; no behind-icons claim is made |
| New-build Spotify playback / audible hardware output | NOT TESTED | Local media state was verified; no real-account Spotify or audible-output claim |
| CPU/GPU savings measurement | NOT TESTED | Animation/video suspension verified; no numerical savings claim |

The first changed full suite exposed an outdated diagnostics expectation after adding `desktopActive`; that assertion now checks the new field explicitly and still rejects secret/arbitrary fields. The next full run passed all 151 tests; adding a normal-focus regression brought the final passing count to 152. No assertions or timeouts were weakened.

Builds retain the existing large-chunk warning. The temporary media profile is `activity-profile`, separate from `%APPDATA%/MusicWall`. The first hidden test window was not discoverable through computer use; only that uniquely identified temporary QA main process was terminated, and its read-only probe exited when its parent exited. Subsequent test windows shut down normally. Window captures sometimes returned stale UI content or another foreground window; live renderer/media samples supplied the timing evidence, not those captures alone.

## Local setup artifact

`tmp/release-install-qa/2026-10-11/activity-candidate/Spontaneous-Setup-0.1.1-x64.exe`

- Exists: verified, 116,025,009 bytes.
- SHA-256: `73A6C0C282095622618B39D799E25034D577B7016ADDAA6733D0D00821DAC01E`.
- Unsigned local candidate; not installed or published.
- Previous installers remain intact.

Next action: apply this local candidate and verify foreground pause/resume on the installed desktop wallpaper. This change is implemented and media-tested, but the current installed copy still uses the earlier code.
