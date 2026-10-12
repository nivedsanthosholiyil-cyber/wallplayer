# Spontaneous runtime acceptance — 10 October 2026

Branch: `feature/windows-live-wallpaper`. The existing implementation and user profile were retained. Nothing was installed, signed, published, merged or distributed in this pass.

## Fixes

- **Spotify persistence:** an intact encrypted session could be discarded when its separately stored public Client ID was missing. `src/services/spotify/auth.ts` now recovers that ID from a validated encrypted record, refreshes expired tokens, respects an explicitly different ID and guards against stale asynchronous restores. Credentials remain in protected desktop storage. This was verified against the real Spotify account across a full application restart; a Windows reboot was not performed.
- **Native restoration:** rewriting an already-zero owned-window owner/style could produce Windows error 1400, although the window was valid. `desktop/wallpaper-native.cs` skips verified no-op writes and clears last-error correctly. An owned-window regression fixture reproduces the original failure and verifies three restorations, changed-style restoration and rejection of invalid HWNDs. Actual mode switching and clean shutdown also passed; these are not Explorer-restart tests.
- **Breathing motion:** automatic directional drift and the second image animation were replaced by one centered breathing wrapper. Mouse parallax remains independent. Additional scale is capped at 0.8%, with lower intensity reducing it; artwork still uses centered, proportional cover. Existing saved `ambient` preferences now select Breathing only. Wallpaper settings offer Off, Parallax only, Breathing only and Parallax + breathing. Global Motion OFF, zero intensity and reduced motion still disable movement. Track changes and play/pause retain the wrapper rather than restarting its cycle.

## Acceptance results

| Check | Result | Evidence / limitation |
| --- | --- | --- |
| Fresh installation | NOT TESTED | No suitable isolated Windows installer environment available. The working profile was not used for destructive acceptance. |
| Launch | PASS | Real development runtime and unpacked packaged runtime launched. This is not an installed-app test. |
| Wallpaper rendering | PASS | User confirmed the corrected real-account wallpaper and desktop interaction work. Current native diagnostics show wallpaper mode without errors; diagnostics alone are not visual proof. |
| Desktop icons, taskbar, Start | PASS | User confirmation during the real desktop test. Not independently captured by the app-window capture tool. |
| Data preservation / Spotify restart | PASS | Existing protected session retained; actual Spotify tracks and Connected status returned without entering an ID or logging in after full app restart. Local-media/settings/theme data were not cleared. Reboot remains NOT TESTED. |
| Normal mode / repeated switching | PASS | Three mode cycles, restored window observation and error-free status records. |
| Clean shutdown and relaunch | PASS | Prior main, server and helper exited. Fresh real-account app recovered. Current app intentionally remains running in wallpaper mode. |
| Local video, normal window | PASS | Uploaded actual local VP8 WebM using Settings. Captures show the moving circle at 2.6s and 3.7s in different positions. |
| Local video, actual desktop | NOT TESTED | Native attachment succeeded, but no final user visual confirmation of the isolated video on the desktop. |
| Audible output / GPU decoder path | NOT TESTED | Video fixture is silent. Decoding motion does not prove audible output or hardware acceleration. |
| Breathing and parallax runtime | PASS (runtime signals) | Fresh app shows the new setting and real Spotify playback. Attached renderer reports Motion on, idle enabled, running animation clocks, desktop pointer samples and changing artwork object position. Final desktop visual judgment of the new breathing effect remains NOT TESTED. |
| Update / uninstall / reinstall | NOT TESTED | NSIS hooks tested in isolated registry keys; full installation lifecycle was not run. |
| Sleep/resume | NOT TESTED | Would disrupt the active desktop. |
| Explorer restart | NOT TESTED | Not restarted during this pass. |
| Multiple monitors / mixed DPI | NOT TESTED | No suitable hardware test performed. |

## Commands and results

- Initial `npm test`: **29 files, 137 tests passed**.
- Auth/native focused run: **3 files, 38 tests passed**.
- Full suite after auth/native fixes: **29 files, 140 tests passed**.
- `npx vitest run tests/motion-settings.test.ts tests/album-art-background.test.ts`: **2 files, 10 tests passed**.
- Final `npm test`: **29 files, 141 tests passed**.
- `npm run build`: **PASS**.
- `npm run build:desktop`: **PASS**.
- `npm run test:installer`: **PASS, 9 installer hook checks**. This does not install the application.
- `npx electron-builder --win nsis --x64 --publish never --config.directories.output=tmp/wallpaper-qa/acceptance-breathing-package`: **PASS**.
- `git diff --check`: **PASS** (line-ending notices only).

Builds retain the existing >500 kB bundle warning. Authenticode inspection confirms the installer is **NotSigned**, despite the builder printing signing pipeline steps.

## Artifacts

The requested original `tmp/wallpaper-qa/spontaneous-package/Spontaneous-Setup-0.1.0-x64.exe` was preserved. It predates this pass's fixes; do not treat it as the verified current artifact.

Latest local installer:

`tmp/wallpaper-qa/acceptance-breathing-package/Spontaneous-Setup-0.1.0-x64.exe`

- Exists, **116,024,569 bytes**.
- SHA-256: `C04E063D156E0A5B734B0C8853C786A9046C85F0244AC499569CA7749CE5B5FA`.
- Contains the auth, native restore and breathing changes. It has not been installed.

Evidence files under `tmp/wallpaper-qa/`:

- `spotify-restored-window.jpg`, `spotify-cold-relaunch.jpg`: actual account restoration.
- `restore-fixed-cycles.json`, `acceptance-clean-shutdown.json`: native lifecycle evidence.
- `local-video-frame-a.jpg`, `local-video-frame-b.jpg`: actual decoded local video motion in a normal window.
- `breathing-wallpaper-status.json`, `breathing-renderer-before.json`, `breathing-renderer-after.json`: current attached runtime evidence.
- `breathing-full-tests.log`, `breathing-production-build.log`, `breathing-desktop-build.log`, `breathing-installer-tests.log`, `breathing-package.log`: command outputs.

Current live diagnostics remain in `%APPDATA%/MusicWall/desktop-status.json`, `renderer-status.json` and `desktop.log`. Protected Spotify data is not part of the report.

## Release decision

**Experimental; ready for controlled installer testing, not a fully accepted release.** The next acceptance step is installing the latest unsigned artifact in a disposable Windows profile/VM, then testing update, uninstall, reinstall and data retention. Preserve the working profile and original installer.

## Authorized GitHub update — version 0.1.1

After the acceptance pass, the user requested updating GitHub. The same fixes were versioned as **0.1.1** for a separate `v0.1.1-preview.1` prerelease; the earlier installer and release remain intact. This does not change the unverified acceptance checks above.

- `npm test`: **29 files, 141 tests passed** again.
- Production build, desktop build, nine installer hook checks and Windows x64 NSIS packaging: **PASS**.
- Installer: `tmp/wallpaper-qa/spontaneous-0.1.1-package/Spontaneous-Setup-0.1.1-x64.exe`.
- Size: **116,024,471 bytes**. Authenticode: **NotSigned**.
- SHA-256: `FF595B38CC8B1DC0585D43AD9D3EE8E9A07893CE7023411A72D6DFA8BA8A56AD`.
- GitHub preview: <https://github.com/nivedsanthosholiyil-cyber/wallplayer/releases/tag/v0.1.1-preview.1>.

`SHA256SUMS.txt` accompanies the installer. No release installation or merge is part of this update.
