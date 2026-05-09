const { contextBridge, ipcRenderer } = require('electron');

const channels = [
  'devices:changed',
  'logs:changed',
  'mirror:status',
  'metrics:changed',
  'recording:changed'
];

contextBridge.exposeInMainWorld('mirrorApi', {
  invoke: (channel, payload) => ipcRenderer.invoke(channel, payload),
  on: (channel, callback) => {
    if (!channels.includes(channel)) return () => {};
    const listener = (_event, data) => callback(data);
    ipcRenderer.on(channel, listener);
    return () => ipcRenderer.removeListener(channel, listener);
  }
});
