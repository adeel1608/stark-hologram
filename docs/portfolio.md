# Portfolio and research notes

## Concise project description

Spatial Digital Twin Interface is a browser-based robotics/HCI research platform that combines real-time hand landmark tracking, temporal gesture recognition, calibrated monocular relative depth, Three.js digital twins, simulated telemetry, and reproducible instrumentation. It works with commodity or virtual webcams and includes a deterministic no-hardware demo.

## CV bullet suggestions

- Re-architected a legacy Flask/JavaScript hand-tracking prototype into a strict TypeScript/Vite spatial HMI with modular camera, depth, input, telemetry, and rendering providers.
- Implemented a temporally gated two-hand gesture state machine and normalized monocular relative-Z estimator with smoothing, hysteresis, calibration persistence, diagnostics, and unit tests.
- Built a semantic procedural robotic workcell in Three.js with component raycasting, inspection, isolation, exploded views, visual modes, GLTF extensibility, and deterministic simulated telemetry.
- Added no-hardware demo playback, JSON/CSV experiment capture, accessibility fallbacks, CI, and open-source engineering documentation.

Use only bullets that match the repository state and hardware verification actually completed.

## LinkedIn summary

I rebuilt my original “Stark Hologram” experiment into a robotics-focused Spatial Digital Twin Interface. The browser app uses MediaPipe Hand Landmarker, a rule-based temporal gesture engine, honest non-metric relative-depth estimation, and Three.js to select and manipulate an articulated robot cell. It includes provider boundaries for future hardware/telemetry, measured diagnostics, deterministic demo data, experiment export, and automated quality gates. The current telemetry is simulated and camera performance results remain to be measured rather than claimed.

## Technical interview explanation

The core design decision was to separate observation from intent and intent from scene mutation. Camera or demo sources produce the same typed tracking frame. Smoothing and gesture recognition turn landmarks into temporally stable intent, while an independent depth provider estimates normalized Z. The interaction controller translates those outputs into a small Three.js transform API. As a result, demo data, mouse input, future TrueDepth, and future ROS telemetry can evolve without rewriting the renderer.

The hardest trade-off is monocular depth. Apparent hand size is useful but confounded by pose. The implementation combines several palm distances, establishes a neutral baseline, applies bounds/dead zones/filtering, exposes raw and filtered diagnostics, and labels the result relative rather than inventing metres.

## Future research directions

- Compare multi-feature monocular relative depth with individual landmark-scale features for jitter and repeatability.
- Compare transparent rule-based temporal recognition with learned sequence classifiers under matched tasks.
- Measure how camera source, distance, lighting, and virtual-camera transport affect tracking latency and spatial-task performance.
- Study selection error, fatigue, and task completion when digital-twin manipulation uses gestures versus mouse/keyboard.
- Evaluate replaceable depth and telemetry providers with native TrueDepth, external sensors, and ROS 2.

These are proposed studies, not completed research findings.
