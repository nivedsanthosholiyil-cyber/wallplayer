# MusicWall reliability and visual QA report

Date: 9 October 2026

## Verified results

| Check | Evidence | Scope |
| --- | --- | --- |
| Running development server | HTTP 200 at `http://127.0.0.1:5173/` | Server response only; no rendered screenshot inspected. |
| Directly referenced image assets | 17/17 exist locally and return HTTP 200 with image content types | Does not establish visual crop, transparency quality, or contrast. |
| Automated tests | 19 test files, 64 passing tests | Existing unit/component/service tests; not live Spotify or audible browser playback. |
| Production build | TypeScript and Vite completed successfully | Web build. Vite reports a 501.41 kB main JavaScript chunk before gzip. |

Browser automation previously rejected localhost access under its URL policy. This pass does not claim inspection of the main player, Browse Music, Settings, Dual Split, responsive layouts, animations, or screenshots. It also does not claim a live Spotify connection, reconnect, device command, or audible local-file playback check.

## Confirmed bugs fixed

### Relinking local audio left the shared player on a revoked source

The library created a replacement object URL and revoked the original, but the existing player queue still referenced the original. A regression test reproduced that stale queue source. Relinking now updates the existing player store and queue. Replacing the active audio resets its position to zero, clears the old playback error, and preserves whether playback is playing or paused. Changes to visual artwork alone do not reset audio position.

Verification: the regression test confirms replacement URLs in both the library and player queue, original-URL revocation, paused-state preservation, and position reset. Actual browser audio decoding remains a manual check.

### Uploaded wallpaper URLs survived component teardown

The hook's cleanup covered wallpaper restored from storage but missed the latest uploaded image/video. A regression test reproduced the missing revocation. URL cleanup now follows the current wallpaper, releasing it on replacement, removal, and unmount. Uploads that finish after unmount do not create a new object URL. URL revocation was removed from React state updater functions.

Verification: a regression test confirms cleanup of successive uploaded URLs on replacement and unmount.

## Manual visual and real-integration checklist

These items are pending. Use the same origin throughout testing so browser storage and OAuth callback settings remain consistent.

1. Open `http://127.0.0.1:5173/`. Check the console for exceptions and the Network panel for failed media requests.
2. Inspect the main player at a desktop size and at approximately 390 x 700. Check title wrapping, player hit areas, progress/volume indicators, control visibility while paused, and overlap near screen edges.
3. Open Browse Music. Check search, each carousel, Recently Played, Made For You, Local Music, and playlist/card metadata for readable text, unwanted text backgrounds, clipping, and horizontal overflow.
4. Select Default, Batman, Spider-Man, Sanrio, and Sonic in turn. Check player artwork and hover/focus states. Verify each theme's library/Settings artwork stays inside its panel and disappears when another theme is selected.
5. In Sanrio, confirm the new pink character image in the library, existing pink-heart Settings image, regular pink Previous bow, skull Next bow, Hello Kitty play/pause, and pastel progress bow.
6. Open all three Settings pages. Verify the header and tabs remain stationary, only content scrolls, arrow keys navigate tabs, Escape closes Settings, focus returns, and dropdowns/sliders/switches remain usable on a small window.
7. Adjust lyric font, size, alignment, position, opacity, glow, blur, and layout. Compare the isolated preview with the main lyrics. Test singer overrides and their existing reset action.
8. Connect Spotify using the registered callback. Start a real song on an active device. Verify track title/artwork, play/pause, previous/next, seeking, volume, disconnect/reconnect, and recovery after the Spotify device becomes unavailable.
9. Check synchronized lyrics against the audible song. Seek forward/backward, pause/resume, and change tracks. In Dual Split, verify alternating upper-left/lower-right anchors, clean removal of the old lyric, and no anchor shift when Browse Music opens.
10. Use Album Art mode with real Spotify artwork. Change tracks and check cover cropping, crossfades, pause stability, and absence of black flashes. Test missing/failed artwork and confirm the default scene appears.
11. Import actual browser-playable local audio files. Test audible playback, pause, volume while paused, seeking, Previous/Next, automatic next-track playback, and stopping at the end of the queue. Relink an active/paused track and confirm the replacement plays without a stale URL error.
12. Preview/apply a custom image and video. Check wallpaper adjustments, paused Settings previews, failed media fallback, and removal. Confirm the Settings preview does not produce a second audio source.
13. Test Motion OFF, Low/Medium/High, and the operating system's reduced-motion preference. Check restrained transitions and stable controls while dragging sliders.
14. Change theme, wallpaper, and lyric preferences independently; refresh and restart the browser tab. Confirm they restore independently and that stored local music remains available or offers Relink.

## Windows application packaging gaps

- This repository currently defines a Vite web app and a local Node production server. It has no Electron dependency, main/preload entry point, desktop lifecycle, or Windows installer/build configuration. `npm run build` does not produce a Windows executable or installer.
- A desktop package must include and start the local server/backend and bundled assets, manage its shutdown, and use a stable loopback origin. The current production server defaults to port 4173; the development instructions register Spotify's callback on port 5173. The packaged origin/callback must be selected and registered consistently.
- The optional authenticated lyrics proxy exists in Vite development/preview middleware but is not implemented in `scripts/serve.mjs`. Packaging with that optional provider requires resolving this route gap. The default public lyrics provider does not need that server proxy.
- Live OAuth, device playback, media decoding, storage persistence, and visual checks in the intended Windows runtime remain release gates.

No desktop packaging system was added during this pass. Existing themes, synchronized-lyric logic, background rendering, and playback integrations were preserved apart from the confirmed local-file relink repair.
