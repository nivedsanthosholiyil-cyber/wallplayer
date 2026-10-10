# Wallpaper search keyboard focus — 2026-10-09

The user reported that typing in Music Library search did not work in wallpaper mode. The running library did show live Spotify search results for an existing `ssss` query when inspected in normal window mode, so the search API itself was not replaced or altered.

The input bridge focused the below-icons renderer to forward mouse and keyboard events, but did not restore the above-icons keyboard receiver afterwards. The fix activates the existing shaped input surface only on an actual control click and restores its webContents focus after forwarded interaction. Plain hover/passive cursor samples do not request focus. Successive keys, editing keys and shortcuts continue through the native Electron before-input-event path; no renderer-supplied keyboard packet or global key hook was added. The bridge keeps an aggregate event count for tests; no key contents are recorded in diagnostics.

- Focused tests: PASS, 3 files / 13 tests.
- Full `npm test`: PASS, 28 files / 122 tests (11.43 s).
- `npm run build:desktop`: PASS; existing chunk-size warning remains.
- Existing MusicWall was closed normally. Diagnostics confirmed helper/server shutdown before a fresh `npm run desktop:run -- --wallpaper` launch.
- Launch output: ignored `tmp/wallpaper-qa/search-focus-launch.log` and `search-focus-errors.log`.

Actual keyboard typing through the Explorer desktop surface needs user verification, because it is not targetable by the available app-window computer-use API. The user has been asked to click the library search and type in the freshly restarted wallpaper build. Do not claim the manual typing test passed until they confirm it. Existing search UI, Spotify requests, themes, playback and lyrics were preserved. No installer was rebuilt, published or installed.

## First candidate failed; native input correction

The user confirmed the initial focus-restoration candidate still could not type. It is not a passing desktop typing test. The native helper now keeps only the input surface as a desktop-owned, activatable popup rather than parenting it as an Explorer child. It is placed immediately above the desktop root with no always-on-top style, remains shaped to controls, and is restored/hidden on ordinary-window return. The actual wallpaper remains the existing verified desktop child. Visibility bits are preserved when repairing styles; repeated hit-region reports no longer raise an already-visible input surface.

The underlying focus and z-order behavior follows Microsoft's [SetFocus](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-setfocus) and [window ownership/z-order documentation](https://learn.microsoft.com/en-us/windows/win32/winmsg/window-features). Focused native/input tests passed (2 files / 22 tests), including actual helper compilation. Fresh popup candidate launch output is in `tmp/wallpaper-qa/search-popup-launch.log` and `search-popup-errors.log`. Actual wallpaper typing and foreground-app stacking remain pending until retested.
