# Orbbec Gemini 336 SDK Installation Guide (Isolated to .venv)

This guide provides step-by-step instructions for installing the Orbbec SDK v2 **completely isolated to your project's .venv** on Ubuntu 22.04. This ensures no interference with other projects or system Python.

## Prerequisites

- Ubuntu 22.04 (or compatible Linux distribution)
- Orbbec Gemini 336 camera connected via USB
- Python 3.8+ with venv
- sudo access ONLY for USB permissions (not for SDK installation)

## Method 1: Local Install (Isolated to .venv) - RECOMMENDED

This method keeps ALL Orbbec SDK files within your project directory and venv. **No system-wide installation.**

### Step 1: Download Orbbec SDK

1. Visit the official Orbbec developer download page:
   ```
   https://www.orbbec.com/developers/download/
   ```

2. Download **OrbbecSDK v2.x** for Linux (Ubuntu 22.04 compatible)
   - Look for: `OrbbecSDK_v2.x.x_linux_x64.tar.gz` or similar

3. Extract to your project directory:
   ```bash
   cd /home/adeel/temu-stark-holo
   mkdir -p orbbec_sdk
   cd orbbec_sdk
   tar -xzf ~/Downloads/OrbbecSDK_v2.*_linux_x64.tar.gz
   cd OrbbecSDK_v2.*/
   ```

### Step 2: Install SDK Libraries Locally (NOT system-wide)

```bash
# Create local lib directory in your project
mkdir -p /home/adeel/temu-stark-holo/.venv/lib/orbbec

# Copy SDK libraries to venv (NOT to /usr/local)
cp -r lib/* /home/adeel/temu-stark-holo/.venv/lib/orbbec/

# Copy SDK headers to venv
mkdir -p /home/adeel/temu-stark-holo/.venv/include/orbbec
cp -r include/* /home/adeel/temu-stark-holo/.venv/include/orbbec/
```

### Step 3: Install Python Bindings to .venv

```bash
# Navigate to Python bindings directory
cd pyorbbecsdk/

# Activate your project's virtual environment
source /home/adeel/temu-stark-holo/.venv/bin/activate

# Install Python bindings (isolated to venv)
pip install .
```

### Step 4: Set Library Path (Project-Specific)

Create an activation script that sets LD_LIBRARY_PATH automatically when you activate the venv:

```bash
# Create activation hook
cat > /home/adeel/temu-stark-holo/.venv/bin/activate_orbbec << 'EOF'
#!/bin/bash
# Add Orbbec libraries to path (only for this venv)
export LD_LIBRARY_PATH="/home/adeel/temu-stark-holo/.venv/lib/orbbec:$LD_LIBRARY_PATH"
echo "[orbbec] Libraries loaded from venv"
EOF

chmod +x /home/adeel/temu-stark-holo/.venv/bin/activate_orbbec
```

Now modify your venv's activate script to automatically source this:

```bash
# Append to venv activate script
echo "" >> /home/adeel/temu-stark-holo/.venv/bin/activate
echo "# Orbbec SDK library path (project-specific)" >> /home/adeel/temu-stark-holo/.venv/bin/activate
echo "source /home/adeel/temu-stark-holo/.venv/bin/activate_orbbec 2>/dev/null || true" >> /home/adeel/temu-stark-holo/.venv/bin/activate
```

### Step 5: USB Permissions (ONLY sudo step needed)

This is the ONLY system-wide change needed (for USB camera access):

```bash
# Create udev rule for Orbbec cameras (replace XX:XX with your device ID from lsusb)
lsusb | grep -i orbbec
# Example output: Bus 001 Device 005: ID 2bc5:0660 Orbbec 3D...
# Use the ID (2bc5:0660 in this example)

# Create udev rule (substitute your actual vendor:product ID)
sudo tee /etc/udev/rules.d/99-orbbec.rules << 'EOF'
# Orbbec Gemini 336 USB permissions
SUBSYSTEM=="usb", ATTR{idVendor}=="2bc5", MODE="0666", GROUP="plugdev"
KERNEL=="video*", ATTR{idVendor}=="2bc5", MODE="0666", GROUP="plugdev"
EOF

# Reload udev rules
sudo udevadm control --reload-rules
sudo udevadm trigger

# Add yourself to plugdev group (if not already)
sudo usermod -a -G plugdev $USER

# Log out and back in for group changes to take effect
```

**Note:** Replace `2bc5` with your actual vendor ID from `lsusb` output.

### Step 6: Verify Installation (All in .venv)

