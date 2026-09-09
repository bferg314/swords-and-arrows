const { contextBridge, ipcRenderer } = require('electron');

// Expose safe platform metadata to the web renderer if needed
contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  isElectron: true,
  exitGame: () => ipcRenderer.send('exit-game')
});
