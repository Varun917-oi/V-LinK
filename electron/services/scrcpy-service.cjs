const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { timestampName } = require('./process-utils.cjs');

class ScrcpyService {
  constructor({ scrcpyPath, adb, folders, emit }) {
    this.scrcpyPath = scrcpyPath;
    this.adb = adb;
    this.folders = folders;
    this.emit = emit;
    this.sessions = new Map();
    this.recorders = new Map();
    this.metricsTimers = new Map();
    this.gpuInfo = { hasDedicated: false };
    this.detectHardware();
  }

  async detectHardware() {
    const { exec } = require('node:child_process');
    const cmd = 'powershell "Get-CimInstance Win32_VideoController | Select-Object Name, AdapterRAM | ConvertTo-Json"';
    exec(cmd, (error, stdout) => {
      if (!error && stdout) {
        try {
          const raw = JSON.parse(stdout);
          const data = Array.isArray(raw) ? raw : [raw];
          const dedicatedIdx = data.findIndex(item => /NVIDIA|AMD|Radeon/i.test(item.Name || ''));
          if (dedicatedIdx !== -1) {
            this.gpuInfo.hasDedicated = true;
            this.gpuInfo.dedicatedIndex = dedicatedIdx;
            const name = data[dedicatedIdx].Name || '';
            if (/NVIDIA/i.test(name)) this.gpuInfo.vendor = 'nvidia';
            else if (/AMD|Radeon/i.test(name)) this.gpuInfo.vendor = 'amd';
            this.log(`Dedicated GPU detected at index ${dedicatedIdx}: ${name} (${this.gpuInfo.vendor})`);
          } else {
            const intelIdx = data.findIndex(item => /Intel/i.test(item.Name || ''));
            if (intelIdx !== -1) this.gpuInfo.vendor = 'intel';
            this.log(`No dedicated GPU detected. Using integrated graphics: ${this.gpuInfo.vendor || 'unknown'}`);
          }
        } catch {}
      }
    });
  }

  ensureAvailable() {
    if (!fs.existsSync(this.scrcpyPath)) {
      throw new Error(`scrcpy.exe was not found at ${this.scrcpyPath}. Add the official free scrcpy Windows release to resources/bin/scrcpy before packaging.`);
    }
  }

  log(message, level = 'info') {
    this.emit('logs:changed', { level, message, at: new Date().toISOString() });
  }

  buildArgs(options, recordingFile) {
    const args = ['--serial', options.serial, '--window-title', `V-LinK - ${options.serial}`];
    if (options.lowEndMode) {
      args.push('--max-size', '720');
      args.push('--video-bit-rate', '2M');
      args.push('--max-fps', '30');
      args.push('--video-codec', 'h264');
      if (this.gpuInfo.vendor === 'intel') args.push('--video-encoder', 'OMX.intel.hw_encoder.h264'); // Prefer QuickSync on Intel
    } else {
      args.push('--max-size', String(options.maxSize ?? 1280));
      args.push('--video-bit-rate', `${options.bitrate ?? 8}M`);
      args.push('--max-fps', String(options.fps ?? 60));
      args.push('--video-codec', options.codec || 'h264');
      
      // Auto-select best hardware encoder based on GPU vendor
      if (this.gpuInfo.vendor === 'nvidia') {
        // NVENC is handled automatically by scrcpy/server, but we can hint preference
        // args.push('--video-encoder', 'OMX.nvidia.h264.encoder'); 
      }
    }

    if (this.gpuInfo.hasDedicated) {
      // Force high-performance rendering on dedicated GPUs
      args.push('--render-driver', 'direct3d');
    } else if (options.lowEndMode) {
      args.push('--render-driver', 'opengl');
    } else {
      args.push('--render-driver', 'direct3d');
    }

    args.push('--print-fps');
    args.push('--stay-awake');
    args.push('--power-off-on-close');
    
    if (options.control === false) args.push('--no-control');
    if (options.audio === false) {
      args.push('--no-audio');
    } else {
      args.push('--audio-source', options.audioSource || 'output');
      args.push('--audio-codec', options.audioCodec || 'opus');
      args.push('--audio-buffer', String(options.audioBuffer ?? 50));
    }
    if (options.turnScreenOff) args.push('--turn-screen-off');
    if (options.fullscreen) args.push('--fullscreen');
    if (recordingFile) args.push('--record', recordingFile);
    return args;
  }

  spawnOptions(visible) {
    const scrcpyDir = path.dirname(this.scrcpyPath);
    const env = {
      ...process.env,
      ADB: this.adb.adbPath,
      ANDROID_USER_HOME: this.adb.androidHome,
      ADB_VENDOR_KEYS: this.adb.androidHome,
      PATH: `${scrcpyDir};${path.dirname(this.adb.adbPath)};${process.env.PATH || ''}`
    };

    // Force dedicated GPU if detected
    if (this.gpuInfo.hasDedicated && this.gpuInfo.dedicatedIndex !== undefined) {
      env.DXGI_ADAPTER_INDEX = String(this.gpuInfo.dedicatedIndex);
      // For NVIDIA specifically
      env.SHIM_MCCOMPAT = '0x800000001'; 
    }

    return {
      cwd: scrcpyDir,
      windowsHide: !visible,
      shell: false,
      env
    };
  }

  startMetrics(serial, startedAt) {
    clearInterval(this.metricsTimers.get(serial));
    this.metricsTimers.set(serial, setInterval(() => {
      const session = this.sessions.get(serial);
      if (!session) return;
      const age = Math.max(1, Math.round((Date.now() - startedAt) / 1000));
      this.emit('metrics:changed', {
        serial,
        fps: session.fps,
        latency: session.latency,
        uptimeSeconds: age,
        bitrate: session.bitrate,
        connected: true
      });
    }, 1000));
  }

