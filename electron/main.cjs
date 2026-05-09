const { app, BrowserWindow, ipcMain, dialog, nativeTheme, shell, Tray, Menu, nativeImage } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const { AdbService } = require('./services/adb-service.cjs');
const { ScrcpyService } = require('./services/scrcpy-service.cjs');
const { NetworkService } = require('./services/network-service.cjs');
const { SystemService } = require('./services/system-service.cjs');
const { createIpcHandlers } = require('./ipc/handlers.cjs');

const isDev = Boolean(process.env.VITE_DEV_SERVER_URL);
let mainWindow;
let tray;
const startupLog = path.join(__dirname, '..', '.runtime', 'main.log');

function debugLog(message) {
  try {
    fs.mkdirSync(path.dirname(startupLog), { recursive: true });
    fs.appendFileSync(startupLog, `${new Date().toISOString()} ${message}\n`);
  } catch {
  }
}

debugLog('main module loaded');

// Advanced GPU Optimization Layer
app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('enable-zero-copy');
app.commandLine.appendSwitch('ignore-gpu-blocklist');
app.commandLine.appendSwitch('enable-native-gpu-memory-buffers');
app.commandLine.appendSwitch('enable-accelerated-video-decode');
app.commandLine.appendSwitch('enable-accelerated-mjpeg-decode');
app.commandLine.appendSwitch('gpu-rasterization-msaa-sample-count', '0');
app.commandLine.appendSwitch('use-gl', 'desktop'); // Favor native GPU drivers over ANGLE software fallback
app.commandLine.appendSwitch('force_high_performance_gpu'); // Electron hint for dedicated GPU

process.on('uncaughtException', (error) => debugLog(`uncaughtException ${error.stack || error.message}`));
process.on('unhandledRejection', (error) => debugLog(`unhandledRejection ${error?.stack || error}`));
app.on('ready', () => debugLog('ready event'));
app.on('will-quit', () => debugLog('will-quit'));
app.on('quit', (_event, code) => debugLog(`quit ${code}`));

function resolveResourcePath(...segments) {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, ...segments);
  }
  return path.join(__dirname, '..', 'resources', ...segments);
}

function createMainWindow() {
  debugLog('creating main window');
  mainWindow = new BrowserWindow({
    width: 1360,
    height: 860,
    minWidth: 1120,
    minHeight: 720,
    title: 'V-LinK',
    backgroundColor: '#050816',
    icon: path.join(__dirname, '..', 'public', 'logo.png'),
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  mainWindow.once('ready-to-show', () => {
    debugLog('window ready to show');
    mainWindow.show();
  });
  mainWindow.webContents.on('did-fail-load', (_event, code, description) => debugLog(`did-fail-load ${code} ${description}`));
  mainWindow.webContents.on('render-process-gone', (_event, details) => debugLog(`render-process-gone ${JSON.stringify(details)}`));
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (!input.control) return;
    const key = input.key === '=' ? '+' : input.key;
    if (!['+', '-', '0'].includes(key)) return;
    event.preventDefault();
    const current = mainWindow.webContents.getZoomFactor();
    const next = key === '0' ? 1 : Math.max(0.7, Math.min(1.45, current + (key === '+' ? 0.08 : -0.08)));
    mainWindow.webContents.setZoomFactor(next);
    mainWindow.webContents.send('logs:changed', {
      level: 'info',
      message: `UI scale set to ${Math.round(next * 100)}%`,
      at: new Date().toISOString()
    });
  });

  if (isDev) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function ensureAppFolders() {
  const portableRuntime = path.join(__dirname, '..', '.runtime');
  let runtimeRoot = app.isPackaged ? app.getPath('userData') : portableRuntime;
  const fallbackRecordings = path.join(portableRuntime, 'recordings');
  const fallbackScreenshots = path.join(portableRuntime, 'screenshots');
  let recordings = path.join(app.getPath('videos'), 'V-LinK');
  let screenshots = path.join(app.getPath('pictures'), 'V-LinK');
  const androidHome = path.join(runtimeRoot, 'android-adb');
  try {
    fs.mkdirSync(androidHome, { recursive: true });
  } catch {
    runtimeRoot = portableRuntime;
  }
  const resolvedAndroidHome = path.join(runtimeRoot, 'android-adb');
  try {
    fs.mkdirSync(recordings, { recursive: true });
  } catch {
    recordings = fallbackRecordings;
  }
  try {
    fs.mkdirSync(screenshots, { recursive: true });
  } catch {
    screenshots = fallbackScreenshots;
  }
  fs.mkdirSync(recordings, { recursive: true });
  fs.mkdirSync(screenshots, { recursive: true });
  fs.mkdirSync(resolvedAndroidHome, { recursive: true });
  return { recordings, screenshots, androidHome: resolvedAndroidHome };
}

function createTray() {
  const trayIconPath = resolveResourcePath('..', 'public', 'logo.png');
  const trayIcon = nativeImage.createFromPath(trayIconPath).resize({ width: 16, height: 16 });
  tray = new Tray(trayIcon);
  tray.setToolTip('V-LinK');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Show V-LinK', click: () => mainWindow?.show() },
    { label: 'Open Recordings', click: () => shell.openPath(ensureAppFolders().recordings) },
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() }
  ]));
}

app.whenReady().then(() => {
  debugLog('app ready');
  const folders = ensureAppFolders();
  debugLog(`folders ${JSON.stringify(folders)}`);
  nativeTheme.themeSource = 'dark';

  // Set global app icon
  const appIcon = nativeImage.createFromPath(path.join(__dirname, '..', 'public', 'logo.png'));
  if (process.platform === 'win32') {
    app.setAppUserModelId('com.vlink.studio');
  }

  const adb = new AdbService({
    adbPath: resolveResourcePath('bin', 'adb', 'adb.exe'),
    androidHome: folders.androidHome,
    emit: (event, payload) => mainWindow?.webContents.send(event, payload)
  });
  const scrcpy = new ScrcpyService({
    scrcpyPath: resolveResourcePath('bin', 'scrcpy', 'scrcpy.exe'),
    adb,
    folders,
    emit: (event, payload) => mainWindow?.webContents.send(event, payload)
  });
  const network = new NetworkService({ adb, emit: (event, payload) => mainWindow?.webContents.send(event, payload) });
  const system = new SystemService({ emit: (event, payload) => mainWindow?.webContents.send(event, payload) });

  createIpcHandlers({ ipcMain, dialog, shell, adb, scrcpy, network, system, folders, nativeTheme });
  createMainWindow();
  try {
    createTray();
  } catch {
    tray = null;
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
}).catch((error) => {
  debugLog(`whenReady failed ${error.stack || error.message}`);
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
