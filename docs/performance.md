# Performance and bundle notes

## Measured production output

These are Vite's minified/gzip measurements from `npm run build` on 2026-09-12. They are build
artifact sizes, not network or runtime benchmarks.

| Checkpoint                         | Main JS                 | MediaPipe chunk     | GLTFLoader chunk   |
| ---------------------------------- | ----------------------- | ------------------- | ------------------ |
| Initial v0.2 rebuild (`08c8c9c`)   | 662.42 kB / 171.93 gzip | separate            | bundled in main    |
| Model lifecycle/import (`654c3a9`) | 634.24 kB / 164.20 gzip | 153.20 / 45.26 gzip | 45.20 / 13.47 gzip |
| Replay/benchmark/telemetry latest  | 639.29 kB / 165.67 gzip | 153.20 / 45.25 gzip | 45.20 / 13.47 gzip |

The latest HTML is 22.84 kB (5.15 kB gzip) and CSS is 20.69 kB (5.15 kB gzip). Relative to the
initial rebuild, the eagerly loaded main chunk is 23.13 kB smaller minified and 6.26 kB smaller
gzip even after adding replay and richer benchmark capture. No load-time or frame-rate improvement
is inferred from those sizes.

## Startup decisions

- MediaPipe Tasks is dynamically imported only when a camera tracking session is requested. Its
  WASM and hand-landmarker model remain external first-use fetches and are not hidden in the Vite
  figures.
- GLTFLoader is dynamically imported only for a user-requested local/URL model. The procedural robot
  has no asset fetch.
- Three.js core and the renderer stay eager because the digital twin is the first screen and must
  work without a camera. Moving the same bytes to a vendor chunk would improve cache boundaries but
  would not reduce first-load transfer, so this change was not presented as an optimization.
- Diagnostics and benchmark code have no large dependency and share live application state. Lazy
  loading them would add lifecycle complexity for a small byte reduction; measurement does not yet
  justify it.
- A service-worker/PWA layer is deferred because the first-use vision WASM/model is external. A
  manifest alone would create a misleading offline expectation.

## Runtime review

- The renderer pixel ratio is capped at 2 and updated through a retained/disconnected
  `ResizeObserver`.
- Pointer raycasting reuses one `Vector2`; explode directions are precomputed when a model is
  installed rather than during animation.
- Benchmark objects are allocated only during an explicit recording and retained in a bounded ring.
- Recorded telemetry is sorted and indexed once by channel; the 250 ms HUD poll does not filter and
  allocate a new sample array each time.
- The hand overlay resizes its backing canvas only when its CSS size/device pixel ratio changes. It
  redraws only tracking frames, while telemetry/diagnostic text updates run at 4 Hz.

The next optimization trigger should be a captured performance trace on representative hardware.
Prioritize measured long tasks and WebGL/vision contention before considering a worker or additional
code splitting.
