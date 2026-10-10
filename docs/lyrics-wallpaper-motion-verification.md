# Lyrics and wallpaper motion fixes — 2026-10-09

Working tree: `C:\Users\User\.codex\worktrees\c633\wallplayer-wallpaper`, branch `feature/windows-live-wallpaper`. Existing unrelated changes were preserved. No release, installer, commit or push was made for this pass.

## Confirmed issues and changes

- Spotify's 650 ms correction deadband discarded corrections large enough to miss lyric boundaries. Apply receipt-age and half HTTP round-trip compensation, rebase interpolation on samples, and account for delayed ticks. Spotify's state-change timestamp is not treated as a progress sampling timestamp.
- A visible wallpaper could be marked hidden by Chromium, stopping polling and pausing configured background media. The existing desktop mode signal now distinguishes attached wallpaper visibility from a hidden browser tab.
- Explorer's icon layer does not deliver ordinary pointer movement to the wallpaper renderer. A bounded passive Electron cursor sample feeds the existing parallax and control visibility logic. It does not focus applications, forward clicks outside existing hit regions, install hooks, or record coordinates.
- Slow artwork motion now uses a stable CSS timeline, independent of playback-clock renders, with the existing intensity and reduced-motion settings.
- Incoming lyric transitions no longer wait for outgoing animations. Pausing during an entry settles the active Dual Split line instead of freezing it at zero opacity.
- Auto-hide now works in wallpaper mode. Idle player controls, including the progress and volume bars, use a subtle blur; keyboard focus, dragging, pause and hover keep them usable.
- Native title tooltips are suppressed in wallpaper mode, with accessible names retained and titles restored in ordinary window mode. Passive pointer exit also clears native control hover.
- The user screenshot of `risk` by lace reproduced the clipped full-song fallback in the real app. Public LRCLIB search returned no timed exact artist/title records for that song. The untimed fallback now explicitly identifies missing synchronized lyrics, uses saved font styling, and provides short manual pages with size fitting. It does not invent synchronized timestamps or accept mismatched artists/releases.

## Commands

| Command | Result |
| --- | --- |
| `npm test` | PASS: 28 files, 121 tests, 9.96 s, 22:11 local time |
| `npm run build:desktop` | PASS, frontend build 3.75 s |
| `npm run build` | PASS, frontend build 4.09 s |
| `git diff --check` | PASS; only existing LF/CRLF conversion warnings |

Earlier full runs during this pass also passed: 118, 119 and 120 tests as regressions were added. Build retains the existing chunk size warning. The initial new plain-lyrics test exposed missing ResizeObserver handling in environments without that API; the component now degrades safely and the final suite passes.

## Running application evidence

Real saved-account Spotify playback was inspected in Electron, including Heartbeat, Like a Tattoo, Mirrors, You, and the user's risk screenshot reproduction. Play/pause and seeking were exercised through the existing controls. A paused seek to 1:00 on You immediately displayed the matching styled upper-left lyric; playback resumed. Background artwork and synchronized lines rendered in the original player. This does not certify audible lyric timestamp accuracy for every provider record.

Before each fresh launch, the ordinary Close action was used and logs verified server cleanup. The final source was launched using `npm run desktop:run -- --windowed`. Observed app-window images and launch output are in ignored `tmp/wallpaper-qa/` (including `motion-playing.jpg`, `motion-idle-blur.jpg`, `final-motion-launch.log`, and `final-motion-errors.log`). Live native diagnostics remain `%APPDATA%\MusicWall\desktop-status.json` and `desktop.log`.

At 22:16, `npm run desktop:run -- --wallpaper` switched the final running source back to wallpaper mode. Native status reports a visible 1920×1080 child behind icons, with helper/server healthy, the existing input surface active, and no attachment errors. Snapshot: `tmp/wallpaper-qa/final-motion-status.json`. This is supporting status, not a desktop screenshot or visual acceptance. The secondary launcher emitted a cache access warning; the owning app remains healthy and its error log is empty.

## Remaining manual checks

The user subsequently confirmed the preceding fixes work. At their request, a separate compositor layer adds a slow continuous two-dimensional drift while idle, independent of cursor movement, music pause, track changes and lyric rerenders. Travel is bounded to 9 px horizontally / 6 px vertically at maximum intensity, with 10 px overscan to avoid exposed edges. This retains the existing image zoom and mouse parallax. Global Motion OFF, zero wallpaper intensity, OS reduced motion and configured hidden-browser pausing are preserved. Focused background/motion tests passed (2 files / 5 tests), and both desktop and browser production builds passed. The renderer was reloaded through Electron's existing Reload action; real Beach Weather playback and the original Dual Split layout were inspected afterwards, then wallpaper mode was restored. Long-duration desktop motion remains a user visual check.

The available computer-use tool captures app windows, not the actual Explorer desktop. Final desktop parallax, long ambient motion, disappearance of the Settings tooltip, idle blur and desktop icon interaction require a user check with the updated attached build. The final untimed risk page rendering is pending real-song replay. Audible synchronization, GPU video decoding, mixed DPI, multiple monitors, sleep/resume, Explorer restart and installer operations were not verified in this pass. Motion OFF and desktop-specific state, cleanup, pointer forwarding and tooltip restoration are covered by focused automated tests, not claimed as real Explorer interaction tests.
