const fs = require('node:fs');
const path = require('node:path');
const { runProcess, timestampName } = require('./process-utils.cjs');

class AdbService {
  constructor({ adbPath, androidHome, emit }) {
    this.adbPath = adbPath;
    this.androidHome = androidHome;
    this.emit = emit;
    this.devices = [];
    this.watcher = null;
  }

  log(message, level = 'info') {
    this.emit('logs:changed', { level, message, at: new Date().toISOString() });
  }

  ensureAvailable() {
    if (!fs.existsSync(this.adbPath)) {
      throw new Error(`ADB binary was not found at ${this.adbPath}. Add Android platform-tools adb.exe to resources/bin/adb before packaging.`);
    }
  }

  async adb(args, options = {}) {
    this.ensureAvailable();
    const result = await runProcess(this.adbPath, args, {
      ...options,
      env: {
        ...process.env,
        ANDROID_USER_HOME: this.androidHome,
        ADB_VENDOR_KEYS: this.androidHome,
        ...(options.env || {})
      }
    });
    if (!result.ok) {
      this.log(`adb ${args.join(' ')} failed: ${result.stderr || result.stdout}`, 'error');
    }
    return result;
  }

  parseDevices(output) {
    return output
      .split(/\r?\n/)
      .slice(1)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [serial, state] = line.split(/\s+/);
        return {
          serial,
          state,
          mode: serial.includes(':') ? 'wireless' : 'usb',
          authorized: state === 'device'
        };
      });
  }

  async enrichDevice(device) {
    if (!device.authorized) return { ...device, name: 'Authorization required', battery: null, android: null };
    const [model, battery, android] = await Promise.all([
      this.adb(['-s', device.serial, 'shell', 'getprop', 'ro.product.model']),
      this.adb(['-s', device.serial, 'shell', 'dumpsys', 'battery']),
      this.adb(['-s', device.serial, 'shell', 'getprop', 'ro.build.version.release'])
    ]);
    const levelMatch = battery.stdout.match(/level:\s*(\d+)/i);
    const pluggedMatch = battery.stdout.match(/powered:\s*(true|false)/i);
    return {
      ...device,
      name: model.stdout.trim() || device.serial,
      android: android.stdout.trim(),
      battery: levelMatch ? Number(levelMatch[1]) : null,
      charging: pluggedMatch ? pluggedMatch[1] === 'true' : false
    };
  }

  async listDevices() {
    const result = await this.adb(['devices']);
    const parsed = this.parseDevices(result.stdout);
    this.devices = await Promise.all(parsed.map((device) => this.enrichDevice(device)));
    this.emit('devices:changed', this.devices);
    return this.devices;
  }

  startDeviceWatcher() {
    if (this.watcher) return { running: true };
    this.listDevices().catch((error) => this.log(error.message, 'error'));
    this.watcher = setInterval(() => {
      this.listDevices().catch((error) => this.log(error.message, 'error'));
    }, 3000);
    return { running: true };
  }

  async version() {
    const result = await this.adb(['version']);
    return result.stdout.trim();
  }

  async openDeveloperSettings(serial) {
    return this.adb(['-s', serial, 'shell', 'am', 'start', '-a', 'android.settings.APPLICATION_DEVELOPMENT_SETTINGS']);
  }

  async enableTcpIp(serial, port = 5555) {
    const result = await this.adb(['-s', serial, 'tcpip', String(port)]);
    if (result.ok) this.log(`Enabled wireless ADB on ${serial}:${port}`);
    return result;
  }

  async getWifiIp(serial) {
    const commands = [
      ['-s', serial, 'shell', 'ip', '-f', 'inet', 'addr', 'show', 'wlan0'],
      ['-s', serial, 'shell', 'ip', 'route'],
      ['-s', serial, 'shell', 'ifconfig', 'wlan0']
    ];
    for (const command of commands) {
      const result = await this.adb(command);
      const text = `${result.stdout}\n${result.stderr}`;
      const cidrMatch = text.match(/inet\s+(\d{1,3}(?:\.\d{1,3}){3})\//);
      if (cidrMatch?.[1]) return cidrMatch[1];
      const routeMatch = text.match(/src\s+(\d{1,3}(?:\.\d{1,3}){3})/);
      if (routeMatch?.[1]) return routeMatch[1];
      const addrMatch = text.match(/addr:(\d{1,3}(?:\.\d{1,3}){3})/);
      if (addrMatch?.[1]) return addrMatch[1];
    }
    return null;
  }

  async prepareUsbDeviceForWireless(serial, port = 5555) {
    const ip = await this.getWifiIp(serial);
    if (!ip) {
      this.log('Could not read the phone WiFi IP. Make sure the phone is connected to the same WiFi network as this PC.', 'error');
      return { ok: false, error: 'Could not read phone WiFi IP.' };
    }
    const tcpip = await this.enableTcpIp(serial, port);
    if (!tcpip.ok) return { ok: false, error: tcpip.stderr || tcpip.stdout };
    await new Promise((resolve) => setTimeout(resolve, 1200));
    const connected = await this.connectWireless(ip, port);
    return { ok: connected.ok, host: ip, port, serial: `${ip}:${port}`, output: connected.stdout || connected.stderr };
  }

  async connectWireless(host, port = 5555) {
    const result = await this.adb(['connect', `${host}:${port}`]);
    this.log(result.ok ? `Connected WiFi ADB: ${host}:${port}` : `WiFi ADB connect failed: ${host}:${port}`, result.ok ? 'info' : 'error');
    await this.listDevices();
    return result;
  }

  async disconnect(serial) {
    const result = await this.adb(['disconnect', serial]);
    await this.listDevices();
    return result;
  }

  async pair(host, port, code) {
    const result = await this.adb(['pair', `${host}:${port}`, code]);
    this.log(result.ok ? `Paired with ${host}:${port}` : `Pairing failed for ${host}:${port}`, result.ok ? 'info' : 'error');
    return result;
  }

  async captureScreenshot(serial, folder) {
    fs.mkdirSync(folder, { recursive: true });
    const remote = `/sdcard/${timestampName('mirror-screenshot', 'png')}`;
    const local = path.join(folder, path.basename(remote));
    await this.adb(['-s', serial, 'shell', 'screencap', '-p', remote]);
    const pulled = await this.adb(['-s', serial, 'pull', remote, local]);
    await this.adb(['-s', serial, 'shell', 'rm', remote]);
    if (pulled.ok) this.log(`Screenshot saved to ${local}`);
    return { ok: pulled.ok, filePath: local };
  }

  async installApk(apkPath) {
    const result = await this.adb(['install', '-r', apkPath]);
    this.log(result.ok ? `APK installed: ${path.basename(apkPath)}` : `APK install failed: ${result.stderr}`, result.ok ? 'info' : 'error');
    return result;
  }

  async pushFiles(serial, filePaths, remoteDir) {
    const results = [];
    for (const filePath of filePaths) {
      const result = await this.adb(['-s', serial, 'push', filePath, remoteDir]);
      results.push({ filePath, ok: result.ok, output: result.stdout || result.stderr });
    }
    return results;
  }

  async setClipboard(serial, text) {
    const escaped = text.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    return this.adb(['-s', serial, 'shell', 'am', 'broadcast', '-a', 'clipper.set', '-e', 'text', escaped]);
  }
}

module.exports = { AdbService };
