# Monocular relative depth

## Scope

The camera supplies RGB video, not a depth map. This estimator produces normalized motion relative to a neutral hand pose. It never displays metres and should not be used for safety-critical ranging.

## Features and formula

The estimator measures five normalized 2D palm features:

- wrist → index MCP;
- wrist → middle-finger MCP;
- wrist → ring-finger MCP;
- wrist → pinky MCP.
- index MCP → pinky MCP.

The baseline stores the median of each feature across a 15-frame rolling window. A trimmed relative range rejects a moving calibration window while tolerating an isolated outlier. A previously saved, device-local feature baseline may be restored; older scalar baselines remain compatible.

```text
featureDelta[i] = baselineFeature[i] / currentFeature[i] - 1
rawZ = clamp(median(featureDelta) × gain, -1, +1)
```

A larger apparent hand produces negative relative Z (toward the camera); a smaller hand produces positive relative Z (away). Values inside the dead zone are zeroed, then an exponential moving average filters the signal.

Stability is a heuristic combining recent median absolute deviation of the filtered reading with disagreement between the five feature deltas. Calibration progress, calibration-window variation, and feature disagreement are available to diagnostics. None is labelled as sensor accuracy or ML confidence.

## Failure behavior

- No hand or invalid geometry: retain the latest value briefly, then mark unavailable.
- Reacquisition: the filter restarts from the new raw observation and transform history is re-anchored before transforms resume.
- Extreme values: clamp to `[-1, +1]`.
- Manual reset: **Rebaseline** clears saved neutral scale; the next stable frames establish a new one.

## Limitations

Apparent scale also changes with pose, wrist rotation, finger splay, lens distortion, cropping, and partial occlusion. Using several features reduces sensitivity to any one landmark pair but cannot remove perspective/pose ambiguity. Calibration improves repeatability; it does not make the result metric. A future TrueDepth or external-depth provider can replace this estimator without changing `InteractionController`.
