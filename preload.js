const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('deskPet', {
  showContextMenu: () => ipcRenderer.send('show-context-menu'),
  countFrames: (breed, action) => ipcRenderer.invoke('count-frames', breed, action),
  getSave: () => ipcRenderer.invoke('get-save'),
  adoptConfirm: (payload) => ipcRenderer.invoke('adopt-confirm', payload),
  onFocusChange: (handler) => {
    const listener = (_event, focused) => handler(focused);
    ipcRenderer.on('window-focus', listener);
    return () => ipcRenderer.removeListener('window-focus', listener);
  },
});
