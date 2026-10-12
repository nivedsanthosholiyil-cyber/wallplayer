# Windows live-wallpaper acceptance — 2026-10-09

Later wallpaper-control work is tracked in [the input verification report](windows-wallpaper-input-verification.md). Its new desktop interaction/composition checks are pending and are not covered by the earlier PASS results below.

Branch `feature/windows-live-wallpaper`, base `de4d263`. Existing dirty stabilization work was preserved. Nothing was reset, cleaned, pushed, merged, published or installed. The old installer is unchanged.

## Real desktop results

Computer-use captures ordinary app windows, not the attached desktop child. Normal-window screenshots below were captured and inspected by the agent. Full-desktop screenshots and desktop interactions came from the user. Native attachment diagnostics are supporting evidence only.

| Test | Result | Evidence |
| --- | --- | --- |
| Wallpaper behind desktop icons | PASS | `desktop-icons-rendering-fixed-user.png` and `desktop-final-relaunch-working-user.png` show MusicWall artwork/controls behind enabled icons. |
| Desktop icons clickable | PASS | User answered yes to double-clicking an icon and opening Start after the rendering fix. Manual user interaction, not agent automation. |
| Taskbar and Start menu | PASS | Earlier Start/search screenshots show those surfaces above MusicWall; user reconfirmed Start after the rendering fix. Taskbar is visible; not every taskbar action was exercised. |
| Correct screen coverage | PASS | Final desktop artwork has no visible border or blank region; native physical bounds are 0,0,1920,1080. Uploaded screenshots are slightly cropped. Other monitors are untested. |
| Normal window mode restored | PASS | Visually inspected `final-normal-cycle-1.jpg`, `-2.jpg`, `-3.jpg`; ordinary native bounds 280,66,1360,900. First cycle started minimized. |
| Repeated mode switching | PASS | Three normal → wallpaper → normal cycles, native wallpaper snapshots and inspected ordinary windows after each return. These preceded the final cold-start visibility addition, subsequently verified by a fresh-launch user screenshot. |
| Explorer restart recovery | NOT TESTED | Explorer was not restarted; unsaved work in other apps could not be ruled out. Simulated recovery tests do not prove Explorer restart. |
| Clean shutdown and relaunch | PASS | Native Close exited Electron, helper PID 23176 and server; no listener remained on 4173. `final-clean-shutdown.json` records stopped processes. Cold wallpaper startup initially failed, was fixed, and the final user screenshot confirms relaunch artwork. |

MusicWall is left running in wallpaper mode. User successfully used tray Quit during investigation. Tray Open/Set clicks were not directly verified; mode cycles used existing second-instance `--windowed` / `--wallpaper` actions.

## Confirmed bugs / focused fixes

1. **Artwork vanished when icons were enabled despite correct native attachment.** Exiting Wallpaper Engine did not fix it. Windows startup now selects Chromium `disable-direct-composition` before app readiness. The user desktop screenshot confirms the compatible surface renders below icons. GPU acceleration remains enabled, but real video decoding/performance is untested. Attempting to remove `NOREDIRECTIONBITMAP` on a live HWND produced a Windows style error; that failed candidate was reverted.
2. **Normal restoration used minimized/offscreen coordinates.** Native capture now uses ordinary placement for minimized windows, rejects minimized sentinel bounds, clears minimized/maximized wallpaper style bits, and restores before applying saved bounds. Repeated normal requests reissue native restoration, with unconditional Electron restore.
3. **Minimized renderer returned blank after native reparenting.** Electron restores the window before attachment so Chromium receives the visibility change. The actual minimize → wallpaper → normal retest displayed the artwork correctly.
4. **Cold wallpaper startup was blank despite verified attachment.** Native ShowWindow did not notify the hidden Chromium renderer. Electron now calls `showInactive()` after attachment without focusing a normal fullscreen window. Final fresh-launch user screenshot confirms rendering with icons enabled.

Read-only topology probes now report descendant HWND classes/PIDs/styles in sibling order without titles/content. Explorer styles, privilege settings, themes and renderer/player systems were not changed.

## Commands / actual results

Working directory: `C:\Users\User\.codex\worktrees\c633\wallplayer-wallpaper`.

- `npm run build:desktop`: PASS, several rebuilds, latest frontend build at 20:25 (Vite 6.4.4). Desktop main/helper files are loaded directly from source by the launch script.
- `npm run desktop:run -- --windowed` / `--wallpaper`: actual process launch and mode switches. Rendering experiment initially used `--disable-direct-composition`; final launch uses the Windows startup code without that extra CLI argument.
- `npm test`: initial baseline 23 files / 95 tests passed; new native and lifecycle regressions brought this to 97. Final-source normal runs at 20:30:58 and 20:31:56 both passed **23 files / 97 tests**, durations 8.33s and 8.20s. No act warnings or Spotify timeout in those runs.
- `npx vitest run tests/wallpaper-host.test.mjs tests/wallpaper-lifecycle.test.mjs tests/desktop-status.test.mjs tests/desktop.test.mjs`: PASS, **4 files / 32 tests**, 1.92s. This preceded the last showInactive assertion, which passed in both later full runs.
- `npm run build`: PASS, 4.10s production build. Existing chunk-size warning remains.
- `powershell.exe -NoLogo -NoProfile -NonInteractive -File desktop/wallpaper-host.ps1 -Probe`: actual C# compilation/read-only desktop probe succeeded.
- `git diff --check`: PASS.

Secondary Electron instances occasionally printed cache/GpuCache access errors while sharing the primary profile; requests still completed. Final primary startup stderr and structured error state were clear.

## Evidence paths

Directory: `C:\Users\User\.codex\worktrees\c633\wallplayer-wallpaper\tmp\wallpaper-qa\acceptance-2026-10-09` (ignored local evidence).

- Final desktop: `desktop-final-relaunch-working-user.png`.
- Earlier fixed desktop: `desktop-icons-rendering-fixed-user.png`.
- Failures: `desktop-icons-blank-failure-user.png`, `desktop-blank-after-wallpaper-engine-exit-user.png`, `desktop-direct-start-blank-user.png`.
- Restored-window screenshots: `final-normal-cycle-1.jpg`, `final-normal-cycle-2.jpg`, `final-normal-cycle-3.jpg`.
- Native snapshots: `final-wallpaper-cycle-1.json`, `final-wallpaper-cycle-2.json`, `final-wallpaper-cycle-3.json`.
- Lifecycle/logs: `final-clean-shutdown.json`, `final-relaunch-status.json`, `desktop.log`, `final-desktop-topology.json`.
- Final primary stdout/stderr: `tmp\wallpaper-qa\acceptance-visible-relaunch.log`, `acceptance-visible-relaunch-errors.log`.
- Live diagnostics: `%APPDATA%\MusicWall\desktop-status.json` and `desktop.log`.

## Remaining gates / installer readiness

NOT TESTED: real Explorer restart, comprehensive tray interactions, wallpaper control hit-testing under enabled icons, real Spotify reconnect/controls, audible output, GPU video decoding, multiple monitors/mixed DPI, sleep/resume, installer install/update/uninstall. Existing lyrics overlap some desktop icon labels in the screenshot; lyric layout was not redesigned in this native-host pass. A separate orange control widget remains and was not identified or modified.

The tested source can proceed to a **controlled new installer build and installer testing** with the above gates open; it is not a fully verified release. Preserved `release\MusicWall-Setup-0.1.0-x64.exe` predates these fixes (115,340,537 bytes). No installer was rebuilt or installed in this acceptance pass.
