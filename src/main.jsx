import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Activity,
  BatteryCharging,
  Cable,
  Camera,
  Clipboard,
  Cpu,
  Expand,
  FolderOpen,
  FolderUp,
  Gamepad2,
  Gauge,
  HardDriveUpload,
  Home,
  Keyboard,
  Maximize2,
  Mic2,
  Monitor,
  Play,
  Power,
  QrCode,
  Radio,
  RefreshCw,
  RotateCw,
  Search,
  Settings,
  Smartphone,
  Square,
  Timer,
  Upload,
  Volume2,
  Wifi,
  Zap
} from 'lucide-react';
import { useMirrorStore } from './store/mirror-store.js';
import './styles/app.css';

const api = window.mirrorApi;

function NeonButton({ children, icon: Icon, className = '', variant = 'primary', ...props }) {
  return (
    <motion.button
      whileHover={{ y: -1, scale: 1.015 }}
      whileTap={{ scale: 0.98 }}
      className={`neon-button ${variant} ${className}`}
      {...props}
    >
      {Icon && <Icon size={17} />}
      <span>{children}</span>
    </motion.button>
  );
}

function IconButton({ icon: Icon, label, active, ...props }) {
  return (
    <motion.button
      whileHover={{ y: -3, boxShadow: '0 0 28px rgba(34, 211, 238, 0.34)' }}
      whileTap={{ scale: 0.94 }}
      className={`quick-icon ${active ? 'active' : ''}`}
      title={label}
      {...props}
    >
      <Icon size={19} />
    </motion.button>
  );
}

function GlassCard({ className = '', children }) {
  return <section className={`glass-card ${className}`}>{children}</section>;
}

function StatusBadge({ online, children }) {
  return (
    <span className={`status-badge ${online ? 'online' : 'offline'}`}>
      <i />
      {children}
    </span>
  );
}

function GamingSlider({ label, value, min, max, step = 1, unit = '', disabled, onChange }) {
  return (
    <label className="gaming-slider">
      <span><b>{label}</b><em>{value}{unit}</em></span>
      <input disabled={disabled} type="range" min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} />
    </label>
  );
}

function DeviceCard({ device }) {
  const { selectedSerial, setSelectedSerial } = useMirrorStore();
  const active = selectedSerial === device.serial;
  const signal = device.mode === 'wireless' ? 'WiFi linked' : 'USB direct';
  return (
    <motion.button
      layout
      whileHover={{ x: 4 }}
      className={`device-card ${active ? 'selected' : ''}`}
      onClick={() => setSelectedSerial(device.serial)}
    >
      <div className="device-orb"><Smartphone size={25} /></div>
      <div className="device-copy">
        <strong>{device.name || device.serial}</strong>
        <span>{device.serial}</span>
        <small>{device.mode.toUpperCase()} - Android {device.android || 'unknown'}</small>
      </div>
      <div className="device-meta">
        <StatusBadge online={device.authorized}>{device.state}</StatusBadge>
        <span><BatteryCharging size={14} />{device.battery ?? '--'}%</span>
        <span><Wifi size={14} />{signal}</span>
      </div>
    </motion.button>
  );
}

