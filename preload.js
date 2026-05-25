const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('deskPet', {
  showContextMenu: () => ipcRenderer.send('show-context-menu'),
  countFrames: (breed, action) => ipcRenderer.invoke('count-frames', breed, action),
  onFocusChange: (handler) => {
    const listener = (_event, focused) => handler(focused);
    ipcRenderer.on('window-focus', listener);
    return () => ipcRenderer.removeListener('window-focus', listener);
  },
});
