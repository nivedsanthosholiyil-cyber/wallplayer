# Spontaneous 0.1.1 — preview 2

Prepared 12 October 2026. New release tag `v0.1.1-preview.2`; application/installer version remains `0.1.1`. This publishes the previously built and media-tested updated setup without replacing the earlier release.

## Changes

- Optional background pause while another application is in use. Video, breathing and parallax freeze at the current frame; music keeps playing. Background motion resumes when returning to the desktop. Merely running another application does not trigger the pause.
- Asynchronous wallpaper error notification lets normal-window recovery continue while the notification stays open.
- Routed mouse buttons are released on pointer cancellation or lost capture.
- Native input positioning preserves Explorer owner order, reports the Win32 error and bounds, and restricts its retry to a vanished-sibling race.
- Custom wallpaper writes wait for the IndexedDB transaction to commit. A stale startup read cannot overwrite a newly uploaded wallpaper.

## Verification and limits

- Fresh `npm test`: **152 tests passed in 30 files** on 12 October.
- `npm run test:installer`: **9 checks passed** on 12 October.
- Production browser build, desktop build and Windows NSIS packaging passed on 11 October. The setup is the exact previously tested activity candidate, with SHA-256 below.
- In an isolated real frontend window, Windows foreground detection paused video and breathing while File Explorer was active. Local audio continued from 30.3 to 81.6 seconds while the video remained at 0.240826 seconds; returning resumed background motion.
- Native hidden-window input placement was tested separately; these fixtures do not prove Explorer desktop interaction.
- The updated installer's install/update/uninstall, actual behind-icons foreground pause/resume, the friend's Windows 10 failure, real-account Spotify reconnection, audible hardware output, Explorer restart, sleep/resume, and multiple monitors remain unverified for this candidate.
- The installer is unsigned. This preview does not establish the cause of the friend's Windows setup access error or whole-app freeze.

Existing legacy MusicWall profile identity, Spotify-session storage and settings are retained. The installer keeps its optional Windows startup choice and configured data retention on uninstall. Those configuration checks do not substitute for installation acceptance. No application was installed, uninstalled, or reset during this publication task.

## Download integrity

- File: `Spontaneous-Setup-0.1.1-x64.exe`
- Size: **116,025,009 bytes**
- SHA-256: `73a6c0c282095622618b39d799e25034d577b7016addaa6733d0d00821dac01e`

See [background activity verification](background-activity-2026-10-11.md), [input repairs](input-repair-2026-10-11.md), and [published-build acceptance checkpoint](published-install-acceptance-2026-10-11.md) for scoped evidence. Earlier reports describe their historical checkpoints, before publication of preview 2.
