# Depth Integration Testing & Troubleshooting Guide

This guide helps you verify that the Orbbec Gemini 336 depth integration is working correctly with the Stark Hologram application.

## Quick Start Testing

### 1. Start Depth Server

```bash
cd /home/adeel/temu-stark-holo
source .venv/bin/activate
python depth_server.py
```

**Expected Success Output:**
```
======================================================================
STARK HOLOGRAM - ORBBEC GEMINI 336 DEPTH SERVER
======================================================================
WebSocket: ws://127.0.0.1:8765
FPS: 30
======================================================================

[depth] ✅ Found Orbbec SDK: pyorbbecsdk
[depth] Initializing Orbbec Gemini 336...
[depth] ✓ Depth stream: 640x400
[depth] ✓ Color stream: 640x480
[depth] ✓ Pipeline started
[depth] ✓ Depth→Color alignment enabled
[depth] ✅ Orbbec Gemini 336 ready!
[depth] 🚀 Server running. Press Ctrl+C to stop.
```

**If SDK Not Installed (Placeholder Mode):**
```
======================================================================
⚠️  ORBBEC SDK NOT FOUND
======================================================================

To enable real depth, install Orbbec SDK v2 for Linux:
[... installation instructions ...]

======================================================================
Running in PLACEHOLDER mode (streaming null depth values)
======================================================================

[depth] 🚀 Server running. Press Ctrl+C to stop.
```

### 2. Start Web Server

In a **new terminal**:

```bash
cd /home/adeel/temu-stark-holo
source .venv/bin/activate
python app.py
```

**Expected Output:**
```
 * Serving Flask app 'app'
 * Debug mode: on
 * Running on http://127.0.0.1:5000
```

### 3. Open Browser

Navigate to: `http://127.0.0.1:5000`

**Check WebSocket Connection:**
- Look at the HUD (top-left corner)
- Status should show: `depth: connected` or `depth: L=--m R=XXm`

## Verification Checklist

### ✓ Orbbec SDK Installed

```bash
source .venv/bin/activate
python3 -c "import pyorbbecsdk; print('SDK OK:', pyorbbecsdk.__version__)"
```

Expected: `SDK OK: 2.x.x`

### ✓ Camera Detected

```bash
lsusb | grep -i orbbec
```

Expected output similar to:
```
Bus 001 Device 005: ID 2bc5:xxxx Orbbec 3D Technology Gemini 336
```

### ✓ Depth Stream Active

When depth_server.py is running and a browser is connected, you should see in the server terminal:

```
[depth] ✅ Client connected from ('127.0.0.1', XXXXX)
```

Wave your hand in front of the camera. Server should not print errors.

### ✓ Depth Values Received

In the browser:
1. Show your **RIGHT hand** to the camera
2. Check HUD status line
3. Should show: `depth: L=--m R=0.45m` (value changes as you move hand closer/farther)

Typical depth values:
- **0.20m - 0.40m**: Very close
- **0.40m - 0.80m**: Normal working distance
- **0.80m - 1.50m**: Far
- **null/--**: Out of range or invalid

### ✓ WebSocket Handshake (Bidirectional)

**Browser → Server (Hand Positions):**

In depth_server.py terminal, add debug logging temporarily:

```python
# In handler() function, after msg = json.loads(msg_raw):
print(f"[DEBUG] Received hand coords: left={msg.get('left')}, right={msg.get('right')}")
```

Expected output when hands visible:
```
[DEBUG] Received hand coords: left={'x': 320, 'y': 240}, right={'x': 480, 'y': 260}
```

**Server → Browser (Depth Values):**

In browser console (F12), add logging:

```javascript
// In initDepthWS() → depthWS.onmessage
console.log('Depth received:', msg);
```

Expected output:
```
Depth received: {t: 1705777123456, left_m: 0.52, right_m: 0.48}
```

### ✓ Depth-Driven Z Movement

