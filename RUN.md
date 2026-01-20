# Quick Run Guide - Stark Hologram with Depth

## Prerequisites

1. **Install Python dependencies:**
   ```bash
   source .venv/bin/activate
   pip install -r requirements.txt
   pip install -r requirements_depth.txt
   ```

2. **Install Node.js dependencies:**
   ```bash
   npm install
   ```

3. **Install Orbbec SDK** (for depth functionality):
   - See `ORBBEC_INSTALL.md` for detailed instructions
   - Optional: App works without depth (will show placeholder mode)

## Running the Application

### Terminal 1: Start Depth Server

```bash
cd /home/adeel/temu-stark-holo
source .venv/bin/activate
python depth_server.py
```

**Expected output if Orbbec SDK installed:**
```
[depth] ✅ Found Orbbec SDK: pyorbbecsdk
[depth] Initializing Orbbec Gemini 336...
[depth] ✓ Depth stream: 640x400
[depth] ✓ Color stream: 640x480
[depth] ✓ Pipeline started
[depth] ✓ Depth→Color alignment enabled
[depth] ✅ Orbbec Gemini 336 ready!
[depth] 🚀 Server running. Press Ctrl+C to stop.
```

**If SDK not installed (placeholder mode):**
```
⚠️  ORBBEC SDK NOT FOUND
[... installation instructions ...]
Running in PLACEHOLDER mode (streaming null depth values)
```

### Terminal 2: Start Web Server

```bash
cd /home/adeel/temu-stark-holo
source .venv/bin/activate
python app.py
```

**Expected output:**
```
 * Serving Flask app 'app'
 * Debug mode: on
 * Running on http://127.0.0.1:5000
```

### Open Browser

Navigate to: **http://127.0.0.1:5000**

- Allow camera access when prompted
- Wait for "online." status in HUD
- Check depth status: should show "depth: connected"

## Gesture Controls

| Gesture | Action |
|---------|--------|
| ✊ **Right Fist** | Move building in XZ plane + depth push/pull |
| 🤏 **Left Pinch** | Select floor / Pull selected floor horizontally |
| 🤏🤏 **Two-Hand Pinch** | Rotate + Scale + Explode floors |
| 🖐 **Open Palm (hold)** | Toggle glass-holo ⟷ blueprint mode |
| 👍👍 **Double Thumbs-Up** | Reset to default state |

## Depth Controls (with Orbbec SDK)

When **Right Fist** is active (MOVE mode):

- **Push hand forward** (toward camera) → building moves closer
- **Pull hand back** (away from camera) → building moves farther
- Depth baseline is captured when fist first detected
- Movement is smooth and filtered
- Small movements (<2cm) are ignored to prevent jitter

**HUD Status Shows:**
```
MOVE: right fist (XZ + depth Z) depth=0.52m
depth: L=--m R=0.52m
```

## Visual Modes

**Glass-Holo Mode (default):**
- Translucent cyan faces
- Crisp edge outlines
- Holographic glow effect

**Blueprint Mode (toggle with open palm hold):**
- Edges only (no faces)
- Technical wireframe look
- Stark CAD aesthetic

## Troubleshooting

### Camera not working
- Check browser permissions (camera access allowed?)
- Try refreshing page (F5)
- Check other apps aren't using camera

### Depth shows `--` or disconnected
- Is depth_server.py running?
- Check Terminal 1 for errors
- See `DEPTH_TESTING.md` for detailed diagnostics

### Gestures not responding
- Ensure good lighting (MediaPipe needs clear hand view)
- Hold gestures for ~0.3s (intent gating prevents accidental triggers)
- Check status HUD for current mode

### Performance issues
- Close other applications
- Try lower camera resolution (edit app.js)
- Check CPU usage with `top`

## Keyboard Shortcuts

- **R key**: Reset (alternative to double thumbs-up)

## Advanced Configuration

Edit `static/app.js` CONFIG section (lines 9-85) to adjust:

- Gesture sensitivity thresholds
- Movement speed and smoothing
- Depth push/pull strength (Z_GAIN)
- Snap-to-grid behavior
- Colors and visual effects

See inline comments in config section for details.

## Stopping the Application

1. Close browser tab
2. Terminal 2: Press `Ctrl+C` to stop Flask
3. Terminal 1: Press `Ctrl+C` to stop depth server

## Next Steps

- Read `ORBBEC_INSTALL.md` to enable real depth
- Read `DEPTH_TESTING.md` for verification and tuning
- Experiment with CONFIG parameters in `app.js`
- Try different lighting conditions and hand distances

## Quick Health Check

Everything working if:
- ✅ Webcam preview visible in bottom-right
- ✅ Hand skeleton overlay draws when hand in view
- ✅ Status shows "online."
- ✅ Depth status shows "depth: connected" or actual values
- ✅ Right fist makes building move
- ✅ Left pinch selects floors
- ✅ All gestures responsive

Enjoy your holographic interface!

