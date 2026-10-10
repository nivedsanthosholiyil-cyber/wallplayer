# Windows live wallpaper verification — 9 October 2026

Historical baseline. See [the stabilization report](windows-wallpaper-stabilization.md) for recovery changes and installer fingerprint, and [the subsequent real desktop acceptance report](windows-wallpaper-acceptance.md) for observed desktop failures, fixes and user screenshots. The results below describe the preceding candidate and are preserved for comparison.

## Status

Experimental Windows x64 implementation completed and installer built. Native attachment is verified on Windows 11 Pro build 26200. A fully verified desktop release is **not** claimed: desktop compositing/icon/taskbar interaction, tray clicks, Explorer restart, video decoding and monitor variations still need manual checks.

Working branch: `feature/windows-live-wallpaper`. Draft PR: https://github.com/nivedsanthosholiyil-cyber/wallplayer/pull/1 . Original dirty worktree was preserved; changes were made in a separate feature worktree. No installer was published, installed or distributed and no PR was merged.

## Root causes and changes

The prototype marked wallpaper mode active without waiting for native attachment. It ignored SetParent/style/position errors and assumed classic top-level WorkerW discovery. This Windows 11 desktop places its icon view and background WorkerW under Progman. The prototype also applied child styles after reparenting, ignored virtual-screen offsets, used fixed restore bounds and killed the helper immediately after a stop-file write.

- `desktop/main.cjs`: acknowledged mode transitions; tray/menu accessibility; original renderer reuse; bounded recovery and orderly shutdown. Background throttling disabled for attached playback/rendering. Server/OAuth/security boundaries preserved.
- `desktop/wallpaper-controller.cjs`: trusted stdin/stdout protocol, readiness timeout, heartbeat, errors, matching acknowledgements and graceful/forced exit confirmation.
- `desktop/wallpaper-native.cs`: PID/ HWND ownership validation; Windows 11/classic host discovery; styles before parenting; physical virtual-screen coordinates; real parent/bounds/stacking checks; original normal bounds/styles restored. Polling avoids repeated no-op frame resizing.
- `desktop/wallpaper-host.ps1`: native compilation and protocol loop, EOF/parent-death cleanup, read-only probes, temporary Explorer-host retry and explicit window-loss notification. No execution-policy bypass.
- `tests/wallpaper-host.test.mjs`: behavior tests plus actual Windows compilation/probe/invalid-owner checks.
- `tests/desktop.test.mjs`: obsolete source-string wallpaper smoke test replaced by the behavior/native tests above; existing server/OAuth tests retained.
- Desktop documentation updated; this report records limits instead of treating source tests as desktop proof.

A recovery race was corrected: intentional helper exit after window loss must not be treated as a helper crash that overwrites the desired wallpaper mode. Actual Explorer restart remains unverified.

A separate hidden-launch QA flag caused a first normal-window return to become hidden. A proposed hide/show workaround did not resolve that artificial launch condition and was removed. The ordinary npm wallpaper launch returned to a visible normal window on its first request; a later native probe still confirmed visibility. The installer source matches the final implementation.

## Commands and results

| Command | Result |
| --- | --- |
| `git status`; `git branch --show-current` | Feature branch confirmed; unrelated original work preserved. |
| `npm ci` | Passed. Existing build-tool audit reported 8 moderate advisories; no broad dependency upgrade. |
| `npm test` | Intermittent: two full runs passed 21 files/86 tests; the last unrestricted run had 80 passed/6 failed after the existing Spotify-sync test timed out and left overlapping React act calls. Initial intermediate run also had 6 failures. This command is not claimed reliably green. |
| `npm test -- --maxWorkers=2` | Final source: 21 files, 86 tests passed (18.72 seconds). Earlier intermediate suite: 84 tests passed. |
| `npm test -- tests/wallpaper-host.test.mjs tests/desktop.test.mjs` | 2 files, 21 tests passed after recovery/shutdown tests were added. |
| `npm test -- tests/wallpaper-host.test.mjs` | 10 tests passed, including two real Windows helper checks. |
| `npm run build` | Passed. Existing approximately 501 kB bundle warning remains. |
| `npm run build:desktop` | Passed. Same bundle warning. |
| `npm run desktop -- --windowed` | Built and launched real Electron UI. |
| `npm run desktop:run -- --wallpaper`; `npm run desktop:run -- --windowed` | Real native wallpaper attachment and return to normal mode passed on the ordinary launch path. Second instance reused the current app/server. |
| PowerShell helper `-Probe` | Actual C# compilation and read-only shell topology passed; owned-window probes confirmed normal parent/style/visibility. |
| `npm run package:win` | Passed; local unsigned NSIS installer and unpacked application produced. |
| ASAR extraction comparison | All four desktop implementation files exactly match final source; archive excludes node_modules, tests and env files. |
| `git diff --check` | Passed (only Git line-ending warnings). |