1. Make a **FIST with RIGHT hand** (this activates MOVE mode)
2. Status should show: `MOVE: right fist (XZ + depth Z) depth=0.XXm`
3. **Push hand forward** (closer to camera) → building should move **toward** you
4. **Pull hand back** (farther from camera) → building should move **away**

**Expected Behavior:**
- Baseline depth captured when fist first detected
- Moving hand ±5cm should produce visible Z movement
- Movement is smooth (filtered with Z_SMOOTH=0.12)
- Small jitter (<2cm) is ignored (Z_DEADZONE_M)

### ✓ Alignment Quality

The depth values should match the RGB frame coordinates. Test:

1. Put RIGHT hand **in center** of screen
2. Check depth value (should be valid, not null)
3. Move hand to **top-left corner**
4. Check depth value (should still be valid)
5. Move hand to **bottom-right corner**
6. Check depth value (should still be valid)

**If depth goes to null when moving to corners:**
- Alignment may be off
- Check depth_server.py logs for alignment warnings
- Depth and color stream resolutions may not match

## Troubleshooting Common Issues

### Issue: Depth always shows `--` (null)

**Possible Causes:**

1. **SDK not installed properly**
   - Check: `python -c "import pyorbbecsdk"`
   - Solution: Follow ORBBEC_INSTALL.md

2. **Camera not detected**
   - Check: `lsusb | grep -i orbbec`
   - Solution: Try different USB port, check cable

3. **Depth stream failed to start**
   - Check depth_server.py terminal for errors
   - Solution: Reduce resolution, disable alignment temporarily

4. **Hand not detected by MediaPipe**
   - Check: Hand skeleton visible in overlay?
   - Solution: Improve lighting, move hand into view

5. **Depth sample point outside frame**
   - Check: Alignment enabled?
   - Solution: Verify COLOR_STREAM is same resolution as expected (640x480)

### Issue: Depth values unstable/jittery

**Solutions:**

1. **Increase smoothing**
   ```javascript
   // In app.js CONFIG section
   const Z_SMOOTH = 0.20;  // Increase from 0.12
   ```

2. **Increase deadzone**
   ```javascript
   const Z_DEADZONE_M = 0.04;  // Increase from 0.02
   ```

3. **Increase depth sample window**
   ```python
   # In depth_server.py CONFIG
   DEPTH_WINDOW_SIZE = 11  # Increase from 7
   ```

4. **Check lighting**
   - Structured light cameras need good ambient lighting
   - Avoid direct sunlight or IR interference

### Issue: Z movement inverted

If pushing hand forward moves building away (wrong direction):

```javascript
// In app.js, depthUpdateForMove() function:
const desired = clamp((dz) * Z_GAIN, -Z_CLAMP, Z_CLAMP);  // Remove negative sign
```

### Issue: WebSocket keeps reconnecting

**Check depth_server.py is running:**

```bash
netstat -an | grep 8765
```

Expected:
```
tcp  0  0  127.0.0.1:8765  0.0.0.0:*  LISTEN
```

**Check firewall:**
```bash
sudo ufw status
# If enabled, allow port:
sudo ufw allow 8765
```

### Issue: Depth lags behind hand movement

**Reduce network latency:**

1. Check FPS setting:
   ```python
   # In depth_server.py
   FPS = 30  # Should match MediaPipe FPS
   ```

2. Reduce depth processing:
   ```python
   DEPTH_WINDOW_SIZE = 5  # Smaller window = faster
   ```

3. Check CPU usage:
   ```bash
   top  # Look for depth_server.py and chrome
   ```

### Issue: Alignment seems off

**Test without alignment:**

```python
# In depth_server.py, _init_orbbec():
# Comment out:
# self.align = SDK_MODULE.Align(SDK_MODULE.StreamType.COLOR_STREAM)

# And in sample_depth_m(), use raw depth frame coords
# (Will require manual mapping from RGB coords to depth coords)
```

**Check stream resolutions match:**
```python
# Depth should be aligned to color resolution
self.color_width = 640
self.color_height = 480
# Depth will be remapped to this resolution if alignment works
```

