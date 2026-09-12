# Benchmarking protocol

## Purpose

The application records raw observations needed for a future commodity-camera spatial-HMI study. It does not ship fabricated results or silently interpret a session as a successful experiment.

## Recorded fields

- timestamp and input source;
- measured inference duration and hand count;
- handedness labels;
- gesture candidate/active state, hold time, heuristic quality, and interaction event;
- relative-depth palm scale, raw/filtered value, baseline, and stability;
- model X/Y/Z position.

Exports are local JSON (`spatial-hmi-benchmark/v1`) or CSV files. Begin and end a recording from Diagnostics. Recordings are capped in memory to prevent an unbounded browser session.

## Proposed study matrix

Do not fill this table without performing the trials.

- Distance: 0.4, 0.6, 0.8, 1.0, 1.2 m, measured independently from the camera plane
- Lighting: low, normal, bright, backlit, with lux recorded when a real meter is available
- Device: iPhone virtual webcam, iPad virtual webcam, generic webcam
- Gestures: approximately 30 labelled attempts per gesture/condition

## Candidate metrics

- gesture success and false-activation rate;
- activation latency from instructed onset to confirmed state;
- relative-depth jitter (median absolute deviation) and repeatability;
- task completion time and component-selection error rate;
- measured tracking FPS and inference duration.

## Procedure

1. Record browser/OS, camera label, connection type, requested/actual resolution, and app commit.
2. Fix the device position, background, participant position, and lighting condition.
3. Rebaseline relative depth at the beginning of each distance/device block.
4. Start recording, perform the predeclared task sequence, stop, and export immediately.
5. Keep failed attempts; label exclusions and their reasons separately.
6. Analyze outside the app with a versioned script and publish raw anonymized data only with participant consent.

Camera imagery is not recorded by the current instrumentation. Landmark coordinates can still be biometric/identifying data; handle exported sessions accordingly.
