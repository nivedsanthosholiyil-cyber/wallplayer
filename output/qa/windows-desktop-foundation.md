# MusicWall Windows desktop foundation — verification report

Date: 9 October 2026

## Result

Implemented the Electron foundation and built an unsigned Windows x64 NSIS installer. This is **a built installer, not a fully verified desktop release**.

Final installer confirmed on disk:

`C:\Users\User\.codex\worktrees\c633\memorycare-main\release\MusicWall-Setup-0.1.0-x64.exe`

Size: 115,331,478 bytes. SHA-256: `E557FED0D0EC8FFED17B2205109F29D958124EACB668C6AFA3684C32871C76AF`.

Read the existing `musicwall-final-qa.md` before implementation. Existing frontend components, theme registry, Spotify playback/auth services, lyric synchronization, local-file relinking and wallpaper URL cleanup were preserved. Desktop integration changes the build-time callback/provider endpoints, not the existing player or lyric engine.

## Implementation

- Electron 44.7.0 / electron-builder 26.15.3, pinned in npm's lockfile.
- Sandboxed isolated renderer, Node integration disabled, no preload bridge, restricted navigation/external links, production CSP.
- Built-in-Node production server independent of Vite and working directory, media MIME/range handling, local Host/origin checks, readiness handshake, single-instance lock, shutdown handling and startup error dialogs.
- Stable loopback origin `http://127.0.0.1:4173`; port conflicts fail rather than changing storage/OAuth origin.
- System-browser Spotify PKCE callback relay with matching/expiring/single-use state. Existing renderer validates/exchanges the code using its original sessionStorage verifier.
- Shared HTTPS lyrics proxy for production and optional Vite middleware, with server-only credentials, limited routes/parameters/response size and timeout. Desktop defaults to public LRCLIB through that proxy.
- Separate `dist-desktop` frontend, Windows installer configuration, setup/security/storage/manual-check documentation in `docs/windows-desktop.md`.

## Commands and results

| Command/check | Result |
| --- | --- |
| `npm install --save-dev --save-exact electron@44.7.0 electron-builder@26.15.3` | Completed; package and lockfile updated. |
| `npm install --package-lock-only --ignore-scripts` | Completed after adding package metadata/Node engine requirement. |
| `node node_modules/electron/install.js` | Official runtime installation retry completed; Electron executable and `path.txt` confirmed on disk. |
| `npm test -- tests/desktop.test.mjs` | 11 new server/lifecycle/policy tests passed. An initial missing-brace syntax error in the new test file was corrected before this pass. |
| `npm test` | Final standalone run: **20 files, 76 tests passed**. Includes one additional existing-auth-service regression for the desktop root callback relay. |
| `npm run build` | Production web build passed. Existing approximately 501 kB main-chunk warning remains. |
| `npm run build:desktop` | TypeScript and dedicated desktop frontend build passed; same chunk-size warning. |
| Initial `npm run package:win` and direct builder retry | Failed on Windows `EPERM` renaming the extracted Electron temporary directory. |
| Builder with `--config.electronDist=node_modules/electron/dist` before runtime finished installing | Failed because the runtime directory was not yet available. |
| Builder using the already-extracted temporary runtime | Produced the first installer. |
| Final `npm run package:win` | Passed after configuration was changed to the installed pinned runtime at `node_modules/electron/dist`. No temporary-runtime path remains in configuration. |
| `npx electron-builder --win nsis --x64 --publish never` | Passed; final package includes the backend CSP adjustment preserving existing remote video-preview hosts. |
| `npm audit --omit=dev --json` | Zero production dependency findings. |
| `npm audit --json` | Eight moderate findings in the electron-builder development dependency chain, rooted in `sprintf-js`/logging/download tooling. No broad or forced dependency downgrade applied. These modules are excluded from the application archive. |
| `git diff --check` | No whitespace errors; Git emits existing Windows line-ending notices. |
| Packaged archive inspection | Frontend, fonts/theme assets and required server/desktop modules present; **no node_modules and no .env files**. |
| `Get-AuthenticodeSignature` | Installer reports **NotSigned**. Builder's signing-stage log is not evidence of a publisher signature. |
| Packaged application launch via `Start-Process` | **Rejected by automatic approval policy: “blocked by policy.”** No more specific reason was supplied. No alternate launch/automation route was attempted. |

