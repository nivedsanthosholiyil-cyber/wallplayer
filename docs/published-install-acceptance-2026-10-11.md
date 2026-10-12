# Published Windows installer acceptance — 2026-10-11

Current testing checkpoint, before the larger audit scheduled for 02:00 Asia/Calcutta. Preserve this evidence and continue outstanding runtime checks. This is not release approval.

## Published package and profile

- Release: `v0.1.1-preview.1`, application version `0.1.1`.
- Fresh download: `tmp/release-install-qa/2026-10-11/Spontaneous-Setup-0.1.1-x64.exe`.
- URL: https://github.com/nivedsanthosholiyil-cyber/wallplayer/releases/download/v0.1.1-preview.1/Spontaneous-Setup-0.1.1-x64.exe
- Size: 116,024,471 bytes.
- SHA-256: `FF595B38CC8B1DC0585D43AD9D3EE8E9A07893CE7023411A72D6DFA8BA8A56AD`, matching GitHub's published digest.
- Authenticode: NotSigned. This does not establish the cause of the friend's setup access error.
- Installer and embedded `app-64.7z` both passed the existing 7-Zip integrity check.
- Installed directory: `C:/Users/User/AppData/Local/Programs/Spontaneous`.
- Installed and published `resources/app.asar` SHA-256 both equal `7B3914B7A5543D04EF148D1A29CD1507BEB11589990BD060FC73706CBBFCE98B`.
- Before installation, all 432 profile backup files were byte-verified with zero mismatches. Backup: `tmp/release-install-qa/2026-10-11/backup-before-install/MusicWall`.
- Existing `%APPDATA%/MusicWall` retained. No credential, settings or IndexedDB reset, no profile deletion.
- NSIS configuration retains data on uninstall (`deleteAppDataOnUninstall: false`). Actual uninstall retention is not yet tested.

## Current installed-release results

| Check | Result | Evidence / limit |
| --- | --- | --- |
| GitHub download and integrity | PASS | Published digest, NSIS and payload archive checks |
| Current application uninstall | NOT TESTED | No registered installed copy found before this installation; prior development runtime closed normally |
| Fresh installation | PASS | Installed executable, resources, uninstall registration and shortcuts exist; all installer pages and final exit code were not observed |
| Application launch | PASS | Launched actual Start menu shortcut; installed executable rendered moonlit artwork and controls |
| Shortcuts and packaged files | PASS | Start menu/Desktop shortcuts point to installed executable; exact archive match; all 43 built frontend files served byte-for-byte |
| Existing user-data preservation | PASS | Verified backup and retained legacy profile; this does not prove every saved feature still operates |
| Spotify authorization | NOT TESTED | Existing session present; no new account authorization completed |
| OAuth callback | NOT TESTED | No real OAuth round trip in this installed session |
| Session persistence after restart | NOT TESTED | Installed restart/reconnection not completed |
| Spotify playback controls | NOT TESTED | Spotify app Play clicked with user permission; later window title changed to another track, but installed controls, progress and audible output remain unverified |
| Local music playback | NOT TESTED | Installed media playback not exercised |
| Wallpaper rendering | NOT TESTED | Installed app currently in normal mode; earlier development/user checks are not acceptance of this release |
| Parallax and animations | NOT TESTED | No installed desktop observation |
| Clean shutdown and relaunch | NOT TESTED | Prior development shutdown verified; installed shutdown not yet tested |
| Installer cleanup/uninstall | NOT TESTED | No uninstall of the user's installed application performed |

## Confirmed repairs and unpublished candidate

See `docs/input-repair-2026-10-11.md` for source changes and focused native fixture results.

1. Confirmed recovery defect: synchronous `dialog.showErrorBox()` blocks the main event loop while a recovery timer is pending. Local source uses asynchronous `showMessageBox()` and tests recovery while its promise remains unresolved. The published installed archive still contains the old defect.
2. Pointer-capture cleanup: local input preload releases a routed held button on cancellation/lost capture, once. Regression test exercises the actual preload and input bridge. This does not establish that the friend's whole-app image-upload freeze is fixed.
3. Native input placement retains owner ordering and reports the numeric Win32 error, handles and bounds. Retry is restricted to a vanished preceding sibling. That race is defensive handling, not a proven explanation of the friend's failure.
4. Confirmed duplicate startup configuration on this PC: the previous Startup shortcut launched development Electron while the installed HKCU Run entry launched the installed executable. After verifying its exact target/arguments, moved only the obsolete development shortcut into `backup-before-install/legacy-startup-disabled.lnk`. The installed startup entry remains.

Local candidate: `tmp/wallpaper-qa/input-repair-2026-10-11/Spontaneous-Setup-0.1.1-x64.exe`. Built separately, not installed, published or distributed. Previous installers and unrelated changes preserved.

## Commands and results

- Existing 7-Zip `t`: published installer and embedded payload passed.
- `npm test`: earlier 29 files / 143 tests passed. Current rerun initially failed: 28 files / 132 tests passed, desktop worker terminated with code `3221226505`.
- `npx vitest run tests/desktop.test.mjs`: also initially terminated with that code. Subsequent full verbose run passed all 12 tests; isolated server/media, port-conflict and OAuth-policy checks passed. Standalone HTTP listen/fetch/close passed. No matching Node crash entry returned by the inspected Application event-log query. Cause remains unresolved; no test timeout, assertion, pool or concurrency change was made to conceal it.
- Subsequent `npm test` passed, then three consecutive normal-command repeat runs each passed 29 files / 143 tests. Logs: `tmp/release-install-qa/2026-10-11/test-repeat-1.log` through `test-repeat-3.log`; summary `test-repeat-results.json`.
- `npm run build:desktop`: passed earlier after local repairs, existing bundle-size warning.
- `npm run test:installer`: 9 checks passed earlier.
- `npx electron-builder --win nsis --x64 --publish never --config.directories.output=tmp/wallpaper-qa/input-repair-2026-10-11`: passed earlier; candidate path exists.
- `git diff --check`: passed; only Git LF/CRLF notices.
- Read-only installed asset check: 43 checked, zero failures; `tmp/release-install-qa/2026-10-11/packaged-assets-check.json`.
- Installed loopback server responded HTTP 200 with the expected CSP; diagnostic status reported server ready, normal mode, no errors.

## Runtime blockers and next action

Computer Use initially captured the actual installed app and Spotify, then repeatedly reported `window is minimized` and, on recovery, `user input was detected in this window; call get_window_state before continuing`. Fresh selection and one recovery attempt failed for both apps. Stop stale-coordinate input; this is an automation limitation, not proof of an application freeze. Initial captures were displayed by the tool; no screenshot files were created for this checkpoint.

An earlier combined relaunch/asset-check command was rejected by automatic approval review as `blocked by policy`, with no more specific reason. It did not execute. The independent read-only asset check subsequently succeeded. No relaunch bypass was attempted.

Most important next action: regain reliable installed-window observation, then reproduce the friend's image-upload freeze and native attachment failure with numeric diagnostics. Do not substitute the local repaired candidate and claim the published release passed. Real OAuth, audible output, video motion, desktop icon/Start interactions, installed mode cycles and shutdown still need actual verification. Preserve security settings and real user data; no publication authorized.