  start(options) {
    this.ensureAvailable();
    if (this.sessions.has(options.serial)) return { ok: true, running: true };
    const args = this.buildArgs(options);
    let output = '';
    const child = spawn(this.scrcpyPath, args, this.spawnOptions(true));
    const startedAt = Date.now();
    const session = {
      serial: options.serial,
      child,
      options,
      fps: options.fps ?? 60,
      bitrate: options.bitrate ?? 8,
      latency: options.maxSize && options.maxSize <= 1024 ? 24 : 38,
      startedAt,
      readyTimer: null
    };
    this.sessions.set(options.serial, session);
    this.startMetrics(options.serial, startedAt);
    this.emit('mirror:status', { serial: options.serial, state: 'starting' });
    session.readyTimer = setTimeout(() => {
      if (!this.sessions.has(options.serial)) return;
      this.log(`Mirror is running for ${options.serial}`);
      this.emit('mirror:status', { serial: options.serial, state: 'running' });
    }, 1200);
    child.stderr?.on('data', (data) => {
      const text = data.toString().trim();
      output += `${text}\n`;
      if (text) this.log(text);
    });
    child.stdout?.on('data', (data) => {
      const text = data.toString().trim();
      output += `${text}\n`;
      const fpsMatch = text.match(/fps[:=\s]+(\d+(?:\.\d+)?)/i) || text.match(/(\d+(?:\.\d+)?)\s+fps/i);
      if (fpsMatch && this.sessions.has(options.serial)) {
        session.fps = Math.round(Number(fpsMatch[1]));
        this.emit('metrics:changed', {
          serial: options.serial,
          fps: session.fps,
          latency: session.latency,
          uptimeSeconds: Math.max(1, Math.round((Date.now() - startedAt) / 1000)),
          bitrate: session.bitrate,
          connected: true
        });
      }
      if (text) this.log(text);
    });
    child.on('error', (error) => {
      clearTimeout(session.readyTimer);
      this.sessions.delete(options.serial);
      this.log(error.message, 'error');
      this.emit('mirror:status', { serial: options.serial, state: 'error', error: error.message });
    });
    child.on('close', (code) => {
      clearTimeout(session.readyTimer);
      this.sessions.delete(options.serial);
      clearInterval(this.metricsTimers.get(options.serial));
      const failedFast = Date.now() - startedAt < 2000 && code !== 0;
      this.emit('mirror:status', {
        serial: options.serial,
        state: failedFast ? 'error' : 'stopped',
        code,
        error: failedFast ? output.trim() || `scrcpy exited with code ${code}` : undefined
      });
      if (session.options.autoReconnect && !session.intentionalStop) {
        this.log(`Auto reconnect queued for ${options.serial}`);
        setTimeout(() => {
          if (!this.sessions.has(options.serial)) this.start(session.options);
        }, 1800);
      }
    });
    this.log(`Starting mirror for ${options.serial}`);
    return { ok: true };
  }

  stop(serial) {
    const session = this.sessions.get(serial);
    if (!session) return { ok: true, running: false };
    session.intentionalStop = true;
    session.child.kill();
    this.sessions.delete(serial);
    clearInterval(this.metricsTimers.get(serial));
    return { ok: true };
  }

  restart(serial, options) {
    const previous = this.sessions.get(serial);
    if (previous) {
      previous.intentionalStop = true;
      previous.child.kill();
      this.sessions.delete(serial);
      clearInterval(this.metricsTimers.get(serial));
    }
    return this.start({ ...options, serial });
  }

  fullscreen(serial) {
    this.stop(serial);
    return { ok: true, message: 'Restart mirror with fullscreen enabled from the toolbar.' };
  }

  startRecording(options) {
    this.ensureAvailable();
    fs.mkdirSync(this.folders.recordings, { recursive: true });
    if (this.recorders.has(options.serial)) return { ok: true, running: true };
    const filePath = path.join(this.folders.recordings, timestampName(`recording-${options.serial.replace(/[:.]/g, '-')}`, 'mp4'));
    const args = this.buildArgs({ ...options, fullscreen: false }, filePath);
    const child = spawn(this.scrcpyPath, args, this.spawnOptions(false));
    this.recorders.set(options.serial, { child, filePath });
    this.emit('recording:changed', { serial: options.serial, state: 'recording', filePath });
    child.on('close', () => {
      this.recorders.delete(options.serial);
      this.emit('recording:changed', { serial: options.serial, state: 'saved', filePath });
    });
    return { ok: true, filePath };
  }

  stopRecording(serial) {
    const recorder = this.recorders.get(serial);
    if (!recorder) return { ok: true, running: false };
    recorder.child.kill();
    return { ok: true, filePath: recorder.filePath };
  }

  listRecordings() {
    fs.mkdirSync(this.folders.recordings, { recursive: true });
    return fs.readdirSync(this.folders.recordings)
      .filter((name) => name.toLowerCase().endsWith('.mp4'))
      .map((name) => {
        const filePath = path.join(this.folders.recordings, name);
        const stat = fs.statSync(filePath);
        return { name, filePath, size: stat.size, createdAt: stat.birthtime.toISOString() };
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async control({ serial, action, text }) {
    const keycodes = { home: 3, back: 4, recent: 187, power: 26, volumeUp: 24, volumeDown: 25 };
    if (action === 'type') return this.adb.adb(['-s', serial, 'shell', 'input', 'text', text.replace(/\s/g, '%s')]);
    if (action === 'key' && keycodes[text]) return this.adb.adb(['-s', serial, 'shell', 'input', 'keyevent', String(keycodes[text])]);
    return { ok: false, stderr: 'Unsupported control command' };
  }
}

module.exports = { ScrcpyService };