A test run concurrent with installer compression encountered a 5-second Settings test timeout and cascading existing Spotify-sync test failures/overlapping-act warnings. The subsequent full run without packaging in parallel passed all 76 tests. No application code or test timeouts were changed to suppress those failures.

## Verification scope

New tests use actual loopback HTTP servers and temporary asset fixtures for static delivery, callback responses, security headers, range requests, port conflicts and port release. Pure lifecycle tests use an EventEmitter utility-process adapter. The PKCE token-exchange regression uses the existing mocked unit-test transport. None of these are presented as a real Spotify integration test.

The packaged application was **not** opened or visually inspected because the launch command was blocked. Electron utility-process startup inside the final ASAR, native window lifecycle, real account authentication, audible playback and decoded video remain manual checks. No screenshot or fully verified Spotify connection is claimed.

## Spotify dashboard changes

Add `http://127.0.0.1:4173/callback` to the Spotify application's Redirect URIs. Retain `http://127.0.0.1:5173/callback` for browser development. Use the existing public Client ID; do not add a client secret. Confirm the real test account has access under the Spotify application's dashboard access mode.

## Required manual checks / release limitations

1. Launch the unpacked executable and install/uninstall/update as a normal Windows user. Verify server readiness, full local asset loading, native close/minimize/resize, second-instance focus, port-conflict message and released port on quit/crash.
2. Complete real Spotify approval/denial/reconnect through the system browser, with an active playback device. Verify track changes, play/pause, seeking, volume and audible lyric timing. The package does not include a provisioned Widevine CDM; do not promise protected Spotify SDK streaming inside Electron. Test Web API control of an existing Spotify device separately.
3. Import actual local audio and test audible playback, decoding, queue progression, seeking, volume while paused, relinking and persistence across restart.
4. Test local video wallpaper decoding on the target Windows GPU, muted previews, artwork fallback and wallpaper replacement/removal.
5. Inspect all themes, settings pages, library sections, Dual Split, album-art transitions, safe margins, contrast, Motion OFF and reduced motion at multiple window sizes.
6. Confirm settings/IndexedDB persistence in the Electron profile. Existing data in a separate browser at port 5173 does not automatically migrate.
7. Add a publisher-owned application icon and code-signing certificate for public distribution. Review the remaining development-tool dependency advisories.

Packaging itself is unblocked. Account/device-dependent checks require a real Spotify session.

## Follow-up: native Windows launch, 9 October 2026

After the user explicitly approved launching the unpacked executable, the Windows computer-use tool successfully opened `release/win-unpacked/MusicWall.exe`. A returned native MusicWall window was inspected using accessibility state and screenshots.

- The packaged frontend loaded at `http://127.0.0.1:4173/`. The desktop log confirms the utility server became ready and the window document loaded.
- The main wallpaper, lyric display and player controls rendered. These initial lyrics belong to the existing disconnected/demo state; this is not evidence of real Spotify synchronization or audible playback.
- Settings opened and rendered with readable controls. Its Spotify section displays the correct desktop callback URI.
- This separate Electron profile has no verified Spotify session. The Client ID field was initially empty. Subsequent user interaction entered report text into that field; no authentication was submitted by the agent.
- Further UI actions were interrupted by detected user input. No claims are made for theme switching, restart persistence, local audio, video decoding, shutdown, installer installation, or real desktop Spotify playback in this follow-up.

This supersedes the earlier statement that the packaged application had never been opened. The installer remains unsigned and the remaining release checks above still apply.