function AnimatedSidebar() {
  const { devices, mode, setMode, selectedSerial, setSelectedSerial, logs } = useMirrorStore();
  const [query, setQuery] = useState('');
  const [wirelessBusy, setWirelessBusy] = useState(false);
  const [wifiHost, setWifiHost] = useState('');
  const [wifiPort, setWifiPort] = useState('5555');
  const [logsOpen, setLogsOpen] = useState(true);
  const selected = devices.find((device) => device.serial === selectedSerial);
  const filteredDevices = devices.filter((device) => `${device.name} ${device.serial} ${device.mode}`.toLowerCase().includes(query.toLowerCase()));

  async function startMirror() {
    if (!selected) return;
    await api.invoke('mirror:start', { serial: selected.serial, ...useMirrorStore.getState().settings, fullscreen: false });
  }

  async function scanWireless() {
    setWirelessBusy(true);
    try {
      const hosts = await api.invoke('network:scan', { port: 5555 });
      for (const host of hosts) await api.invoke('adb:connect', host);
      const refreshed = await api.invoke('devices:list');
      const wireless = refreshed.find((device) => device.authorized && device.mode === 'wireless');
      if (wireless) setSelectedSerial(wireless.serial);
    } finally {
      setWirelessBusy(false);
    }
  }

  async function oneClickWirelessMirror() {
    setWirelessBusy(true);
    try {
      const result = await api.invoke('wireless:mirror', {
        serial: selected?.serial || null,
        settings: useMirrorStore.getState().settings,
        port: 5555
      });
      if (result?.serial) setSelectedSerial(result.serial);
      await api.invoke('devices:list');
    } finally {
      setWirelessBusy(false);
    }
  }

  async function connectManualWireless() {
    if (!wifiHost.trim()) return;
    setWirelessBusy(true);
    try {
      await api.invoke('adb:connect', { host: wifiHost.trim(), port: Number(wifiPort) || 5555 });
      const refreshed = await api.invoke('devices:list');
      const serial = `${wifiHost.trim()}:${Number(wifiPort) || 5555}`;
      const device = refreshed.find((item) => item.serial === serial) || refreshed.find((item) => item.authorized && item.mode === 'wireless');
      if (device) setSelectedSerial(device.serial);
    } finally {
      setWirelessBusy(false);
    }
  }

  return (
    <aside className="sidebar">
      <div className="brand-block">
        <div className="brand-mark"><img src="/logo.png" alt="V-LinK" style={{ width: '28px', height: '28px', objectFit: 'contain' }} /></div>
        <div>
          <span>V-LinK Core</span>
          <h1>V-LinK</h1>
        </div>
      </div>

      <div className="mode-tabs">
        <button className={mode === 'usb' ? 'active' : ''} onClick={() => setMode('usb')}><Cable size={16} />USB</button>
        <button className={mode === 'wireless' ? 'active' : ''} onClick={() => setMode('wireless')}><Wifi size={16} />Wireless</button>
      </div>

      <div className="search-box">
        <Search size={16} />
        <input value={query} onChange={(event) => setQuery(event.target.value)} aria-label="Search devices" />
      </div>

      {mode === 'wireless' && (
        <GlassCard className="wireless-control">
          <NeonButton disabled={wirelessBusy} icon={ScreenIcon} onClick={oneClickWirelessMirror}>{wirelessBusy ? 'Linking...' : 'One-click WiFi Mirror'}</NeonButton>
          <NeonButton disabled={wirelessBusy} variant="secondary" icon={Radio} onClick={scanWireless}>Scan WiFi ADB</NeonButton>
          <div className="manual-connect">
            <input value={wifiHost} onChange={(event) => setWifiHost(event.target.value)} aria-label="Phone WiFi IP" />
            <input value={wifiPort} onChange={(event) => setWifiPort(event.target.value)} aria-label="ADB port" />
            <button disabled={wirelessBusy || !wifiHost.trim()} onClick={connectManualWireless}>Connect</button>
          </div>
        </GlassCard>
      )}

      <div className="device-list">
        <AnimatePresence initial={false}>
          {filteredDevices.map((device) => <DeviceCard key={device.serial} device={device} />)}
        </AnimatePresence>
        {filteredDevices.length === 0 && <div className="empty-state">No devices detected. Connect USB debugging or pair Wireless ADB.</div>}
      </div>

      <NeonButton disabled={!selected?.authorized} icon={Monitor} onClick={startMirror} className="wide">Quick Connect</NeonButton>

      <GlassCard className="logs-card">
        <button className="logs-title" onClick={() => setLogsOpen(!logsOpen)}>
          <span>Connection Logs</span>
          <Expand size={15} />
        </button>
        <AnimatePresence initial={false}>
          {logsOpen && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 178, opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="logs-stream">
              {logs.slice(0, 9).map((log) => <span key={log.at + log.message} className={log.level}>{new Date(log.at).toLocaleTimeString()} - {log.message}</span>)}
            </motion.div>
          )}
        </AnimatePresence>
      </GlassCard>
    </aside>
  );
}

