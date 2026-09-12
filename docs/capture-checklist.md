# Portfolio capture checklist

These assets require the real browser/camera setup. Do not substitute synthetic demo footage for a
camera-performance claim, and do not identify an iPhone/iPad unless the browser-visible source and
the physical setup confirm it.

## Before recording

- Use the merged-or-candidate commit you intend to cite and record its short SHA.
- Use a clean 1920×1080 desktop capture where possible; close notifications, unrelated tabs, and
  other camera clients.
- Obtain consent from every visible person. Use a neutral background and keep names, messages, and
  private device labels out of frame.
- Record the browser, OS, physical camera/connection, browser-reported resolution, lighting, and
  camera distance. Rebaseline after the participant and camera are in position.
- Run `npm ci`, `npm run check`, and `npm run test:e2e`; keep the successful CI link with the assets.

## Required captures

### Hero clip — 15–20 seconds

1. Start on the full interface with the procedural robot visible (2 seconds).
2. Show the live landmark overlay and point at a named component (3 seconds).
3. Pinch/hold, move X/Y, then move toward/away for relative Z (5 seconds).
4. Use two hands for rotation/scale/explode (4 seconds).
5. Finish on the component inspector and simulated telemetry (3 seconds).

Keep the complete app chrome visible. A cut is acceptable; a hidden failed attempt is not acceptable
in research evidence.

### Technical split-screen clip — 30–45 seconds

- Left: consented camera view or a separate shot of the physical setup.
- Right: browser overlay, gesture state, relative-Z readout, and Diagnostics.
- Show one rebaseline, one confirmed grab/release, one tracking-loss recovery, and the measured
  inference/tracking/render fields.
- Add captions: `monocular relative depth (non-metric)`, `heuristic quality (not ML confidence)`,
  and `telemetry: deterministic simulation`.

### Screenshots

Capture PNGs at 1920×1080 for: default holographic view, live landmark overlay, selected-component
inspector, exploded view, blueprint mode, solid mode, diagnostics during an explicit recording, and
the GLB import/settings panel. Also capture one narrow responsive view without cropping controls.

### Diagnostics evidence

Use a new benchmark session with device/camera/lighting/distance filled in. Let it run through the
predeclared gesture sequence, stop before export, capture the whole Diagnostics dialog, and retain
the matching JSON/CSV privately. Do not put participant notes or stable device identifiers in a
public screenshot.

### Architecture image

Render the Mermaid flowchart in the README at a legible 16:9 size. Verify the labels against the
current code and include the commit SHA in the caption; do not add planned ROS/TrueDepth paths as if
they were implemented.

### LinkedIn sequence — 35–45 seconds

Use: 3-second outcome shot → 8-second no-hardware deterministic demo → 12-second live camera
interaction → 8-second diagnostics/benchmark metadata → 6-second architecture card → final title
card with repository link. State that telemetry is simulated and hardware measurements are from the
shown setup only.

## File and claim review

Name files with date, commit, device class, and take number (for example
`2026-09-12-abc123-webcam-hero-t02.mp4`). Before publishing, review the whole frame and audio track,
confirm every numeric claim against the saved session, and retain the unedited source separately
from the public edit under the chosen retention policy.
