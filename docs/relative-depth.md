# Monocular relative depth

## Scope

The camera supplies RGB video, not a depth map. This estimator produces normalized motion relative to a neutral hand pose. It never displays metres and should not be used for safety-critical ranging.

## Features and formula

The apparent hand scale is the median of four normalized 2D distances:

- wrist → middle-finger MCP;
- index MCP → pinky MCP;
- wrist → index MCP;
- wrist → pinky MCP.

The first stable frames establish a neutral baseline. A previously saved device-local baseline may be restored.

```text
rawZ = clamp((baselineScale / currentScale - 1) × gain, -1, +1)
```

A larger apparent hand produces negative relative Z (toward the camera); a smaller hand produces positive relative Z (away). Values inside the dead zone are zeroed, then an exponential moving average filters the signal.

Stability is a heuristic based on recent median absolute deviation of the filtered reading. It is labelled as stability, not sensor accuracy.

## Failure behavior

- No hand or invalid geometry: retain the latest value briefly, then mark unavailable.
- Reacquisition: motion history resets before transforms resume.
- Extreme values: clamp to `[-1, +1]`.
- Manual reset: **Rebaseline** clears saved neutral scale; the next stable frames establish a new one.

## Limitations

Apparent scale also changes with pose, wrist rotation, lens distortion, and partial occlusion. Calibration improves repeatability but does not make the result metric. A future TrueDepth or external-depth provider can replace this estimator without changing `InteractionController`.
