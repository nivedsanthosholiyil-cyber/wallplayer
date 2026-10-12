# Windows wallpaper acceptance and stabilization — 9 October 2026

## Scope and release status

Continued `feature/windows-live-wallpaper` from `de4d263`. The existing architecture, renderer, Spotify services, lyrics, themes and unrelated worktree were preserved. No installer/PR was published or merged. This is an unsigned experimental candidate, **not a fully verified Windows release**.

The preceding [verification report](windows-wallpaper-verification.md) remains the historical baseline, including its passing bounded run of **21 files / 86 tests** and its unrestricted failures. All those tests remain; nine focused tests were added.

## Test investigation

- Three pre-change normal `npm test` runs passed all 86 tests (9.29, 9.05 and 8.98 seconds). The previously reported Spotify timeout/overlapping-act sequence did **not** reproduce in this session, so its exact historical trigger is not claimed proven.
- Inspection found that Spotify tests imported the entire application within the first five-second test after fake timers were enabled. Several tests only unmounted on the success path, and lyrics mock implementations could survive between tests. A failed test could therefore leave mounted React roots, polling listeners/timers and store subscribers affecting subsequent tests.
- Application imports now happen during module setup, outside timed test execution. Every root is registered and unmounted in unconditional asynchronous teardown before fake timers are cleared/restored. Per-test mock defaults and player source are reset. Existing assertions and test timeouts were retained; the worker configuration was not reduced.
- Five intermediate normal runs passed all 95 tests without overlapping-act warnings. A later repeat during Windows packaging passed once, then reproduced a **different Settings test timeout** (94 passed / 1 failed). Settings used repeated real-time sleeps inside act for animation scheduling. Those were replaced with state commits followed by controlled advancement of animation frames. All focus, theme, preview and persistence assertions remain. The runtime Settings implementation was not changed.
- Final repeated normal-suite results are recorded below. Passing repetitions demonstrate the observed stability of this candidate; they are not proof that every possible machine/load condition is covered.

## Recovery and cleanup fixes

- Helper crash recovery schedules normal-window presentation before destroying the old window. Otherwise its closed event could schedule wallpaper recovery first. Recovery retains the user's desired and persisted wallpaper preference; explicit normal-window selection updates it even when already showing the fallback window.
- A native child-window close while attached schedules recovery rather than being treated as an application Quit action. Explicit app/tray Quit still follows orderly shutdown.
- Verified mode responses must match an outstanding command before changing controller state. Unrelated acknowledgements cannot overwrite the current verified mode.
- Temporary Explorer-host recovery is represented explicitly until a verified heartbeat confirms reattachment.
- Server shutdown is idempotent and waits for the exit event after requesting termination. A kill request alone no longer produces a successful-cleanup claim. Unconfirmed termination is reported.

## Automated coverage and its limits

`wallpaper-lifecycle.test.mjs` executes the actual main-process module with isolated Electron/helper adapters: destroyed-window recreation, child close, helper-crash normal return, desired preference preservation, same-renderer normal restoration, and helper/server shutdown. Controller stream tests cover temporary host loss, reattachment, intentional exit, unexpected crash, acknowledgement integrity and bounded forced cleanup. Existing real HTTP server tests cover occupied ports, idempotent close and successful rebinding.

Two Windows helper tests still compile the actual C# implementation, probe the live desktop **without changing it**, and reject an invalid HWND/owner. All lifecycle adapter tests are automated simulations. They do **not** verify a real Explorer restart, tray interaction, compositing or desktop icons.

## Diagnostics

The main process writes `%APPDATA%/MusicWall/desktop-status.json` and structured `Desktop status:` entries in `desktop.log`. Snapshots include current/desired mode, recovery state, attachment status, native parent/window HWND, actual/expected bounds, helper PID/heartbeat/stopping state, server PID/readiness, and up to eight recent attachment errors. Only selected fields are copied; no renderer/authentication payloads are included. Native geometry is the last helper observation, not proof of visual correctness.

The already-running Electron process was left undisturbed. It does not load these new main-process changes until restart. This pass did not inspect new runtime screenshots or manually exercise the desktop.

## Commands and gates

| Command | Result |
| --- | --- |
| `npm test` before changes, three times | 21 files / 86 tests passed each time; historical Spotify timeout not reproduced. |
| `npm test` after initial changes, five times | 23 files / 95 tests passed each time. |
| `npm test` during packaging | First passed; second failed the Settings wall-clock test. Recorded and fixed rather than omitted. |
| `npm test` after the Settings fix, five times | 23 files / 95 tests passed each time: 13.79, 13.23, 13.14, 13.52 and 13.15 seconds. No overlapping-act warnings. |
| `npm test -- tests/settings-panel.test.ts` | 2 tests passed after deterministic animation scheduling. |
| `npm test -- tests/wallpaper-host.test.mjs tests/wallpaper-lifecycle.test.mjs tests/desktop.test.mjs tests/desktop-status.test.mjs` | 4 files / 30 tests passed, including two actual Windows helper checks. |
| `npm run build` | Passed; existing approximately 501 kB bundle warning remains. |
| `npm run build:desktop` | Passed; same warning. |
| `npm run package:win` | Passed with `--publish never`; Windows x64 NSIS candidate produced. |
| ASAR/source comparison | All six desktop implementation files match source exactly; tests, node_modules and env files excluded. |
| `git diff --check` | Passed; Git line-ending notices only. |

## Installer

- Verified existing path: `C:\Users\User\.codex\worktrees\c633\wallplayer-wallpaper\release\MusicWall-Setup-0.1.0-x64.exe`.
- Size: **115,340,537 bytes**.
- SHA-256: `36CE309D54FF3155B1647EB83C558A73B429D358463B3E4B5964D9F7D818820C`.
- Authenticode: **NotSigned**; default Electron icon remains.
- Prior candidate retained at ignored `tmp/wallpaper-qa/MusicWall-Setup-before-stabilization.exe`.
- Building and inspecting the archive does not establish successful installation or a fully verified desktop release.

## Manual acceptance gates — all NOT TESTED in this pass

- Desktop icon interaction and Start menu/taskbar behavior.
- Tray clicks.
- Actual Explorer restart recovery.
- GPU video decoding and audible output.
- Real-account Spotify reconnection and controls.
- Multiple monitors, mixed DPI and sleep/resume.
- Installer install/update/uninstall.

No prerequisite blocked packaging. These manual gates, unsigned status and the default icon prevent treating the candidate as a fully accepted release. Spotify callback registration remains `http://127.0.0.1:4173/callback`; no authentication design or secrets were changed.
