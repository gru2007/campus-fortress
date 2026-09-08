# Campaign Presentation Demo

The campaign page defaults to an offline, explicitly labeled simulation. It does
not need the coordinator. The matchmaking card elsewhere in the main menu is
unchanged and still reports real coordinator availability.

## Views

- `campaign.html?view=card&lang=ru`: compact overview, headquarters, supply routes,
  active operations, current phase, and an open-map link.
- `campaign.html?view=full&lang=ru`: selectable sectors, operation details,
  simulated population and servers, briefing, pause/resume, and close controls.
- `lang=en` selects English. Without a language parameter, the page uses the
  browser language immediately, then adopts the game's language if its local
  campaign endpoint answers. No other live values enter the demo.
- `demo=0` explicitly selects the existing game feed for integration/debugging.
  This is not a completed coordinator-backed campaign implementation.
- `embedded=1` is set by VGUI so Close/Escape goes to the game's close command.
  Standalone Close/Escape returns to the overview instead.

The native overview remains covered by its VGUI open button. The HTML overview
also has a link for standalone browser previews. Sector selection supports mouse,
touch, Tab, Enter, and Space. On narrow screens the details move below the map;
only headquarters and the selected sector retain labels.

## Playback

The 64-second timeline includes four completed captures, with holding periods:

- At 12 seconds BLU captures Foundry 17, then defends the sector.
- At 30 seconds RED captures the reservoir after a brief defensive stand stalls progress.
- At 44 seconds RED recaptures Foundry 17.
- At 56 seconds BLU recaptures the reservoir. Reinforcements restore the opening
  configuration before the cycle repeats; no ownership reset occurs at the seam.

Capture rings reach 100%, a capture wave and notification mark the handover, the
node changes color, and ownership, defensive status, and supply links update in
place. The demonstration frontier is one authored north-to-south SVG curve with
two continuously deforming sector bulges. Both territory fills share that exact
curve. The demo does not run raster encoding, marching squares, or turbulence
filters during playback. The live feed retains its node-influence field renderer.

Territory, capture effects, and the front's dash offset use the same animation
frame and shared clock. A fixed normalized path length keeps dashes attached to
the same section as the curve deforms, rather than rephasing on contour rebuilds.
Polling and selection preserve SVG elements.

Both views use the same wall-clock timeline and theater coordinates. Pause/resume
is shared through same-origin local storage (`campaign-demo-clock-v1`). If storage
is unavailable, unpaused playback still shares wall-clock time, but pause is local
to each view. A saved pause survives reopening. Resume before a presentation if
the map was previously paused.

Reduced-motion preferences show a fixed, inspectable offensive state and disable
decorative animation. Hidden documents skip demo updates. The demo's sector-mark
button only changes local presentation state; it never sends deployment or queue
commands. Closing the embedded theater is the only demo POST action.

## Browser Checks

From the repository root, with Node 20+ (a separate temporary install avoids
adding frontend dependencies to the game):

```sh
npm install --prefix /tmp/tc2-campaign-test playwright@1.63.0
/tmp/tc2-campaign-test/node_modules/.bin/playwright install chromium
PLAYWRIGHT_MODULE=/tmp/tc2-campaign-test/node_modules/playwright node --test tools/test-campaign.mjs
```

The test starts and closes its own local HTTP server and browser. It checks
sampled states across three complete cycles and their seams, all four ownership
handovers, the defensive stand, continuous dash motion, persistent SVG/CSS
animation through real polling, synchronized views and pause, command isolation,
keyboard selection, language, opening/closing, responsive layout, reduced motion,
and live loading/empty/error/recovery states. Set `CAMPAIGN_SCREENSHOTS` to an
existing directory to save Russian card, compact card, desktop, and mobile PNGs.

For an interactive preview, serve `game/tc2/loose/resource/html` with a static
HTTP server, or use the game's server at `http://127.0.0.1:58270/ui/campaign.html`.
No frontend build is needed.

## In-Game Acceptance

Rebuild the client for the campaign-specific viewport zoom and embedded URL
changes. Other web panels keep their existing VGUI zoom behavior. Restart the
client to load the edited loose HTML; merely closing/reopening the theater does
not reload its web page.

Use `tf_main_menu_html 0` and `tf_campaign_map_html 1`. Check the overview at the
actual menu size, then open the theater and select several sectors. Check the
HTML Close button, the native close button, and Escape with keyboard focus inside
the web view. Repeat at 1280x720, 1920x1080, and the presentation display's native
resolution. Observe at least three uninterrupted cycles with the coordinator
offline and check that hiding/reopening the theater keeps the shared phase.

Browser checks do not replace this final test in the shipping Steam HTML/VGUI
runtime. Native client build and in-game visual acceptance require a supported
game build environment; they were not performed on the macOS development host.
