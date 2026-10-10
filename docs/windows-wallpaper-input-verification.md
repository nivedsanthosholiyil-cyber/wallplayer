# Wallpaper control input — 2026-10-09

Continues the existing `feature/windows-live-wallpaper` implementation and [desktop acceptance report](windows-wallpaper-acceptance.md). No installer was rebuilt, installed or published. Unrelated dirty work remains intact.

## Changes

- A sandboxed, shaped input window above the icon view forwards its own native events to the existing MusicWall renderer. The original player and settings retain their state and actions.
- Only visible controls and open panels become hit regions. Settings, Browse Music and visual-search scrims are excluded so they cannot turn the entire desktop into an input surface.
- Native ownership checks cover both MusicWall HWNDs. The helper hides/detaches/restores the input window when returning to normal mode; Electron destroys it after helper shutdown or window recovery.
- Slider drags retain button-down modifiers and release correctly outside the viewport. Wheel and keyboard forwarding are bounded to the owned input surface.
- Auto-hide is suspended while attached. Explicit player visibility remains unchanged.
- Diagnostics contain active input status, region count and routed mouse-event count, with no keys or coordinates recorded.

## Actual observations

The first candidate exposed rectangular pieces of Windows' underlying wallpaper over the controls. The user supplied `tmp/wallpaper-qa/input-composition-failure.png`; the user clarified that they had hidden desktop icons themselves. The updated helper gives the input-only surface a layered style and global alpha of 1/255. Its pixels are opaque before that global alpha is applied, preserving nonzero hit testing. The control surface is shown only after native parenting/composition is ready.

Fresh process launch and native topology show the input window above DefView and the existing wallpaper renderer below it. The server/helper are healthy and no attachment errors were reported. The running candidate initially reports eight hit regions. These are supporting diagnostics, not proof that clicks or visible composition work correctly.

Normal mode was visually inspected before clean shutdown twice during this change. Process/log checks confirmed previous Electron/server/helper processes exited before each fresh launch. Full-desktop screenshots and direct clicks cannot be automated with the available app-window capture tool. The user has been asked to verify Play, Settings, slider dragging and desktop icons; the latest candidate's result is **PENDING / NOT VERIFIED**. Do not promote this to a fully verified release without that check.

## Commands and results

Working directory: `C:\Users\User\.codex\worktrees\c633\wallplayer-wallpaper`.

- `npx vitest run tests/wallpaper-input.test.mjs tests/wallpaper-host.test.mjs tests/wallpaper-lifecycle.test.mjs`: **PASS, 3 files / 25 tests**, 21:00:55.
- `npm test`: **PASS, 25 files / 104 tests**, twice at 21:03:44 and 21:07:20 (8.20s and 7.76s). No Spotify timeout or overlapping act warnings in these runs.
- `npm run build:desktop`: **PASS**, 21:01; new desktop/helper files are loaded from source by `desktop:run`.
- `npm run build`: **PASS**, 21:04; existing chunk-size warning remains.
- Actual PowerShell native helper compilation/read-only topology probe: **PASS**. Tests also exercise layered input style selection without modifying Explorer.
- `npm run desktop:run -- --windowed`: returned the existing renderer to an ordinary window. Native Close followed by process/log checks confirmed cleanup.
- Fresh `npm run desktop:run -- --wallpaper`: running the final source candidate. Stdout/stderr: `tmp/wallpaper-qa/input-final-launch.log`, `input-final-errors.log`.

## Manual gates

NOT VERIFIED: new input surface composition; Play/Settings/slider/search interaction; icons usable with that surface active; open native file dialogs; browser zoom; mixed DPI/multiple monitors; Explorer restart; sleep/resume; real-account Spotify controls/reconnection; audible output/GPU video; installer install/update/uninstall. File drag-and-drop through the input-only surface is unsupported; import files in normal-window mode.

Live diagnostics: `%APPDATA%\MusicWall\desktop-status.json` and `desktop.log`. Local evidence: `tmp\wallpaper-qa\input-*`. The preserved earlier installer does not contain these changes.
