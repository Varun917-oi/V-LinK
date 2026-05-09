import subprocess
import os
import re

class ADBManager:
    def __init__(self, adb_path=None):
        if adb_path is None:
            # Check local bin folder first
            local_adb = os.path.join(os.getcwd(), "bin", "adb.exe")
            if os.path.exists(local_adb):
                self.adb_path = local_adb
            else:
                self.adb_path = "adb" # Fallback to PATH
        else:
            self.adb_path = adb_path

    def run_command(self, args):
        try:
            result = subprocess.run(
                [self.adb_path] + args,
                capture_output=True,
                text=True,
                creationflags=subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0
            )
            return result.stdout, result.stderr
        except Exception as e:
            return None, str(e)

    def get_devices(self):
        stdout, _ = self.run_command(["devices"])
        if not stdout:
            return []
        
        devices = []
        lines = stdout.strip().split('\n')[1:]
        for line in lines:
            if '\tdevice' in line:
                serial = line.split('\t')[0]
                devices.append(serial)
        return devices

    def forward_port(self, local_port, remote_name):
        # remote_name can be localabstract:scrcpy
        _, err = self.run_command(["forward", f"tcp:{local_port}", remote_name])
        return err == ""

    def reverse_port(self, remote_port, local_name):
        _, err = self.run_command(["reverse", f"tcp:{remote_port}", local_name])
        return err == ""

    def push_file(self, local_path, remote_path):
        _, err = self.run_command(["push", local_path, remote_path])
        return err == ""

    def shell(self, serial, command):
        stdout, stderr = self.run_command(["-s", serial, "shell", command])
        return stdout, stderr

    def connect_wifi(self, ip, port=5555):
        stdout, stderr = self.run_command(["connect", f"{ip}:{port}"])
        return "connected" in stdout.lower()