```bash
# Activate venv (will automatically load Orbbec libraries)
source /home/adeel/temu-stark-holo/.venv/bin/activate

# Test import
python3 -c "import pyorbbecsdk; print('SDK Version:', pyorbbecsdk.__version__)"
```

Expected output:
```
[orbbec] Libraries loaded from venv
SDK Version: 2.x.x
```

### Step 7: Test Camera Connection

```bash
# Activate venv
source /home/adeel/temu-stark-holo/.venv/bin/activate

# List connected Orbbec devices
python3 -c "
import pyorbbecsdk as ob
ctx = ob.Context()
devices = ctx.query_devices()
print(f'Found {devices.get_count()} Orbbec device(s)')
for i in range(devices.get_count()):
    dev = devices.get_device(i)
    info = dev.get_device_info()
    print(f'  Device {i}: {info.get_name()}')
"
```

Expected output:
```
Found 1 Orbbec device(s)
  Device 0: Orbbec Gemini 336
```

## Method 2: System-Wide Install (NOT RECOMMENDED - Can Conflict)

⚠️ **Warning:** This method installs SDK libraries to `/usr/local/lib` which can conflict with other projects.

Only use this if you're certain no other projects use Orbbec SDK or you want system-wide access.

<details>
<summary>Click to expand system-wide installation (not recommended)</summary>

```bash
cd /home/adeel/temu-stark-holo/orbbec_sdk/OrbbecSDK_v2.*/

# Install system-wide (requires sudo)
sudo bash install.sh

# Install Python bindings to venv
cd pyorbbecsdk/
source /home/adeel/temu-stark-holo/.venv/bin/activate
pip install .
```

This installs to:
- `/usr/local/lib/libOrbbec*.so`
- `/usr/local/include/libobsensor/`
- `/etc/udev/rules.d/99-obsensor-*.rules`

</details>

## Verify Everything is Isolated

Check that SDK is NOT installed system-wide:

```bash
# Should return nothing (or only from your venv)
ls /usr/local/lib/libOrbbec* 2>/dev/null || echo "✅ No system-wide SDK libs"

# Python bindings should be in venv only
pip list | grep pyorbbecsdk
# Should show: pyorbbecsdk  X.X.X

# Check where it's installed
pip show pyorbbecsdk | grep Location
# Should show: Location: /home/adeel/temu-stark-holo/.venv/lib/python3.X/site-packages
```

## Project Structure After Installation

```
/home/adeel/temu-stark-holo/
├── .venv/
│   ├── bin/
│   │   ├── activate                    # Modified to load Orbbec libs
│   │   └── activate_orbbec            # Sets LD_LIBRARY_PATH
│   ├── lib/
│   │   ├── orbbec/                    # SDK native libraries (local)
│   │   │   ├── libOrbbecSDK.so*
│   │   │   └── ...
│   │   └── python3.X/site-packages/
│   │       └── pyorbbecsdk/           # Python bindings (venv)
│   └── include/
│       └── orbbec/                     # SDK headers (local)
│           └── libobsensor/
├── orbbec_sdk/                         # SDK download (can delete after install)
│   └── OrbbecSDK_v2.*/
├── app.py
├── depth_server.py
└── ...
```

## Troubleshooting

### "Library not found" error

```bash
# Check LD_LIBRARY_PATH is set
echo $LD_LIBRARY_PATH
# Should include: /home/adeel/temu-stark-holo/.venv/lib/orbbec

# If not, make sure you're activating venv correctly:
source /home/adeel/temu-stark-holo/.venv/bin/activate
# Should print: [orbbec] Libraries loaded from venv
```

### "Module not found: pyorbbecsdk"

```bash
# Verify venv is activated
which python3
# Should show: /home/adeel/temu-stark-holo/.venv/bin/python3

# If not:
source /home/adeel/temu-stark-holo/.venv/bin/activate

# Reinstall bindings
cd /home/adeel/temu-stark-holo/orbbec_sdk/OrbbecSDK_v2.*/pyorbbecsdk/
pip install --force-reinstall .
```

### USB Permission Denied

```bash
# Check udev rule exists
ls -l /etc/udev/rules.d/99-orbbec.rules

# Check your user is in plugdev group
groups | grep plugdev

# If not, add and re-login:
sudo usermod -a -G plugdev $USER
# Then log out and back in
```

### Camera Not Detected

```bash
# Check USB connection
lsusb | grep -i orbbec

# Check dmesg for USB errors
dmesg | tail -20

# Try different USB port (preferably USB 3.0)

# Check permissions
ls -l /dev/video* | grep video
```

