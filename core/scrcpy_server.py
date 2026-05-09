import threading
import time
import subprocess
import os

class ScrcpyServer:
    def __init__(self, adb_manager, serial, server_path="bin/scrcpy-server.jar"):
        self.adb = adb_manager
        self.serial = serial
        self.server_path = server_path
        self.remote_path = "/data/local/tmp/scrcpy-server.jar"
        self.process = None
        self._stop_event = threading.Event()

    def start(self, max_fps=60, bit_rate=20000000, max_size=1920, tunnel_forward=True, codec="h264"):
        """
        Starts the scrcpy server with the given parameters.
        """
        if not os.path.exists(self.server_path):
            raise FileNotFoundError(f"Scrcpy server not found at {self.server_path}. Please place scrcpy-server.jar in the bin/ folder.")

        # Push server to device
        self.adb.push_file(self.server_path, self.remote_path)

        # Build command for scrcpy-server 2.4
        version = "2.4"
        cmd = [
            self.adb.adb_path, "-s", self.serial, "shell",
            f"CLASSPATH={self.remote_path}", "app_process", "/", "com.genymobile.scrcpy.Server",
            version,
            f"max_fps={max_fps}",
            f"bit_rate={bit_rate}",
            f"max_size={max_size}",
            f"tunnel_forward={tunnel_forward}",
            f"video_codec={codec}",
            "audio=false",
            "control=true",
            "cleanup=true"
        ]

        def run():
            self.process = subprocess.Popen(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                creationflags=subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0
            )
            while not self._stop_event.is_set():
                line = self.process.stderr.readline()
                if not line:
                    break
                print(f"[Server] {line.decode().strip()}")

        self.thread = threading.Thread(target=run, daemon=True)
        self.thread.start()

    def stop(self):
        self._stop_event.set()
        if self.process:
            self.process.terminate()
            self.process.wait()
