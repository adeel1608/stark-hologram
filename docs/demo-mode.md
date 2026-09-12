# Demo mode

Demo mode makes the entire interaction architecture explorable without camera hardware or network-loaded vision assets.

Start it with **Try demo** or `?demo=1`. The loop is deterministic and compact: it generates 21 landmarks per hand rather than storing video.

The camera panel exposes pause/resume, restart, and 0.5–2× playback controls. They make a phase
repeatable during explanation and browser testing; changing speed does not turn synthetic timing
into a hardware performance measurement.

The 12-second session demonstrates:

1. point/hover;
2. pinch candidate and confirmed grab;
3. X/Y translation;
4. apparent-scale change through relative-Z estimation;
5. release hysteresis;
6. two-hand rotation, spread/scale, and exploded motion;
7. component inspection and telemetry binding;
8. visual mode changes and reset.

Synthetic frames use `source: "demo"` and zero inference time, so diagnostics cannot mistake them for measured camera inference. The demo feeds the real overlay, gesture engine, depth provider, interaction controller, scene, diagnostics, and benchmark recorder.