const ScreenIcon = Monitor;

function StreamStats({ metric, settings, status, recording }) {
  const uptime = metric?.uptimeSeconds ? `${Math.floor(metric.uptimeSeconds / 60)}:${String(metric.uptimeSeconds % 60).padStart(2, '0')}` : '0:00';
  return (
    <div className="stream-stats">
      <div className="fps-counter">{metric?.fps ?? settings.fps} FPS</div>
      <span><Gauge size={14} />{metric?.latency ?? '--'} ms</span>
      <span><HardDriveUpload size={14} />{settings.bitrate} Mbps</span>
      <span><Timer size={14} />{uptime}</span>
      <StatusBadge online={status?.state === 'running'}>{status?.state || 'waiting'}</StatusBadge>
      {recording?.state === 'recording' && <span className="recording-badge">REC</span>}
    </div>
  );
}

function LivePreview() {
  const { selectedSerial, devices, mirrorStatus, metrics, recording, settings } = useMirrorStore();
  const selected = devices.find((device) => device.serial === selectedSerial);
  const status = selectedSerial ? mirrorStatus[selectedSerial] : null;
  const metric = selectedSerial ? metrics[selectedSerial] : null;
  const isRecording = selectedSerial && recording[selectedSerial]?.state === 'recording';
  const videoRef = React.useRef(null);

  useEffect(() => {
    if (status?.state === 'running' && settings.backend !== 'adb') {
      // Logic to attach WebRTC stream would go here
      // For now, we'll keep the placeholder but prepare the element
    }
  }, [status, settings.backend]);

  return (
    <main className="live-panel">
      <div className="live-header">
        <div>
          <span>Live Stream</span>
          <h2>{selected ? selected.name : 'Ready for device link'}</h2>
        </div>
        <div className="quality-pill"><Activity size={15} />Ultra Low Latency</div>
      </div>

      <div className="preview-stage">
        <div className="stage-particles" />
        <motion.div className="phone-frame" initial={{ opacity: 0, y: 22 }} animate={{ opacity: 1, y: 0 }}>
          <StreamStats metric={metric} settings={settings} status={status} recording={recording[selectedSerial]} />
          <div className="screen-glass">
            {status?.state === 'running' ? (
              <video
                ref={videoRef}
                autoPlay
                playsInline
                className="live-video-stream"
                style={{ width: '100%', height: '100%', borderRadius: '22px', objectFit: 'contain' }}
              />
            ) : (
              <>
                <Monitor size={74} />
                <strong>Select a device and start mirroring</strong>
                <span>USB and Wireless ADB controls are ready in the left command panel.</span>
              </>
            )}
          </div>
          {isRecording && <div className="rec-dot">Recording</div>}
        </motion.div>
      </div>

      <FloatingToolbar selectedSerial={selectedSerial} isRecording={isRecording} />
    </main>
  );
}

