import os
import subprocess
import json

def get_gpu_list():
    """
    Returns a list of all detected GPUs with their types.
    """
    gpus = []
    if os.name == 'nt':
        try:
            output = subprocess.check_output("wmic path win32_VideoController get name,AdapterRAM,PNPDeviceID", shell=True).decode()
            lines = output.strip().split('\n')[1:]
            for line in lines:
                parts = line.split()
                if not parts: continue
                name = " ".join(parts[:-2])
                ram = int(parts[-2]) if parts[-2].isdigit() else 0
                
                # Heuristic for Integrated vs Dedicated
                is_integrated = "Intel" in name or ram < 2 * 1024 * 1024 * 1024 # Less than 2GB usually integrated or very weak
                
                gpus.append({
                    "name": name,
                    "ram_mb": ram // (1024 * 1024),
                    "type": "Integrated" if is_integrated else "Dedicated"
                })
        except:
            pass
    return gpus

def detect_gpu_capabilities(preferred_type=None):
    """
    Detects GPU hardware capabilities.
    If preferred_type is "Integrated" or "Dedicated", it prioritizes that one.
    """
    gpus = get_gpu_list()
    selected_gpu = None
    
    if preferred_type:
        for gpu in gpus:
            if gpu["type"] == preferred_type:
                selected_gpu = gpu
                break
    
    if not selected_gpu and gpus:
        selected_gpu = gpus[0] # Fallback to first

    caps = {
        "vendor": "Unknown",
        "name": "Software",
        "renderer": "OpenGL",
        "decoder": "software",
        "d3d11_supported": False,
        "is_low_end": False
    }
    
    if selected_gpu:
        name = selected_gpu["name"].upper()
        caps["name"] = selected_gpu["name"]
        if "NVIDIA" in name:
            caps["vendor"] = "NVIDIA"
            caps["decoder"] = "nvdec"
        elif "INTEL" in name:
            caps["vendor"] = "Intel"
            caps["decoder"] = "qsv"
            # Detect i3-2nd gen (Sandy Bridge) or similar
            if "2000" in name or "3000" in name:
                caps["is_low_end"] = True
        elif "AMD" in name or "RADEON" in name:
            caps["vendor"] = "AMD"
            caps["decoder"] = "amf"
        
        caps["d3d11_supported"] = True
        caps["renderer"] = "DirectX11"
            
    return caps