## Performance Metrics

### Expected Performance

- **Depth Server FPS**: 30 fps
- **WebSocket Latency**: < 50ms
- **Depth Sample Time**: < 10ms per hand
- **End-to-End Latency**: < 100ms (hand movement → Z change visible)

### Measure Latency

Add timestamps to debug:

**In depth_server.py:**
```python
# In handler(), after receiving message:
receive_t = now_ms()
lag = receive_t - msg.get('t', 0)
print(f"[PERF] Browser→Server lag: {lag}ms")
```

**In app.js:**
```javascript
// In initDepthWS() → onmessage:
const lag = performance.now() - msg.t;
console.log(`[PERF] Server→Browser lag: ${lag.toFixed(1)}ms`);
```

**Acceptable Ranges:**
- Browser→Server: 10-30ms
- Server→Browser: 10-30ms
- Total round-trip: 20-60ms

## Advanced Diagnostics

### Visualize Depth Frame

Add debug visualization in depth_server.py:

```python
import cv2

# In update_frames(), after getting depth_frame:
if self.depth_frame:
    depth_data = np.frombuffer(self.depth_frame.get_data(), dtype=np.uint16)
    depth_img = depth_data.reshape((self.depth_frame.get_height(), 
                                     self.depth_frame.get_width()))
    
    # Normalize for display
    depth_vis = cv2.normalize(depth_img, None, 0, 255, cv2.NORM_MINMAX)
    depth_vis = depth_vis.astype(np.uint8)
    depth_vis = cv2.applyColorMap(depth_vis, cv2.COLORMAP_JET)
    
    cv2.imshow('Depth Frame', depth_vis)
    cv2.waitKey(1)
```

### Log Depth Samples

```python
# In sample_depth_m(), before return:
print(f"[SAMPLE] ({x},{y}) = {depth_m:.3f}m ({len(samples)} valid samples)")
```

### Monitor WebSocket Traffic

```bash
# Use tcpdump to watch WebSocket packets
sudo tcpdump -i lo -A -s 0 'tcp port 8765'
```

## Configuration Tuning Guide

### For Smoother Movement (Less Responsive)

```javascript
// app.js
const Z_SMOOTH = 0.25;        // Higher = smoother
const Z_DEADZONE_M = 0.05;    // Larger = ignores more noise
```

```python
# depth_server.py
DEPTH_WINDOW_SIZE = 11        # Larger = more median filtering
```

### For Faster Response (More Jitter)

```javascript
// app.js
const Z_SMOOTH = 0.08;        // Lower = faster
const Z_DEADZONE_M = 0.01;    // Smaller = more sensitive
```

```python
# depth_server.py
DEPTH_WINDOW_SIZE = 5         # Smaller = faster sampling
```

### For Stronger Push/Pull

```javascript
// app.js
const Z_GAIN = 3.0;           // Higher = more dramatic
const Z_CLAMP = 4.0;          // Allow larger offsets
```

### For Weaker Push/Pull

```javascript
// app.js
const Z_GAIN = 1.0;           // Lower = more subtle
const Z_CLAMP = 1.5;          # Limit max offset
```

## Success Criteria

Your depth integration is working correctly if:

1. ✅ depth_server.py starts without errors and shows "Orbbec Gemini 336 ready"
2. ✅ Browser HUD shows `depth: L=XXm R=XXm` with valid values
3. ✅ Making RIGHT fist activates MOVE mode
4. ✅ Pushing hand forward/back produces smooth Z movement
5. ✅ Movement feels natural and responsive
6. ✅ No WebSocket reconnection loops
7. ✅ Depth values update at ~30 FPS
8. ✅ All existing gestures still work (fist, pinch, etc.)

## Rollback to Placeholder Mode

If you need to disable depth temporarily:

```javascript
// In app.js
const DEPTH_ENABLE = false;  // Disable depth integration
```

Or stop depth_server.py - the app will continue working without depth.

