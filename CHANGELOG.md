# Changelog

This project follows semantic versioning once release tags are created. Entries below describe repository state; they are not claims that every planned milestone has shipped.

## [Unreleased]

- Hardware validation across iPhone/iPad virtual cameras and generic webcams
- Recorded landmark replay and live telemetry adapters

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
- `v0.6`: licensed/model-import digital twin workflow
- `v0.7`: spatial UI accessibility polish
- `v0.8`: live telemetry adapters and expanded diagnostics
- `v0.9`: published demo and benchmark dataset
- `v1.0`: validated portfolio release