### Depth Stream Fails to Start

If depth_server.py starts but doesn't stream depth:

1. Check camera firmware is up to date (use Orbbec Viewer tool)
2. Try reducing stream resolution in `depth_server.py`:
   ```python
   # Change from 640x400 to 320x200
   self.depth_width = 320
   self.depth_height = 200
   ```
3. Disable alignment temporarily:
   ```python
   # In depth_server.py, comment out alignment
   # self.align = SDK_MODULE.Align(...)
   ```

### Conflicts with Other Projects

**This should NOT happen** with the local install method!

If you somehow have conflicts:

```bash
# Uninstall system-wide SDK (if accidentally installed)
sudo rm -rf /usr/local/lib/libOrbbec*
sudo rm -rf /usr/local/include/libobsensor/

# Keep only venv installation
# Libraries in: /home/adeel/temu-stark-holo/.venv/lib/orbbec/
# Bindings in: /home/adeel/temu-stark-holo/.venv/lib/python3.X/site-packages/pyorbbecsdk/
```

## Verifying Complete Setup (All Isolated)

```bash
# Terminal 1: Start depth server
cd /home/adeel/temu-stark-holo
source .venv/bin/activate
python depth_server.py
```

Expected output:
```
[orbbec] Libraries loaded from venv
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

```bash
# Terminal 2: Start Flask web server
cd /home/adeel/temu-stark-holo
source .venv/bin/activate
python app.py
```

Open browser to `http://127.0.0.1:5000` and verify:
- Camera preview visible
- Hand tracking active
- Depth status shows: `depth: L=--m R=XXm` (when right hand visible)

## Cleanup / Uninstall (Isolated Method)

To completely remove Orbbec SDK from this project without affecting anything else:

```bash
# Deactivate venv
deactivate

# Remove Python bindings
source /home/adeel/temu-stark-holo/.venv/bin/activate
pip uninstall pyorbbecsdk -y

# Remove local libraries
rm -rf /home/adeel/temu-stark-holo/.venv/lib/orbbec
rm -rf /home/adeel/temu-stark-holo/.venv/include/orbbec
rm -f /home/adeel/temu-stark-holo/.venv/bin/activate_orbbec

# Remove SDK download (optional)
rm -rf /home/adeel/temu-stark-holo/orbbec_sdk

# Remove udev rule (optional, only if you're done with Orbbec cameras completely)
sudo rm /etc/udev/rules.d/99-orbbec.rules
sudo udevadm control --reload-rules
```

Your other projects remain completely unaffected!

## Switching Between Projects

The beauty of the local install:

```bash
# Project 1 (stark-hologram with Orbbec)
cd /home/adeel/temu-stark-holo
source .venv/bin/activate
# LD_LIBRARY_PATH automatically set to this project's Orbbec libs
python depth_server.py  # Works!

# Deactivate
deactivate

# Project 2 (some other project)
cd /home/adeel/other-project
source .venv/bin/activate
# LD_LIBRARY_PATH does NOT include Orbbec (isolated!)
python main.py  # No conflicts!
```

## Additional Resources

- **Orbbec Developer Docs**: https://www.orbbec.com/developers/
- **Orbbec SDK GitHub**: https://github.com/orbbec/OrbbecSDK
- **Gemini 336 Product Page**: https://www.orbbec.com/products/structured-light-camera/gemini-336/

## Support

If you encounter issues not covered here:

1. Check Orbbec forum: https://3dclub.orbbec3d.com/
2. Review SDK GitHub issues: https://github.com/orbbec/OrbbecSDK/issues
3. Check USB 3.0 cable quality (common issue)
4. Verify camera firmware is up to date using Orbbec Viewer

## Summary: What Gets Installed Where

| Component | Location | Scope |
|-----------|----------|-------|
| SDK Native Libraries | `/home/adeel/temu-stark-holo/.venv/lib/orbbec/` | **Project-only** |
| SDK Headers | `/home/adeel/temu-stark-holo/.venv/include/orbbec/` | **Project-only** |
| Python Bindings | `/home/adeel/temu-stark-holo/.venv/lib/python3.X/site-packages/` | **Project-only** |
| LD_LIBRARY_PATH | Set by `.venv/bin/activate_orbbec` | **Project-only** |
| USB Permissions | `/etc/udev/rules.d/99-orbbec.rules` | **System-wide** (camera access only) |

**Bottom line:** Everything SDK-related is isolated to your `.venv`. Only USB permissions are system-wide (needed for camera hardware access).
