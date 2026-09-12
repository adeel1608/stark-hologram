# Camera system and privacy

## Supported sources

The app uses `navigator.mediaDevices.getUserMedia()` and `enumerateDevices()`. Any source the browser exposes as `videoinput` can be used: built-in webcams, USB webcams, capture devices, and virtual cameras such as Camo.

Camera labels may be hidden until permission has been granted. Labels come from the browser and driver, so a generic label is displayed as-is; the app does not infer that a device is an iPhone or iPad.

## Lifecycle

1. The interface starts without requesting a camera.
2. Opening settings enumerates sources without forcing permission.
3. **Start selected camera** requests the chosen device with an ideal resolution and 30 FPS target.
4. Actual settings reported by the active track are displayed.
5. Switching first stops every track, then requests the new source.
6. Track end/disconnect moves the UI to an error state and leaves demo/fallback controls available.

Saved data includes device ID, capture preferences, mirror preference, and calibration—not video frames.

Camera starts are generation-guarded: if source changes overlap, only the newest request may become active and every late stream is stopped. A failed `video.play()`, empty video stream, or tracker startup also releases capture resources. Preferred size and frame-rate values use standard ideal constraints; an overconstrained result is retried without those preferences while preserving an explicitly selected device.

Saved settings are type/range validated. Storage denial, quota errors, or malformed local data fall back to defaults and never prevent capture. Generic browser or virtual-camera labels are displayed without guessing the underlying hardware.

## MediaPipe assets

JavaScript is installed through `@mediapipe/tasks-vision`. The WASM runtime is loaded from a pinned jsDelivr package path and the official Hand Landmarker model from Google-hosted MediaPipe models. This avoids legacy global scripts while keeping the large runtime/model out of the repository.

Inference runs in-browser. GPU delegation is attempted first; CPU is the fallback. Errors remain user-facing and do not disable the Three.js or demo experience.

## Manual validation matrix

For each source, record the exact browser-visible label rather than assuming hardware identity:

| Source                      | Connection        | 640×480        | 960×540        | 1280×720       | Disconnect/reconnect | Switch without reload |
| --------------------------- | ----------------- | -------------- | -------------- | -------------- | -------------------- | --------------------- |
| iPhone 13 virtual camera    | USB               | Not yet tested | Not yet tested | Not yet tested | Not yet tested       | Not yet tested        |
| iPhone 13 virtual camera    | Wi-Fi             | Not yet tested | Not yet tested | Not yet tested | Not yet tested       | Not yet tested        |
| iPad 9th gen virtual camera | USB/Wi-Fi         | Not yet tested | Not yet tested | Not yet tested | Not yet tested       | Not yet tested        |
| Generic webcam              | Browser supported | Not yet tested | Not yet tested | Not yet tested | Not yet tested       | Not yet tested        |

Also verify permission denial, camera already in use, no devices, device removal while active, mirror on/off, and model-download failure.
