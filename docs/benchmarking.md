# Benchmarking protocol

## Purpose

The application records raw observations needed for a future commodity-camera spatial-HMI study. It does not ship fabricated results or silently interpret a session as a successful experiment.

## Recorded fields

Every `spatial-hmi-benchmark/v2` export includes session metadata entered or observed at
capture time: session/start/end identifiers, application version and commit, browser user agent,
test device, camera label and actual resolution, lighting condition, optional measured distance,
and free-form notes.

Each observation records:

- frame timestamp, input source, measured tracking rate/inference duration, and hand count;
- handedness labels and task-provided handedness scores;
- gesture state/transition, hold time, rule-based heuristic quality, activation latency, tracking
  loss, and interaction event;
- relative-depth palm scale, raw/filtered value, baseline, temporal stability, calibration-window
  variation, and feature disagreement;
- selected component, model X/Y/Z position, rotation, scale, exploded amount, visual mode, model
  label, and model source.

Begin and end a recording explicitly from Diagnostics, then download local JSON or CSV. The CSV
repeats session metadata on each row so it can be filtered without a second table. The recorder
retains the most recent 36,000 observations in a ring buffer and reports how many older samples
were overwritten. It neither scores nor labels a session as successful.

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

The capture contains no camera frames, audio, or landmark coordinates and is never uploaded by
the application. Browser/device labels, free-form notes, and behavioral timing can still be
sensitive or identifying. Obtain participant consent, avoid names in notes, store exports under
the study's retention policy, and publish only reviewed/anonymized data.
