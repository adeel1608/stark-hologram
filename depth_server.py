#!/usr/bin/env python3
"""
Orbbec Gemini 336 Depth Server for Stark Hologram
WebSocket bridge: receives hand pixel coords from browser, returns depth in meters.
"""
import asyncio
import json
import time
import sys
from typing import Optional, Tuple
import numpy as np

import websockets

# ===================== CONFIG =====================
HOST = "127.0.0.1"
PORT = 8765
FPS = 30
DEPTH_WINDOW_SIZE = 7  # sample NxN window around point for robust median
HEARTBEAT_INTERVAL_MS = 500  # send heartbeat if no hand data received

# ===================== ORBBEC SDK AUTO-DETECT =====================
SDK_MODULE = None
SDK_NAME = None

# Try importing Orbbec SDK in order of likelihood
SDK_CANDIDATES = [
    "pyorbbecsdk",  # Most common Python binding name
    "ob",           # Short alias sometimes used
    "orbbecsdk",    # Alternative naming
    "pyorbbec",     # Another variant
    "OrbbecSDK",    # PascalCase variant
]

def detect_orbbec_sdk():
    """Auto-detect which Orbbec SDK Python module is installed."""
    global SDK_MODULE, SDK_NAME
    
    for candidate in SDK_CANDIDATES:
        try:
            SDK_MODULE = __import__(candidate)
            SDK_NAME = candidate
            print(f"[depth] ✅ Found Orbbec SDK: {candidate}")
            return True
        except ImportError:
            continue
    
    print("\n" + "="*70)
    print("⚠️  ORBBEC SDK NOT FOUND")
    print("="*70)
    print("\nTo enable real depth, install Orbbec SDK v2 for Linux:")
    print("\n1. Download SDK from:")
    print("   https://www.orbbec.com/developers/download/")
    print("   → Choose: OrbbecSDK v2.x for Linux (Ubuntu 22.04 compatible)")
    print("\n2. Extract and install:")
    print("   cd OrbbecSDK-*/")
    print("   sudo bash install.sh")
    print("\n3. Install Python bindings:")
    print("   cd pyorbbecsdk/")
    print("   source /path/to/your/.venv/bin/activate")
    print("   pip install .")
    print("\n4. Test:")
    print("   python3 -c 'import pyorbbecsdk; print(pyorbbecsdk.__version__)'")
    print("\n5. Restart this server:")
    print("   python depth_server.py")
    print("\nAlternative: Install via pip (if available):")
    print("   pip install pyorbbecsdk")
    print("\n" + "="*70)
    print("Running in PLACEHOLDER mode (streaming null depth values)")
    print("="*70 + "\n")
    return False


