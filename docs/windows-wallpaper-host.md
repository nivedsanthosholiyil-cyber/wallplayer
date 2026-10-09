# Windows live wallpaper host (experimental)

This branch adds an experimental Windows-only host for the existing MusicWall renderer.

## Behavior

- On Windows, Electron creates the existing MusicWall window and starts `desktop/wallpaper-host.ps1`.
- The helper locates the desktop WorkerW host, reparents the Electron native window behind the desktop icon view, removes normal window chrome, and sizes it to the Windows virtual-screen bounds.
- A MusicWall tray icon exposes **Open MusicWall window**, **Set as desktop wallpaper**, and **Quit MusicWall**.
- The helper polls for Explorer/desktop-host changes and attempts to reattach when the WorkerW host changes.
- The existing React renderer, player, themes, lyrics and settings are reused; this does not create a second audio renderer.

## Safety and limitations

This is a prototype, not a verified Windows release. It invokes Windows PowerShell with a bundled script copied to the per-user MusicWall data directory. The helper uses Win32 APIs via PowerShell `Add-Type`; enterprise PowerShell policy may block it. No policy setting is changed system-wide.

The helper currently sizes the wallpaper to virtual-screen bounds but has not been verified with mixed-DPI, portrait, negative-coordinate, or multi-monitor layouts. Explorer restart behavior, click-through behavior around desktop icons, taskbar interactions, sleep/resume, GPU/video decoding, and exit cleanup require manual Windows testing. The host is experimental and must not be described as production-ready until those checks pass.

The script is not executed by the automated Vitest suite. The added test only verifies that the main-process wiring and expected Win32 host operations are present; it does not prove the Win32 calls work on a real desktop.

## Windows verification

On a Windows x64 development machine:

1. Run `npm ci`, `npm test`, and `npm run build:desktop`.
2. Run `npm run desktop` for the unpackaged app.
3. Confirm the wallpaper appears behind icons and the taskbar remains usable.
4. Open the tray menu and switch to the normal MusicWall window; switch back to wallpaper mode.
5. Restart Windows Explorer from Task Manager and check that the wallpaper reattaches.
6. Test a second monitor, monitor arrangement changes, lock/unlock, sleep/resume, and quit/relaunch.
7. Only after these checks pass, build the installer with `npm run package:win`.

If PowerShell is blocked or the helper fails, use the tray/normal-window fallback and inspect `%APPDATA%/MusicWall/desktop.log`. Do not bypass organization-managed Windows policy to force the helper to run.
