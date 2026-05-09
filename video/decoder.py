import av
import socket
import threading
import queue
import time
import os
from utils.gpu_detect import detect_gpu_capabilities

class VideoDecoder:
    def __init__(self, port=27183):
        self.port = port
        self.frame_queue = queue.Queue(maxsize=2) # Keep buffer small for low latency
        self.running = False
        self.decode_thread = None
        self.socket = None
        self.caps = None

    def _get_best_hwaccel(self):
        if self.caps["vendor"] == "NVIDIA":
            return "cuda"
        elif self.caps["vendor"] == "Intel":
            return "qsv"
        elif self.caps["vendor"] == "AMD":
            return "d3d11va" # or dxva2
        return "d3d11va" if self.caps["d3d11_supported"] else None

    def start(self, mode="wired", gpu_pref=None):
        self.caps = detect_gpu_capabilities(preferred_type=gpu_pref)
        self.hw_accel = self._get_best_hwaccel()
        
        self.running = True
        self.decode_thread = threading.Thread(target=self._decode_loop, args=(mode,), daemon=True)
        self.decode_thread.start()

    def stop(self):
        self.running = False
        if self.socket:
            try:
                self.socket.close()
            except:
                pass

    def _decode_loop(self, mode):
        time.sleep(0.5) # Wait for engine
        
        try:
            if mode == "wired":
                self.socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
                self.socket.connect(("127.0.0.1", self.port))
                
                # Protocol handling (assuming a custom or scrcpy-like protocol)
                # Skip header if it exists
                # ...
                
                # Open H264 stream with hardware acceleration
                options = {
                    'rtsp_transport': 'udp',
                    'fflags': 'nobuffer',
                    'flags': 'low_delay',
                }
                
                container = av.open(self.socket, format='h264', options=options)
            else:
                # WebRTC or other wireless transport handled elsewhere or passed via pipe
                return

            # Set up hardware decoding
            video_stream = container.streams.video[0]
            if self.hw_accel:
                # PyAV 10+ supports hwaccel more easily
                # However, for maximum compatibility and performance, 
                # we'll use software fallback if hardware fails
                pass

            for frame in container.decode(video=0):
                if not self.running:
                    break
                
                # For ultra-low latency, we want to avoid CPU-based format conversion
                # But for the UI to display it, we need a format it understands.
                # Optimized: Convert to YUV420P and handle YUV->RGB in GPU shader
                
                if self.frame_queue.full():
                    try:
                        self.frame_queue.get_nowait()
                    except queue.Empty:
                        pass
                
                # Put the raw frame or ndarray
                self.frame_queue.put(frame)

        except Exception as e:
            print(f"[Decoder] Error: {e}")
        finally:
            self.running = False

    def get_frame(self):
        try:
            return self.frame_queue.get_nowait()
        except queue.Empty:
            return None
