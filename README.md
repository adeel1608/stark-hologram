# Stark Hologram

A hand-tracking controlled 3D holographic interface built with Flask, Three.js, and MediaPipe. Interact with a holographic building visualization using natural hand gestures in real-time.

**Repository**: https://github.com/adeel1608/stark-hologram

## Features

- **Hand Tracking**: Real-time hand gesture recognition using MediaPipe
- **3D Visualization**: Interactive holographic building rendered with Three.js
- **Gesture Controls**:
  - **Fist (Right Hand)**: Move the building in 3D space
  - **Pinch (Left Hand)**: Select floors and pull them horizontally
  - **Two-Hand Pinch**: Rotate, scale, and explode floors
  - **Open Palm**: Toggle wireframe mode
  - **Double Thumbs Up**: Reset to default state
- **Visual Effects**: Energy beams, particle systems, and dynamic lighting
- **HUD Display**: Real-time status and floor labels

## Prerequisites

- Python 3.8+
- Node.js 14+ (for npm dependencies)
- Modern web browser with WebRTC support (Chrome, Firefox, Edge)
- Webcam for hand tracking

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

2. Install Python dependencies:
```bash
pip install -r requirements.txt
```

3. Install Node.js dependencies:
```bash
npm install
```

## Usage

1. Start the Flask server:
```bash
python app.py
```

2. Open your browser and navigate to:
```
http://127.0.0.1:5000
```

3. Allow camera access when prompted.

4. Use hand gestures to interact with the holographic building:
   - Make a fist with your right hand and move it to reposition the building
   - Pinch with your left hand to select and pull floors
   - Use two-hand pinch to transform (rotate, scale, explode)
   - Hold an open palm to toggle wireframe mode
   - Show double thumbs up to reset

## Gesture Controls

| Gesture | Action |
|---------|--------|
| ✊ Right Hand Fist | Move building in 3D space |
| 🤏 Left Hand Pinch | Select floor / Pull selected floor (drag left/right) |
| 🤏🤏 Two-Hand Pinch | Rotate + Scale building |
| 🤏🤏 + Hands Up/Down | Explode floors vertically |
| 🖐 Open Palm (idle) | Toggle wireframe mode |
| 👍👍 Double Thumbs Up | Reset to default state |
| R Key | Reset (keyboard shortcut) |

## Project Structure

```
stark-hologram/
├── app.py                 # Flask server
├── templates/
│   └── index.html         # Main HTML template
├── static/
│   ├── app.js            # Main application logic
│   ├── style.css         # Styling
│   ├── favicon.ico       # Favicon
│   └── vendor/           # Third-party libraries
│       ├── hands.js      # MediaPipe Hands
│       ├── camera_utils.js
│       └── three.module.js
├── requirements.txt       # Python dependencies
├── package.json          # Node.js dependencies
└── README.md            # This file
```

## Technologies

- **Backend**: Flask (Python)
- **Frontend**: Vanilla JavaScript (ES6 modules)
- **3D Graphics**: Three.js
- **Hand Tracking**: MediaPipe Hands
- **Styling**: CSS3

## Configuration

Key parameters can be adjusted in `static/app.js`:

- `LANDMARK_SMOOTH`: Hand tracking smoothness (0-1)
- `PINCH_ON_PX` / `PINCH_OFF_PX`: Pinch detection thresholds
- `MOVE_SENS`: Movement sensitivity
- `SNAP_POS`, `SNAP_ROT_DEG`: Snap-to-grid settings
- Color constants: `C_CYAN`, `C_AMBER`, `C_BG`

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

