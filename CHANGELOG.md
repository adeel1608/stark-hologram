# Changelog

This project follows semantic versioning once release tags are created. Entries below describe repository state; they are not claims that every planned milestone has shipped.

## [Unreleased]

### Fixed

- Guard overlapping camera/tracker starts so late streams cannot replace newer selections.
- Release camera resources on partial startup failures and ignore stale track-ended events.
- Validate optional browser-storage data and tolerate storage-policy failures.
- Keep gesture identity stable through isolated handedness-label flips and enforce release cooldown.
- Require a still multi-feature calibration window before enabling relative depth.
- Preserve a saved depth baseline across ordinary scene and gesture resets.
- Disconnect resize/pointer listeners and dispose Three.js geometry, material, texture, skeleton, and renderer resources.
- Preserve original visibility and material state across isolate, fade, visualization-mode, and restore transitions.

### Added

- Local GLB and CORS-enabled GLB/glTF URL import with validation, race-safe replacement, automatic centering/scaling, semantic mesh discovery, and procedural fallback.
- Keyboard-accessible component navigation and renderer memory diagnostics.
- Pause, restart, and playback-speed controls for deterministic synthetic demo replay.
- Versioned benchmark-session metadata, richer gesture/depth/model observations, explicit privacy guidance, and bounded recent-sample retention.
- Browser-level regression coverage for fallback controls, camera denial, demo playback, component actions, persistence, and responsive layouts.
- Structured bug/hardware-validation issue forms and a privacy-aware physical portfolio capture checklist.

### Remaining

- Hardware validation across iPhone/iPad virtual cameras and generic webcams.
- Recorded landmark replay and live telemetry adapters.

## [0.2.0] — Architecture modernization

- Replaced the Flask/Orbbec-specific runtime with Vite and strict TypeScript
- Added provider-based camera, relative depth, telemetry, and input systems
- Migrated to MediaPipe Tasks Hand Landmarker and npm-managed Three.js
- Added a semantic procedural robot workcell and GLTF loading support
- Added gesture state machine, calibration persistence, demo mode, onboarding, visual modes, diagnostics, exportable instrumentation, tests, linting, formatting, and CI
- Removed obsolete Python, vendored libraries, stale root notes, and generic building UI from active source

## Historical prototype

The initial Flask/MediaPipe Hands building prototype remains available through Git history. A `v0.1` tag should be created only when maintainers decide the historical commit warrants a formal release marker.

## Proposed progression

- `v0.3`: camera and tracking validation
- `v0.4`: tuned gesture vocabulary
- `v0.5`: evaluated relative spatial depth
- `v0.6`: model-import validation with representative licensed contributor assets
- `v0.7`: spatial UI accessibility polish
- `v0.8`: live telemetry adapters and expanded diagnostics
- `v0.9`: published demo and benchmark dataset
- `v1.0`: validated portfolio release
