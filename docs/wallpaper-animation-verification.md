# Wallpaper motion verification — 2026-10-09

Branch: `feature/windows-live-wallpaper`. Existing changes preserved. No publishing, installation or merging.

## Confirmed issues and fixes

- Album-art pointer/idle movement had been reduced to nearly imperceptible values. Album art now moves smoothly through its existing cover crop using object-position, with no additional zoom or distortion. A square cover on a widescreen has vertical crop slack but no horizontal slack; movement follows available space.
- A renderer reload lost the desktop-mode notification. Wallpaper input now replays its current mode and cursor on did-finish-load, clears the previous polling interval and unregisters its listener on destruction.
- Motion was initially saved OFF. This correctly disabled animations. Later runtime samples report Motion ON and advancing animation timelines.
- Added Settings → Wallpaper → Motion → Wallpaper motion: Parallax only, Smooth ambient motion only, or both. Choice persists locally, defaults to both for old preferences, and respects global Motion OFF/reduced motion. Idle drift uses slow ease-in-out motion; album mouse movement uses a smooth object-position transition.
- Added secret-free renderer diagnostics at `%APPDATA%/MusicWall/renderer-status.json`.

Files: desktop/main.cjs, desktop/wallpaper-input.cjs, src/components/Background/VideoBackground.tsx, AlbumArtBackground.tsx, src/styles.css, src/types/interfaceSettings.ts, src/data/settingsValidation.ts, src/components/Settings/WallpaperSettingsPage.tsx and focused motion/album-art/wallpaper-input tests.

## Commands and results

- Baseline `npm test`: 28 files / 123 tests passed.
- Latest `npm test`, twice: 28 files / 127 tests passed (11.76s and 11.33s).
- `npm run build`: passed. Existing large-chunk warning.
- `npm run build:desktop`: passed. Existing large-chunk warning.
- `npx electron-builder --win --x64 --dir --config.directories.output=tmp/wallpaper-qa/animation-package --publish never`: passed. Unpacked executable verified at `tmp/wallpaper-qa/animation-package/win-unpacked/MusicWall.exe`. This is not a newly built NSIS installer. Default-icon warning remains.
- `git diff --check`: passed; existing line-ending notices.

## Running application evidence

Electron displayed the new selector and all three options. Ambient-only was selected through the actual UI, followed by renderer reload. Runtime then showed no pointer displacement and continued idle motion. Spotify continued real playback and track changes.

Wallpaper samples in `tmp/wallpaper-qa/ambient-wallpaper-before.json` and `ambient-wallpaper-after.json` show wallpaper=true, hidden=false, motion=on, running timelines and changing object-position. This proves renderer animation progression, not visual desktop composition. Native diagnostics reported 1920×1080 attachment and no recovery errors.

| Check | Result | Evidence/limitation |
| --- | --- | --- |
| Settings selector rendering | PASS | Actual Electron UI inspection |
| Ambient animation progression in wallpaper renderer | PASS | Two runtime diagnostic samples |
| Visually smooth wallpaper animation | NOT TESTED | Actual Explorer desktop inaccessible to capture tool |
| Mouse parallax on actual desktop | NOT TESTED | Automated routing/cleanup tests pass; desktop interaction pending |
| Video on actual desktop | NOT TESTED | No video selected; focused media lifecycle test passes |
| Desktop icons, Start/taskbar | NOT TESTED | Cannot inspect Explorer desktop through available UI tool |
| Mode switching | PASS for native lifecycle only | Three earlier native cycles; actual normal Electron window observed |
| Clean shutdown/relaunch | PASS for process lifecycle | Normal close stopped previous helper/server; fresh launch healthy |
| Explorer restart, mixed DPI, sleep/resume | NOT TESTED | No destructive desktop test performed |

Next action: verify visually on the desktop that ambient drift and parallax are smooth and desktop icons/Start remain usable. Release acceptance remains pending this check; no release was published or installed.
