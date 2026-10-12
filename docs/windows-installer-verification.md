# Spontaneous Windows preview setup verification

Date: 2026-10-10. Branch: `feature/windows-live-wallpaper`.

## Deliverable

Single Windows x64 NSIS setup file, bundling Electron, production frontend/server, fonts, application icon and theme assets. No separate Node.js installation is needed.

- Build: `npm run package:win -- --config.directories.output=release/spontaneous-preview`
- Installer: `release/spontaneous-preview/Spontaneous-Setup-0.1.0-x64.exe`
- Size: 116,024,544 bytes.
- SHA-256: `4704f8e5bd51a14a00dda8ba51d71c382fb0b0490a7e15887092447da7c4f26c`
- Signature: unsigned; publisher signing is not configured.
- Download: [GitHub preview release](https://github.com/nivedsanthosholiyil-cyber/wallplayer/releases/tag/v0.1.0-preview.1).

The current feature branch is preserved. Previous installers and application data are retained. The preview is not a fully verified stable desktop release.

## Changes

`build/installer.nsh` extends electron-builder's standard NSIS installer with a **Startup options** page and an optional **Open Spontaneous when Windows starts** checkbox. Fresh installation defaults to unchecked. Enabling writes a per-user Run entry with the quoted installed executable path and `--wallpaper`. Updates preserve the choice, update its path and avoid deleting the entry during the intermediate uninstall. Unchecking or normally uninstalling removes it. The existing profile and saved credentials remain separate from the installer.

The reported turquoise rectangles were browser text selection: their colors matched the global `::selection` rule. Display text, images and player controls now disable selection/dragging, while editable fields retain text selection. The wallpaper preload also clears an already stuck display range when wallpaper mode becomes active and clears subsequent display selections. Library paragraphs and input selections remain intact. This covers lyrics, track metadata, previous/next controls, timeline labels and volume controls without changing their playback actions.

## Commands and results

| Command/check | Result |
| --- | --- |
| `npm test` | PASS — 29 files, 137 tests, 18.50 seconds. |
| `npm run test:installer` | PASS — nine checks executed by a compiled NSIS harness using the production hooks and an isolated temporary registry key. |
| `npm run build` | PASS — TypeScript and Vite production build. Existing frontend chunk-size warning remains. |
| `npm run package:win -- --config.directories.output=release/spontaneous-preview` | PASS — desktop TypeScript/Vite build and Windows x64 NSIS packaging. Existing duplicate react-dom dependency-reference warning remains. |
| Setup UI | PASS — inspected destination and Startup options pages, including the Spontaneous icon and unchecked checkbox; cancelled before installation. |
| Running Electron text-selection check | PASS — observed pre-existing turquoise track/time selection; reloaded latest build, dragged across track metadata and timeline labels, then observed no selected text or rectangles. |
| Preload regression | PASS — clears display/control ranges; preserves library selection, editable input selection and inactive-mode selection. |

The nine native installer-hook checks cover per-user installation, initial opt-out, no startup entry when unchecked, quoted command when checked, preserving the choice on update, retaining the entry during update uninstall, refreshing an updated install path, opt-out removal, and normal uninstall removal. This is not a complete installation/update/uninstallation test.

Local evidence (excluded from Git): `tmp/wallpaper-qa/installer-startup-options.png`, `tmp/wallpaper-qa/player-selection-fixed.png`, `tmp/wallpaper-qa/final-setup-packaging.log`. Existing real desktop, Spotify connection persistence and search queue observations are recorded in the other verification documents.

## Still NOT TESTED for this setup

- Full installation, update and uninstall on another standard Windows account or clean computer.
- Actual Windows sign-in/reboot with the installed startup option enabled or disabled.
- GPU video decoding, protected Spotify SDK streaming and audible local output for every supported codec.
- Explorer restart, mixed DPI/multiple monitors, sleep/resume and long-lived Spotify refresh-token behavior.
- Direct wallpaper-mode selection drag after this final fix: app capture cannot capture Explorer's desktop. The normal-window drag was observed; wallpaper selection cleanup has a regression test.

Other users need a permitted public Spotify Client ID, an exact `http://127.0.0.1:4173/callback` registration and any required account allowlisting. An active Spotify desktop/phone device is needed for remote controls. No client secret or user credentials are bundled. Local audio does not need Spotify.

The next release gate is installation on a clean Windows user account, including startup enabled/disabled, update and uninstall. Treat this downloadable package as a preview until those checks pass.
