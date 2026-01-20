# Stark Hologram

A hand-tracking controlled 3D holographic interface built with Flask, Three.js, and MediaPipe. Interact with a holographic building visualization using natural hand gestures in real-time. **Now with Orbbec Gemini 336 depth camera integration for real push/pull Z-axis control!**

**Repository**: https://github.com/adeel1608/stark-hologram

## Features

- **Hand Tracking**: Real-time hand gesture recognition using MediaPipe
- **Depth Camera Integration**: Orbbec Gemini 336 depth streaming for Z-axis push/pull control
- **3D Visualization**: Interactive holographic building rendered with Three.js
- **Gesture Controls**:
  - **Fist (Right Hand)**: Move the building in XZ plane + depth push/pull
  - **Pinch (Left Hand)**: Select floors and pull them horizontally
  - **Two-Hand Pinch**: Rotate, scale, and explode floors
  - **Open Palm (hold)**: Toggle between glass-holo and blueprint modes
  - **Double Thumbs Up**: Reset to default state
- **Visual Effects**: Energy beams, particle systems, dynamic lighting
- **Dual Visual Modes**: Glass-holo (translucent faces) and Blueprint (edges only)
- **HUD Display**: Real-time status, floor labels, and depth values
- **WebSocket Bridge**: Bidirectional depth server for real-time depth queries

## Prerequisites

- Python 3.8+
- Node.js 14+ (for npm dependencies)
- Modern web browser with WebRTC support (Chrome, Firefox, Edge)
- Webcam for hand tracking
- **Optional**: Orbbec Gemini 336 depth camera for Z-axis control

## Installation

1. Clone the repository:
```bash
git clone https://github.com/adeel1608/stark-hologram.git
cd stark-hologram
```

Or if you prefer SSH:
```bash
git clone git@github.com:adeel1608/stark-hologram.git
cd stark-hologram
```

2. Create and activate virtual environment:
```bash
python3 -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate
```

3. Install Python dependencies:
```bash
pip install -r requirements.txt
pip install -r requirements_depth.txt
```

4. Install Node.js dependencies:
```bash
npm install
```

5. **(Optional)** Install Orbbec SDK for depth functionality:
   - See `ORBBEC_INSTALL.md` for detailed instructions
   - App works without depth (will run in placeholder mode)

## Quick Start

See `RUN.md` for detailed run instructions. Quick version:

**Terminal 1 - Start Depth Server:**
```bash
source .venv/bin/activate
python depth_server.py
```

**Terminal 2 - Start Web Server:**
```bash
source .venv/bin/activate
python app.py
```

**Open Browser:** http://127.0.0.1:5000

## Usage

1. Allow camera access when prompted

2. Wait for "online." status in HUD

3. Use hand gestures to interact with the holographic building:
   - Make a fist with your right hand and move it to reposition the building
   - Pinch with your left hand to select and pull floors
   - Use two-hand pinch to transform (rotate, scale, explode)
   - Hold an open palm to toggle wireframe mode
   - Show double thumbs up to reset

## Gesture Controls

| Gesture | Action |
|---------|--------|
| ✊ Right Hand Fist | Move building in XZ plane + **depth push/pull** |
| 🤏 Left Hand Pinch | Select floor / Pull selected floor horizontally |
| 🤏🤏 Two-Hand Pinch | Rotate + Scale building |
| 🤏🤏 + Hands Up/Down | Explode floors vertically |
| 🖐 Open Palm (hold) | Toggle glass-holo ⟷ blueprint mode |
| 👍👍 Double Thumbs Up | Reset to default state |
| R Key | Reset (keyboard shortcut) |

### Depth Controls (with Orbbec SDK)

When **Right Fist** is active (MOVE mode):
- **Push hand forward** (toward camera) → building moves closer to you
- **Pull hand back** (away from camera) → building moves farther away
- Depth is captured as baseline when fist first detected
- Movement is smooth and filtered to prevent jitter
- Small movements (<2cm) are ignored

**Visual Modes:**
- **Glass-Holo** (default): Translucent cyan faces with crisp edges
- **Blueprint**: Edges-only technical wireframe (toggle with open palm hold)

## Project Structure

```
stark-hologram/
├── app.py                    # Flask web server
├── depth_server.py           # Orbbec depth WebSocket server
├── templates/
│   └── index.html            # Main HTML template
├── static/
│   ├── app.js               # Main application logic (hand tracking + depth)
│   ├── style.css            # Styling
│   └── vendor/              # Third-party libraries
│       ├── hands.js         # MediaPipe Hands
│       ├── camera_utils.js  # MediaPipe Camera
│       └── three.module.js  # Three.js
├── requirements.txt          # Python dependencies (Flask)
├── requirements_depth.txt    # Depth server dependencies
├── package.json             # Node.js dependencies
├── README.md                # This file
├── RUN.md                   # Quick start guide
├── ORBBEC_INSTALL.md        # Orbbec SDK installation guide
└── DEPTH_TESTING.md         # Depth integration testing guide
```

## Technologies

- **Backend**: Flask (Python) + WebSocket server
- **Frontend**: Vanilla JavaScript (ES6 modules)
- **3D Graphics**: Three.js
- **Hand Tracking**: MediaPipe Hands
- **Depth Sensing**: Orbbec SDK v2 (Python bindings)
- **Communication**: WebSocket (bidirectional depth queries)
- **Styling**: CSS3

## Configuration

All tunable parameters are in **one place** at the top of `static/app.js` (lines 9-85):

### Gesture Sensitivity
- `PINCH_ON_PX` / `PINCH_OFF_PX`: Pinch detection thresholds
- `FIST_THRESH`: Fist detection threshold
- `HOLD_*_FRAMES`: Intent gating (prevent accidental triggers)

### Movement
- `MOVE_SENS`: XZ plane movement sensitivity
- `MOVE_DEADZONE_PX`: Ignore tiny hand jitter

### Depth (Z-axis)
- `Z_GAIN`: Push/pull strength (1.8 = moderate, 3.0 = dramatic)
- `Z_SMOOTH`: Z movement smoothing (0.12 = responsive)
- `Z_DEADZONE_M`: Ignore depth changes <2cm
- `Z_CLAMP`: Maximum Z offset in world units

### Visual
- `ORB_CORE_RADIUS`, `ORB_RING_*`: Orb size (reduced by ~35% from original)
- `C_CYAN`, `C_AMBER`, `C_BG`: Color palette (Stark minimal)
- `BEAM_POINTS`: Beam smoothness (18 = straight line)

### Snap/Docking
- `SNAP_POS`, `SNAP_ROT_DEG`, `SNAP_SCALE_STEP`: Auto-align grid
- `SNAP_IDLE_DELAY_MS`: Delay before snapping kicks in

See inline comments in CONFIG section for all parameters.

## Browser Compatibility

- Chrome/Edge (recommended)
- Firefox
- Safari (may have limited WebRTC support)

## Development

The application runs in debug mode by default. To modify the server configuration, edit `app.py`:

```python
app.run(host="127.0.0.1", port=5000, debug=True)
```

## License

ISC

## Author

[adeel1608](https://github.com/adeel1608)

## Acknowledgments

- MediaPipe for hand tracking technology
- Three.js for 3D graphics framework
- Flask for the web framework

