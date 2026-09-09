const { contextBridge } = require('electron');

// Expose safe platform metadata to the web renderer if needed
contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  isElectron: true
});
