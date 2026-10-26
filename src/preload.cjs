const { contextBridge, ipcRenderer } = require('electron');

const on = (channel) => (cb) => ipcRenderer.on(channel, (_e, payload) => cb(payload));

contextBridge.exposeInMainWorld('gf', {
  info: () => ipcRenderer.invoke('app:info'),
  getLibrary: () => ipcRenderer.invoke('lib:get'),
  scan: (folders, merge) => ipcRenderer.invoke('lib:scan', { folders, merge }),
  onScanProgress: on('scan:progress'),
  getUser: () => ipcRenderer.invoke('user:get'),
  saveUser: (json) => ipcRenderer.invoke('user:save', json),
  exportMetadata: (json) => ipcRenderer.invoke('metadata:export', json),
  pickFolders: () => ipcRenderer.invoke('dialog:folder'),
  pickImage: () => ipcRenderer.invoke('image:pick'),
  lyrics: (id) => ipcRenderer.invoke('lyrics:get', id),
  prepare: (id) => ipcRenderer.invoke('media:prepare', id),
  findM3u: (folders) => ipcRenderer.invoke('m3u:scan', folders),
  cacheSize: () => ipcRenderer.invoke('cache:size'),
  clearCache: () => ipcRenderer.invoke('cache:clear'),
  showFile: (id) => ipcRenderer.invoke('show:file', id),
  win: (cmd) => ipcRenderer.invoke('win', cmd),
  onWinState: on('win:state'),
});