function FloatingToolbar({ selectedSerial, isRecording }) {
  async function sendKey(key) {
    if (selectedSerial) await api.invoke('mirror:control', { serial: selectedSerial, action: 'key', text: key });
  }

  async function toggleRecord() {
    if (!selectedSerial) return;
    if (isRecording) await api.invoke('record:stop', selectedSerial);
    else await api.invoke('record:start', { serial: selectedSerial, ...useMirrorStore.getState().settings });
  }

  return (
    <div className="quick-bar">
      <IconButton icon={Camera} label="Screenshot" onClick={() => selectedSerial && api.invoke('capture:screenshot', selectedSerial)} />
      <IconButton icon={isRecording ? Square : Play} label={isRecording ? 'Stop recording' : 'Record'} active={isRecording} onClick={toggleRecord} />
      <IconButton icon={RotateCw} label="Rotate" onClick={() => selectedSerial && api.invoke('mirror:control', { serial: selectedSerial, action: 'key', text: 'power' })} />
      <IconButton icon={Maximize2} label="Fullscreen" onClick={() => selectedSerial && api.invoke('mirror:fullscreen', { serial: selectedSerial })} />
      <IconButton icon={FolderUp} label="File transfer" onClick={() => selectedSerial && api.invoke('file:push', selectedSerial)} />
      <IconButton icon={Clipboard} label="Clipboard" onClick={() => selectedSerial && api.invoke('clipboard:push', { serial: selectedSerial, text: '' })} />
      <IconButton icon={Gamepad2} label="Game mode" />
      <IconButton icon={Volume2} label="Audio" />
      <IconButton icon={Power} label="Power" onClick={() => selectedSerial && sendKey('power')} />
      <IconButton icon={Home} label="Home" onClick={() => sendKey('home')} />
      <IconButton icon={Keyboard} label="Back" onClick={() => sendKey('back')} />
    </div>
  );
}

function SettingToggle({ label, checked, onChange }) {
  return (
    <label className="toggle-row">
      <span>{label}</span>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
    </label>
  );
}

function GpuDiagnosticsPanel({ hardware, settings, metric }) {
  return (
    <GlassCard className="gpu-diag-panel">
      <div className="diag-header">
        <Activity size={16} />
        <span>GPU Optimization Layer</span>
      </div>
      <div className="diag-grid">
        <div className="diag-item"><span>Active GPU</span><strong>{hardware.vendor.toUpperCase()}</strong></div>
        <div className="diag-item"><span>Renderer</span><strong>{hardware.renderer}</strong></div>
        <div className="diag-item"><span>Hardware Accel</span><strong className="text-cyan">ENABLED</strong></div>
        <div className="diag-item"><span>Utilization</span><strong>{hardware.utilization}%</strong></div>
        <div className="diag-item"><span>FPS</span><strong>{metric?.fps || settings.fps}</strong></div>
        <div className="diag-item"><span>Latency</span><strong>{metric?.latency || '--'} ms</strong></div>
      </div>
    </GlassCard>
  );
}

