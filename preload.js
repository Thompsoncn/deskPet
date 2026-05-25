const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('deskPet', {
  showContextMenu: () => ipcRenderer.send('show-context-menu'),
});