## What was actually observed

- Native wallpaper statuses: owned Electron HWND parented to current Progman, WS_CHILD set, icon-view sibling above it, visible, virtual desktop exactly 1920 x 1080 at (0,0). This proves native host/stacking/geometry, not an unobscured desktop screenshot.
- Normal mode status: parent 0, child false, visible, original 1360 x 900 outer bounds restored. Main player and Browse Music rendered in real app screenshots.
- Native file picker imported two generated local WAVs through the existing Local Music input. Actual track duration/progress and automatic advance to the second WAV were observed after wallpaper attachment/normal return. Audible sound was not independently verified.
- Imported local library survived app restart. Batman selection and its existing player visual survived clean restart. Themes, lyrics and renderer source were not modified.
- Real Spotify tracks, album-art transitions, playlists and fetched synchronized lyric content appeared after the user connected/started playback. No authentication form was automated. A complete OAuth/reconnect, remote play/pause/seek/volume test was not completed; user input interrupted control checks. This is not proof of provisioned in-app Spotify DRM streaming.
- Alt+F4 normal-window quit logged helper/server stopped; native process and port inspection showed no wallpaper helper and no listener on 4173 afterward. Relaunch succeeded.
- A real temporary HTTP listener occupied 4173. MusicWall logged the explicit port-conflict error and did not navigate to that listener. Its native startup error dialog was not capturable; the QA instance was terminated and the temporary listener stopped.

## Exact computer-access limitations

The computer-use API rejects the desktop-attached child with `window is not a usable app window`; it is omitted from targetable app windows. It provides app-window capture, not an unrestricted desktop screenshot API. Therefore a full desktop screenshot with MusicWall behind icons was **not** inspected. Desktop icon usability, taskbar/Start menu and tray clicks were **not** verified.

Task Manager reported that accessibility was limited because it ran at a higher Windows integrity level than the helper. No privilege/security bypass was attempted. The user was asked to show the desktop/send a screenshot and manually restart Explorer; those confirmations are still outstanding.

Multiple monitor/mixed-DPI/negative-coordinate changes, sleep/resume, GPU video codecs, local file relinking across reinstall and installer install/update/uninstall remain manual gates. Renderer/window recreation after Explorer destroys it can lose sessionStorage and local playback; reconnect may be needed. Unsigned installer and default Electron application icon remain release limitations.

## Installer

- Path: `C:\Users\User\.codex\worktrees\c633\wallplayer-wallpaper\release\MusicWall-Setup-0.1.0-x64.exe`
- Size: 115,339,684 bytes.
- SHA-256: `2A9EE828E74E008B2D8853005E078ACB06A179C38B6546D75AF82316DE00704F`.
- Authenticode: **NotSigned**. Builder signing-stage output is not evidence of a signature.
- Existing installers in other worktrees were untouched. A local QA backup of this candidate was kept under ignored `tmp/wallpaper-qa` during visibility investigation.

Register the desktop public-client Spotify redirect `http://127.0.0.1:4173/callback`; retain browser development `http://127.0.0.1:5173/callback`. No client secret is embedded.

## Remaining manual checklist

1. Show desktop: inspect wallpaper behind icons and open/select icons, Start menu and taskbar.
2. Use tray Open window / Set wallpaper / Quit and test minimize/restore.
3. Restart Explorer and confirm attachment/recovery, then quit and verify cleanup.
4. Test video GPU decoding and audible playback, including seeking/pause/volume and queue continuation.
5. Finish real-account Spotify reconnect and remote control checks.
6. Test extra monitors/DPI/arrangements and sleep/resume.
7. Install/update/uninstall the unsigned candidate in an appropriate test environment; confirm profile retention.
