import { create } from 'zustand';

export const useMirrorStore = create((set) => ({
  devices: [],
  selectedSerial: null,
  mode: 'usb',
  logs: [],
  mirrorStatus: {},
  metrics: {},
  recording: {},
  hardware: {
    hasDedicatedGpu: true,
    isLegacyCpu: false,
    cpuModel: '',
    detected: false,
    vendor: 'auto',
    renderer: 'DirectX 11',
    utilization: 0
  },
  settings: {
    maxSize: 1280,
    fps: 60,
    bitrate: 8,
    codec: 'h264',
    audio: true,
    audioSource: 'output',
    audioCodec: 'opus',
    audioBuffer: 50,
    turnScreenOff: false,
    gpuAcceleration: true,
    smartBitrate: true,
    autoReconnect: true,
    control: true,
    preset: 'gaming',
    backend: 'auto',
    lowEndMode: false
  },
  setDevices: (devices) => set((state) => ({
    devices,
    selectedSerial: state.selectedSerial || devices.find((device) => device.authorized)?.serial || null
  })),
  setSelectedSerial: (selectedSerial) => set({ selectedSerial }),
  setMode: (mode) => set({ mode }),
  pushLog: (log) => set((state) => ({ logs: [log, ...state.logs].slice(0, 80) })),
  setMirrorStatus: (status) => set((state) => ({ mirrorStatus: { ...state.mirrorStatus, [status.serial]: status } })),
  setMetrics: (metric) => set((state) => {
    if (!metric.serial) return state;
    return { metrics: { ...state.metrics, [metric.serial]: metric } };
  }),
  setRecording: (record) => set((state) => ({ recording: { ...state.recording, [record.serial]: record } })),
  initHardware: async () => {
    const info = await window.mirrorApi.invoke('system:info');
    set({
      hardware: {
        hasDedicatedGpu: info.gpu.hasDedicated,
        isLegacyCpu: info.cpu.isLegacy,
        cpuModel: info.cpu.model,
        vendor: info.gpu.vendor || 'auto',
        renderer: info.gpu.hasDedicated ? 'DirectX 11 (Dedicated)' : 'OpenGL (Integrated)',
        utilization: Math.round(5 + Math.random() * 15), // Mock utilization for display
        detected: true
      }
    });
  },
  updateSettings: (patch) => set((state) => ({ settings: { ...state.settings, ...patch } })),
  applyPreset: (preset) => set((state) => {
    const presets = {
      balanced: { maxSize: 1280, fps: 60, bitrate: 8, audioBuffer: 50, codec: 'h264', lowEndMode: false },
      gaming: { maxSize: 1024, fps: 90, bitrate: 12, audioBuffer: 30, codec: 'h264', lowEndMode: false },
      cinema: { maxSize: 1920, fps: 60, bitrate: 18, audioBuffer: 90, codec: 'h265', lowEndMode: false },
      lowend: { maxSize: 720, fps: 60, bitrate: 4, audioBuffer: 60, codec: 'h264', lowEndMode: true }
    };
    return { settings: { ...state.settings, ...(presets[preset] || presets.gaming), preset } };
  })
}));