# ===================== DEPTH PROVIDER =====================
class DepthProvider:
    """Manages Orbbec Gemini 336 depth streaming."""
    
    def __init__(self):
        self.enabled = False
        self.pipeline = None
        self.config = None
        self.align = None
        self.depth_frame = None
        self.color_frame = None
        self.depth_width = 640
        self.depth_height = 400
        self.color_width = 640
        self.color_height = 480
        self.last_hand_points = {"left": None, "right": None, "t": 0}
        
        if detect_orbbec_sdk():
        self._init_orbbec()

    def _init_orbbec(self):
        """Initialize Orbbec SDK and start streaming."""
        try:
            print("[depth] Initializing Orbbec Gemini 336...")
            
            # Create pipeline
            self.pipeline = SDK_MODULE.Pipeline()
            
            # Configure streams
            self.config = SDK_MODULE.Config()
            
            # Enable depth stream (640x400 recommended for Gemini 336)
            try:
                self.config.enable_stream(
                    SDK_MODULE.StreamType.DEPTH_STREAM,
                    self.depth_width,
                    self.depth_height,
                    30,
                    SDK_MODULE.Format.Y16  # 16-bit depth
                )
                print(f"[depth] ✓ Depth stream: {self.depth_width}x{self.depth_height}")
            except Exception as e:
                print(f"[depth] ⚠️  Depth stream config failed: {e}")
                self.enabled = False
                return
            
            # Enable color stream for alignment (optional but recommended)
            try:
                self.config.enable_stream(
                    SDK_MODULE.StreamType.COLOR_STREAM,
                    self.color_width,
                    self.color_height,
                    30,
                    SDK_MODULE.Format.RGB888
                )
                print(f"[depth] ✓ Color stream: {self.color_width}x{self.color_height}")
            except Exception as e:
                print(f"[depth] ⚠️  Color stream config failed (alignment may not work): {e}")
            
            # Start pipeline
            try:
                self.pipeline.start(self.config)
                print("[depth] ✓ Pipeline started")
            except Exception as e:
                print(f"[depth] ❌ Failed to start pipeline: {e}")
                self.enabled = False
                return
            
            # Try to enable alignment (depth → color)
            try:
                self.align = SDK_MODULE.Align(SDK_MODULE.StreamType.COLOR_STREAM)
                print("[depth] ✓ Depth→Color alignment enabled")
            except Exception as e:
                print(f"[depth] ⚠️  Alignment not available: {e}")
                print("[depth] Hand coords should match depth frame directly")
            
            self.enabled = True
            print("[depth] ✅ Orbbec Gemini 336 ready!")
            
        except Exception as e:
            print(f"[depth] ❌ Orbbec init failed: {e}")
            import traceback
            traceback.print_exc()
            self.enabled = False
    
    def update_frames(self):
        """Grab latest frames from Orbbec."""
        if not self.enabled or not self.pipeline:
            return
        
        try:
            # Wait for frames (timeout 100ms)
            frameset = self.pipeline.wait_for_frames(timeout_ms=100)
            if frameset is None:
                return
            
            # Apply alignment if available
            if self.align:
                frameset = self.align.process(frameset)
            
            # Get depth frame
            depth_frame = frameset.get_depth_frame()
            if depth_frame:
                self.depth_frame = depth_frame
            
            # Get color frame (optional, for reference)
            color_frame = frameset.get_color_frame()
            if color_frame:
                self.color_frame = color_frame
                
        except Exception as e:
            # Timeout or frame grab error (non-fatal)
            pass
    
    def sample_depth_m(self, x: int, y: int) -> Optional[float]:
        """
        Sample depth at pixel (x, y) with robust median filter.
        
        Args:
            x, y: Pixel coordinates (0-based, from top-left)
        
        Returns:
            Depth in meters, or None if invalid
        """
        if not self.enabled or self.depth_frame is None:
            return None
        
        try:
            # Get depth frame dimensions
            width = self.depth_frame.get_width()
            height = self.depth_frame.get_height()
            
            # Clamp coords to frame bounds
            x = max(0, min(width - 1, int(x)))
            y = max(0, min(height - 1, int(y)))
            
            # Sample window around (x, y)
            half = DEPTH_WINDOW_SIZE // 2
            samples = []
            
            for dy in range(-half, half + 1):
                for dx in range(-half, half + 1):
                    px = x + dx
                    py = y + dy
                    if 0 <= px < width and 0 <= py < height:
                        # Get depth value (mm)
                        depth_mm = self.depth_frame.get_distance(px, py)
                        if depth_mm > 0:  # Ignore invalid (0) values
                            samples.append(depth_mm)
            
            if not samples:
                return None
            
            # Robust median
            depth_mm = float(np.median(samples))
            depth_m = depth_mm / 1000.0  # Convert mm → m
            
            return depth_m
            
        except Exception as e:
            print(f"[depth] Sample error at ({x},{y}): {e}")
            return None
    
    def update_hand_points(self, msg: dict):
        """Update hand pixel coordinates from browser."""
        try:
            self.last_hand_points = {
                "left": msg.get("left"),
                "right": msg.get("right"),
                "t": msg.get("t", 0)
            }
        except Exception as e:
            print(f"[depth] Invalid hand points message: {e}")

    def read_depth_m(self) -> Tuple[Optional[float], Optional[float]]:
        """
        Return (left_m, right_m) depth values.
        Samples depth at last known hand positions.
        """
        if not self.enabled:
            return None, None

        # Update frames
        self.update_frames()
        
        left = self.last_hand_points.get("left")
        right = self.last_hand_points.get("right")
        
        left_m = self.sample_depth_m(left["x"], left["y"]) if left else None
        right_m = self.sample_depth_m(right["x"], right["y"]) if right else None
        
        return left_m, right_m
    
    def cleanup(self):
        """Stop pipeline and cleanup resources."""
        if self.pipeline:
            try:
                self.pipeline.stop()
                print("[depth] Pipeline stopped")
            except:
                pass


# ===================== WEBSOCKET HANDLER =====================
def now_ms() -> int:
    return int(time.time() * 1000)


async def handler(websocket):
    """
    WebSocket handler for depth streaming.
    
    Protocol:
    - Browser → Server: {"t": <ms>, "left": {"x": <px>, "y": <px>} | null, "right": {...} | null}
    - Server → Browser: {"t": <ms>, "left_m": <float> | null, "right_m": <float> | null}
    """
    provider = DepthProvider()
    print(f"[depth] ✅ Client connected from {websocket.remote_address}")
    
    last_inbound_t = 0

    try:
        async def send_depth_msg():
            """Send depth response to browser."""
            left_m, right_m = provider.read_depth_m()
            msg = {
                "t": now_ms(),
                "left_m": left_m,
                "right_m": right_m,
            }
            await websocket.send(json.dumps(msg))
        
        # Main loop
        while True:
            try:
                # Check for inbound messages (hand coords) with timeout
                msg_raw = await asyncio.wait_for(
                    websocket.recv(),
                    timeout=1.0 / FPS
                )
                
                # Parse and update hand points
                msg = json.loads(msg_raw)
                provider.update_hand_points(msg)
                last_inbound_t = now_ms()
                
                # Immediately respond with depth
                await send_depth_msg()
                
            except asyncio.TimeoutError:
                # No inbound message this frame
                # Send heartbeat if hand data is stale
                if (now_ms() - last_inbound_t) > HEARTBEAT_INTERVAL_MS:
                    await send_depth_msg()
                    
            except json.JSONDecodeError as e:
                print(f"[depth] ⚠️  Invalid JSON: {e}")
                
    except websockets.ConnectionClosed:
        print("[depth] Client disconnected")
    except Exception as e:
        print(f"[depth] ❌ Error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        provider.cleanup()


async def main():
    print("\n" + "="*70)
    print("STARK HOLOGRAM - ORBBEC GEMINI 336 DEPTH SERVER")
    print("="*70)
    print(f"WebSocket: ws://{HOST}:{PORT}")
    print(f"FPS: {FPS}")
    print("="*70 + "\n")
    
    async with websockets.serve(handler, HOST, PORT):
        print("[depth] 🚀 Server running. Press Ctrl+C to stop.\n")
        await asyncio.Future()  # Run forever


if __name__ == "__main__":
    try:
    asyncio.run(main())
    except KeyboardInterrupt:
        print("\n[depth] Shutdown requested")
        sys.exit(0)
