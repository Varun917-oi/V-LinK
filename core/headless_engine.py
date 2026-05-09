import sys
import json
import argparse
from core.mirror_engine import MirrorEngine
from core.adb_manager import ADBManager

def main():
    parser = argparse.ArgumentParser(description='Headless Mirror Engine')
    parser.add_argument('--serial', required=True, help='Device serial')
    parser.add_argument('--bitrate', type=int, default=8000000)
    parser.add_argument('--fps', type=int, default=60)
    parser.add_argument('--max-size', type=int, default=1280)
    parser.add_argument('--backend', default='auto')
    parser.add_argument('--gpu-pref', default='auto')
    parser.add_argument('--low-end', action='store_true')
    
    args = parser.parse_args()
    
    adb = ADBManager()
    engine = MirrorEngine(adb, args.serial)
    
    config = {
        "bitrate": args.bitrate,
        "fps": args.fps,
        "max_size": args.max_size,
        "backend": args.backend,
        "gpu_pref": args.gpu_pref,
        "low_end": args.low_end
    }
    
    print(f"Starting engine for {args.serial} with config: {json.dumps(config)}")
    engine.start(config)
    
    # Keep alive
    try:
        while True:
            import time
            time.sleep(1)
    except KeyboardInterrupt:
        engine.stop()

if __name__ == "__main__":
    main()