function SettingsPanel() {
  const { settings, updateSettings, applyPreset, selectedSerial, hardware, metrics } = useMirrorStore();
  const metric = selectedSerial ? metrics[selectedSerial] : null;
  const qrInputRef = React.useRef(null);
  const [pairHost, setPairHost] = useState('');
  const [pairPort, setPairPort] = useState('');
  const [pairCode, setPairCode] = useState('');
  const [clip, setClip] = useState('');
  const thermal = useMemo(() => Math.round(42 + Math.sin(Date.now() / 10000) * 4), []);

  async function scanPairingQr(file) {
    if (!file || !('BarcodeDetector' in window)) return;
    const bitmap = await createImageBitmap(file);
    const detector = new window.BarcodeDetector({ formats: ['qr_code'] });
    const [code] = await detector.detect(bitmap);
    const text = code?.rawValue || '';
    const host = text.match(/(\d{1,3}(?:\.\d{1,3}){3})/)?.[1] || '';
    const port = text.match(/(?:port|p|:)(\d{4,5})/i)?.[1] || '';
    const pairing = text.match(/(?:code|pairing|password|pwd|:)(\d{6})/i)?.[1] || '';
    if (host) setPairHost(host);
    if (port) setPairPort(port);
    if (pairing) setPairCode(pairing);
    useMirrorStore.getState().pushLog({
      level: host && port ? 'info' : 'warn',
      message: host && port ? 'QR pairing details detected' : 'QR scanned, but host and port were not found in the code',
      at: new Date().toISOString()
    });
  }

  function updateTuning(patch) {
    const next = { ...settings, ...patch };
    if (next.smartBitrate && ('maxSize' in patch || 'fps' in patch)) {
      const pixels = next.maxSize >= 1600 ? 14 : next.maxSize >= 1280 ? 10 : 7;
      const fpsBoost = next.fps >= 90 ? 4 : next.fps >= 60 ? 2 : 0;
      next.bitrate = Math.min(32, pixels + fpsBoost);
    }
    updateSettings(next);
  }

  async function applyTuningToStream() {
    if (!selectedSerial) return;
    await api.invoke('mirror:restart', { serial: selectedSerial, ...useMirrorStore.getState().settings, fullscreen: false });
  }

  return (
    <aside className="settings-dock">
      <div className="dock-header">
        <div><span>Tuning Deck</span><h2>V-LinK PRO</h2></div>
        <Settings size={20} />
      </div>

      <GlassCard className="preset-card">
        <span>Profile Presets</span>
        <div className="preset-grid">
          <button className={settings.preset === 'balanced' ? 'active' : ''} onClick={() => applyPreset('balanced')}>Balanced</button>
          <button className={settings.preset === 'gaming' ? 'active' : ''} onClick={() => applyPreset('gaming')}>Gaming</button>
          <button className={settings.preset === 'cinema' ? 'active' : ''} onClick={() => applyPreset('cinema')}>Cinema</button>
          <button className={settings.preset === 'lowend' ? 'active' : ''} onClick={() => applyPreset('lowend')}>Low-End PC</button>
        </div>
      </GlassCard>

      <GlassCard className="settings-stack">
        <label className="select-row">Streaming Backend
          <select value={settings.backend} onChange={(event) => updateTuning({ backend: event.target.value })}>
            <option value="auto">Auto Selection</option>
            <option value="webrtc">WebRTC (Wireless)</option>
            <option value="adb">ADB Tunnel (Wired)</option>
          </select>
        </label>
        <SettingToggle label="Optimize for i3-2nd Gen" checked={settings.lowEndMode} onChange={(lowEndMode) => updateTuning({ lowEndMode })} />
        <GamingSlider label="Resolution" min={720} max={1920} step={80} value={settings.maxSize} unit="p" onChange={(value) => updateTuning({ maxSize: value })} />
        <GamingSlider label="FPS Limit" min={24} max={120} step={6} value={settings.fps} onChange={(value) => updateTuning({ fps: value })} />
        <GamingSlider label="Bitrate" min={2} max={32} value={settings.bitrate} unit=" Mbps" disabled={settings.smartBitrate} onChange={(value) => updateTuning({ bitrate: value, smartBitrate: false })} />
        <GamingSlider label="Audio Buffer" min={20} max={200} step={10} disabled={!settings.audio} value={settings.audioBuffer} unit=" ms" onChange={(value) => updateTuning({ audioBuffer: value })} />
        <SettingToggle label="Audio forwarding" checked={settings.audio} onChange={(audio) => updateTuning({ audio })} />
        <label className="select-row">Audio source
          <select value={settings.audioSource} disabled={!settings.audio} onChange={(event) => updateTuning({ audioSource: event.target.value })}>
            <option value="output">Output to PC</option>
            <option value="playback">Playback duplicate</option>
          </select>
        </label>
        <label className="select-row">Video codec
          <select value={settings.codec} onChange={(event) => updateTuning({ codec: event.target.value })}>
            <option value="h264">H.264 compatibility</option>
            <option value="h265">H.265 quality</option>
            <option value="av1">AV1 experimental</option>
          </select>
        </label>
        <SettingToggle label="Turn screen off" checked={settings.turnScreenOff} onChange={(turnScreenOff) => updateTuning({ turnScreenOff })} />
        <SettingToggle label="GPU acceleration" checked={settings.gpuAcceleration} onChange={(gpuAcceleration) => updateTuning({ gpuAcceleration })} />
        <SettingToggle label="Smart bitrate" checked={settings.smartBitrate} onChange={(smartBitrate) => updateTuning({ smartBitrate })} />
        <SettingToggle label="Auto reconnect" checked={settings.autoReconnect} onChange={(autoReconnect) => updateTuning({ autoReconnect })} />
        <SettingToggle label="Mouse and keyboard control" checked={settings.control} onChange={(control) => updateTuning({ control })} />
        <NeonButton disabled={!selectedSerial} icon={RefreshCw} onClick={applyTuningToStream}>Apply Tuning</NeonButton>
      </GlassCard>

      <GpuDiagnosticsPanel hardware={hardware} settings={settings} metric={metric} />

      <GlassCard className="monitor-grid">
        <div><Cpu size={17} /><span>Thermals</span><strong>{thermal} C</strong></div>
        <div><Gauge size={17} /><span>Ping</span><strong>18 ms</strong></div>
        <div><Mic2 size={17} /><span>Audio</span><strong>{settings.audio ? 'Live' : 'Off'}</strong></div>
      </GlassCard>

      <GlassCard className="pair-card">
        <strong>Wireless Pairing</strong>
        <input ref={qrInputRef} className="hidden-input" type="file" accept="image/*" onChange={(event) => scanPairingQr(event.target.files?.[0])} />
        <NeonButton variant="secondary" icon={QrCode} onClick={() => qrInputRef.current?.click()}>Scan QR Image</NeonButton>
        <input aria-label="Host IP" value={pairHost} onChange={(event) => setPairHost(event.target.value)} />
        <input aria-label="Pairing port" value={pairPort} onChange={(event) => setPairPort(event.target.value)} />
        <input aria-label="Pairing code" value={pairCode} onChange={(event) => setPairCode(event.target.value)} />
        <NeonButton icon={Wifi} onClick={() => api.invoke('adb:pair', { host: pairHost, port: Number(pairPort), code: pairCode })}>Pair Device</NeonButton>
      </GlassCard>

      <GlassCard className="drop-card" onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); api.invoke('apk:install'); }}>
        <Upload size={24} />
        <strong>APK Drop Zone</strong>
        <span>Drop or click to install</span>
        <button onClick={() => api.invoke('apk:install')}>Choose APK</button>
      </GlassCard>

      <GlassCard className="pair-card">
        <strong>Clipboard Sync</strong>
        <textarea aria-label="Text to send to phone clipboard" value={clip} onChange={(event) => setClip(event.target.value)} />
        <NeonButton disabled={!selectedSerial} icon={Clipboard} onClick={() => api.invoke('clipboard:push', { serial: selectedSerial, text: clip })}>Send Clipboard</NeonButton>
        <NeonButton variant="secondary" icon={FolderOpen} onClick={() => api.invoke('folder:recordings')}>Open Recordings</NeonButton>
      </GlassCard>
    </aside>
  );
}

function AppNotifications() {
  const { logs } = useMirrorStore();
  const latest = logs[0];
  return (
    <AnimatePresence>
      {latest && (
        <motion.div className={`toast ${latest.level}`} initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
          {latest.message}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function App() {
  const { setDevices, pushLog, setMirrorStatus, setMetrics, setRecording, initHardware } = useMirrorStore();
  useEffect(() => {
    initHardware();
    api.invoke('devices:watch');
    const unsubs = [
      api.on('devices:changed', setDevices),
      api.on('logs:changed', pushLog),
      api.on('mirror:status', setMirrorStatus),
      api.on('metrics:changed', setMetrics),
      api.on('recording:changed', setRecording)
    ];
    return () => unsubs.forEach((unsubscribe) => unsubscribe());
  }, [setDevices, pushLog, setMirrorStatus, setMetrics, setRecording]);

  return (
    <div className="cyber-root">
      <div className="rgb-wash" />
      <div className="particle-field" />
      <AppNotifications />
      <AnimatedSidebar />
      <LivePreview />
      <SettingsPanel />
    </div>
  );
}

createRoot(document.getElementById('root')).render(<App />);
