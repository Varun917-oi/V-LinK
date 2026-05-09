function createIpcHandlers({ ipcMain, dialog, shell, adb, scrcpy, network, system, folders, nativeTheme }) {
  ipcMain.handle('system:info', async () => {
    const gpu = await system.getGpuInfo();
    const cpu = await system.getCpuInfo();
    return { gpu, cpu };
  });
  ipcMain.handle('app:paths', () => folders);
  ipcMain.handle('theme:set', (_event, theme) => {
    nativeTheme.themeSource = theme === 'light' ? 'light' : 'dark';
    return nativeTheme.themeSource;
  });
  ipcMain.handle('devices:list', () => adb.listDevices());
  ipcMain.handle('devices:watch', () => adb.startDeviceWatcher());
  ipcMain.handle('adb:version', () => adb.version());
  ipcMain.handle('adb:open-settings', (_event, serial) => adb.openDeveloperSettings(serial));
  ipcMain.handle('adb:tcpip', (_event, payload) => adb.enableTcpIp(payload.serial, payload.port ?? 5555));
  ipcMain.handle('adb:connect', (_event, payload) => adb.connectWireless(payload.host, payload.port ?? 5555));
  ipcMain.handle('adb:usb-to-wifi', (_event, payload) => adb.prepareUsbDeviceForWireless(payload.serial, payload.port ?? 5555));
  ipcMain.handle('adb:disconnect', (_event, payload) => adb.disconnect(payload.serial));
  ipcMain.handle('adb:pair', (_event, payload) => adb.pair(payload.host, payload.port, payload.code));
  ipcMain.handle('network:scan', (_event, payload) => network.scan(payload?.port ?? 5555));
  ipcMain.handle('wireless:mirror', async (_event, payload) => {
    const settings = payload?.settings || {};
    const preferredSerial = payload?.serial;
    let devices = await adb.listDevices();
    let target = devices.find((device) => device.authorized && device.mode === 'wireless' && device.serial === preferredSerial)
      || devices.find((device) => device.authorized && device.mode === 'wireless');

    if (!target) {
      const usbTarget = devices.find((device) => device.authorized && device.mode === 'usb' && device.serial === preferredSerial)
        || devices.find((device) => device.authorized && device.mode === 'usb');
      if (usbTarget) {
        adb.log(`Preparing ${usbTarget.name || usbTarget.serial} for one-click WiFi mirroring.`);
        const prepared = await adb.prepareUsbDeviceForWireless(usbTarget.serial, payload?.port ?? 5555);
        if (prepared.ok) {
          devices = await adb.listDevices();
          target = devices.find((device) => device.authorized && device.serial === prepared.serial)
            || devices.find((device) => device.authorized && device.mode === 'wireless');
        }
      }
    }

    if (!target) {
      adb.log('No WiFi ADB device is already connected. Scanning local network on port 5555.');
      const hosts = await network.scan(payload?.port ?? 5555);
      for (const host of hosts) {
        await adb.connectWireless(host.host, host.port);
      }
      devices = await adb.listDevices();
      target = devices.find((device) => device.authorized && device.mode === 'wireless');
    }

    if (!target) {
      adb.log('No authorized WiFi ADB device was found. Pair or connect the phone over Wireless debugging first.', 'error');
      return { ok: false, error: 'No authorized WiFi ADB device found.' };
    }

    scrcpy.start({ ...settings, serial: target.serial, fullscreen: false });
    return { ok: true, serial: target.serial, device: target };
  });
  ipcMain.handle('mirror:start', (_event, payload) => scrcpy.start(payload));
  ipcMain.handle('mirror:restart', (_event, payload) => scrcpy.restart(payload.serial, payload));
  ipcMain.handle('mirror:stop', (_event, serial) => scrcpy.stop(serial));
  ipcMain.handle('mirror:fullscreen', (_event, payload) => scrcpy.fullscreen(payload.serial));
  ipcMain.handle('mirror:control', (_event, payload) => scrcpy.control(payload));
  ipcMain.handle('capture:screenshot', (_event, serial) => adb.captureScreenshot(serial, folders.screenshots));
  ipcMain.handle('record:start', (_event, payload) => scrcpy.startRecording(payload));
  ipcMain.handle('record:stop', (_event, serial) => scrcpy.stopRecording(serial));
  ipcMain.handle('recordings:list', () => scrcpy.listRecordings());
  ipcMain.handle('recordings:open', (_event, filePath) => shell.openPath(filePath));
  ipcMain.handle('apk:install', async () => {
    const result = await dialog.showOpenDialog({ filters: [{ name: 'Android APK', extensions: ['apk'] }], properties: ['openFile'] });
    if (result.canceled || result.filePaths.length === 0) return { canceled: true };
    return adb.installApk(result.filePaths[0]);
  });
  ipcMain.handle('file:push', async (_event, serial) => {
    const result = await dialog.showOpenDialog({ properties: ['openFile', 'multiSelections'] });
    if (result.canceled || result.filePaths.length === 0) return { canceled: true };
    return adb.pushFiles(serial, result.filePaths, '/sdcard/Download/');
  });
  ipcMain.handle('clipboard:push', (_event, payload) => adb.setClipboard(payload.serial, payload.text));
  ipcMain.handle('folder:recordings', () => shell.openPath(folders.recordings));
}

module.exports = { createIpcHandlers };
