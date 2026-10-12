# Wallpaper input repair — 2026-10-11

Current branch and existing recovery fix preserved. No installation or publication performed.

## Changes

- Retained asynchronous wallpaper failure notification so normal-window recovery is not blocked by an open error dialog.
- Input preload now releases a held routed button on pointer cancellation or lost capture, with no duplicate release after a normal pointerup.
- Native input placement uses SWP_NOOWNERZORDER to avoid reordering its Explorer owner. A single immediate retry is limited to ERROR_INVALID_WINDOW_HANDLE where the preceding sibling has disappeared and both the input and desktop handles remain valid. Other failures retain fallback and now include the numeric error, handles and bounds.

The disappearing-sibling race is defensive handling, not a confirmed explanation of the friend's screenshot. The screenshot does not contain the native error code.

## Verification

- Baseline focused suite: 4 files, 35 tests passed.
- Full npm test: 29 files, 143 tests passed.
- Actual compiled native helper: 30 placements of hidden test-owned windows passed; owner and requested bounds retained. No Explorer changes in this fixture.
- npm run build:desktop: passed; existing chunk-size warning.
- npm run test:installer: 9 checks passed.
- NSIS packaging: passed. Local candidate exists at tmp/wallpaper-qa/input-repair-2026-10-11/Spontaneous-Setup-0.1.1-x64.exe. Same version as the published release; this candidate has not been published or installed.
- Existing app closed normally: diagnostics reported helper stopped and server not running. Updated development runtime launched, Spotify track data and normal-mode artwork rendered.

## Outstanding

User clarified the entire app becomes unresponsive after image upload, rather than only the Settings button. The pointer-cancellation fix does not establish that this broader freeze is resolved. Current local renderer diagnostics remain active with no observed crash. Computer-use Settings checks encountered minimized-window/user-input interruptions, so upload and direct wallpaper interaction have not been verified in this run. Obtain a reproduction with tray responsiveness and the new native error code. Friend's Windows 10 placement failure, actual desktop icon interaction, and installer acceptance remain unverified.
