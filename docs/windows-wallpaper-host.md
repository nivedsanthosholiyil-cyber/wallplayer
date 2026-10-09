# Windows live wallpaper host (experimental)

MusicWall attaches its existing Electron renderer to the Windows desktop. It does not use fullscreen or always-on-top as a wallpaper substitute. Native attachment checks do not establish a fully verified desktop release.

## Architecture

- `desktop/main.cjs` owns the window, server, tray, persisted mode and recovery. No renderer IPC/preload or filesystem bridge is added.
- `desktop/wallpaper-controller.cjs` starts the trusted PowerShell helper with a hidden console and piped JSON commands/status. It waits for native verification, matches acknowledgements, watches heartbeats and waits for termination.
- `desktop/wallpaper-host.ps1` compiles bundled `wallpaper-native.cs` using Windows PowerShell Add-Type. Both files are copied from the application archive to `%APPDATA%/MusicWall/wallpaper-runtime`. No execution-policy override or system/security setting is changed. Organization policy can block the helper; use normal mode then.
- Win32 callbacks run in C#, avoiding PowerShell callback/runspace issues. Only the HWND owned by the specified Electron parent is changed.
- Windows 11 raised desktop: a layered child of Progman below SHELLDLL_DefView and above background WorkerW. Classic desktop: the following empty WorkerW in the same shell process. No unverified Progman fallback.
- Child styles precede SetParent. Native errors, actual parent/style, icon-view stacking and physical virtual-screen bounds are checked. Polling repairs geometry/stacking only when necessary.
- Normal mode restores original parent/styles/bounds and synchronizes Electron visibility. Switching modes retains the same WebContents, playback and sessionStorage.

## Controls and lifecycle

The tray offers **Open MusicWall window**, **Set as desktop wallpaper**, and **Quit MusicWall**; double-click opens the normal window. The normal File menu offers those actions with Ctrl+Alt+O and Ctrl+Alt+W. These are application accelerators, not global hotkeys when the desktop child lacks focus.

First Windows launch defaults to wallpaper mode; later launches read `%APPDATA%/MusicWall/desktop-mode.json`. `npm run desktop -- --windowed` forces normal mode; `--wallpaper` forces attachment. A second instance requests a mode instead of starting another server.

Temporary Explorer host loss is retried for up to 25 seconds. A destroyed HWND triggers bounded window recreation; repeated failures report clearly. Recreating a destroyed renderer loses sessionStorage/current local playback, so Spotify may need reconnection. This path has protocol coverage but needs a real Explorer-restart test.

Quit sends stop/EOF to the helper, which detaches/hides its own HWND and exits before server shutdown. A hung helper is terminated after a grace period; exit confirmation is recorded honestly. Helper crashes trigger normal-window recovery instead of a falsely active wallpaper flag.

## Diagnostics

`%APPDATA%/MusicWall/desktop.log` records native status, mode changes and shutdown. `Verified` means native geometry/parent/style/stacking passed. It does **not** prove correct visual compositing, usable desktop icons or audible playback.

Read-only topology probe:

```powershell
powershell.exe -NoLogo -NoProfile -NonInteractive -File desktop/wallpaper-host.ps1 -Probe
```

Optional `-WindowHandle <hex> -ParentPid <electron-pid>` with `-Probe` inspects an owned MusicWall HWND without changing it. Do not supply other applications' handles.

## Tests and release gates

`tests/wallpaper-host.test.mjs` tests controller streams, readiness, errors, acknowledgements, unexpected exit, lost-window recovery notification and graceful/forced shutdown. Windows tests compile the actual helper, read desktop topology and reject invalid ownership. These do not simulate visually verified wallpaper.

See [the verification report](windows-wallpaper-verification.md) for command results and observed scope. Before production, manually verify:

1. Wallpaper behind icons; selecting/opening icons; taskbar, Start menu and notifications.
2. Tray actions, minimize/restore, quit/relaunch and no orphan helper/occupied port.
3. Explorer restart, sleep/resume and lock/unlock.
4. Multiple monitors, negative coordinates, portrait and mixed DPI. Physical virtual-screen geometry is implemented but these arrangements are unverified.
5. Target GPU video/animation, audible local playback, seeking and queue advancement while attached.
6. Real Spotify login/reconnect and controls on an active device. Register `http://127.0.0.1:4173/callback`; SDK DRM support remains separate.
7. Installer install/update/uninstall and profile retention. Installer is unsigned; no publisher identity is invented.

References: [Microsoft SetParent](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-setparent), [Windows 11 raised desktop discussion](https://github.com/rocksdanister/lively/discussions/3004).
