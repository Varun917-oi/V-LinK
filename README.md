# V-LinK

V-LinK is a professional, ultra-low latency Android screen mirroring application for Windows.

## Features
- **Ultra-Low Latency**: Optimized pipeline for near-native responsiveness.
- **60 FPS Support**: Smooth rendering via OpenGL.
- **Wired & Wireless**: Supports both USB and WiFi mirroring.
- **Performance Tuning**: Dedicated panel for GPU and quality settings.
- **Low-End PC Mode**: Optimized for older hardware with adaptive resolution.

## Setup Instructions

### 1. Requirements
- Python 3.9+
- ADB (Android Debug Bridge) installed and in your PATH.
- Android device with USB Debugging enabled.

### 2. Dependencies
Install the required Python packages:
```bash
pip install PySide6 av qdarktheme PyOpenGL PyOpenGL_accelerate numpy
```

### 3. Scrcpy Server
The `scrcpy-server.jar` and `adb.exe` have been automatically placed in the `bin/` directory for you. If they are missing, you can manually download them:
1. Download `scrcpy-server` from: [scrcpy GitHub](https://github.com/Genymobile/scrcpy/releases)
2. Place in `bin/scrcpy-server.jar`
3. Place `adb.exe` and its DLLs in `bin/`

## How to Run
```bash
python main.py
```

## Performance Tips
- **Wired Mode**: Use a high-quality USB cable and a USB 3.0 port for the lowest latency.
- **Low-End Mode**: If you experience lag on an old laptop, enable "Low-End PC Mode" in the Performance Tuning panel.
- **GPU Selection**: The app automatically uses your primary GPU for rendering.
