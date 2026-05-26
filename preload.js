const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('deskPet', {
  showContextMenu: () => ipcRenderer.send('show-context-menu'),
  countFrames: (breed, action) => ipcRenderer.invoke('count-frames', breed, action),
  getSave: () => ipcRenderer.invoke('get-save'),
  updateSave: (patch) => ipcRenderer.invoke('update-save', patch),
  adoptConfirm: (payload) => ipcRenderer.invoke('adopt-confirm', payload),
  onFocusChange: (handler) => {
    const listener = (_event, focused) => handler(focused);
    ipcRenderer.on('window-focus', listener);
    return () => ipcRenderer.removeListener('window-focus', listener);
  },
  onPetAction: (handler) => {
    const listener = (_event, payload) => handler(payload);
    ipcRenderer.on('pet-action', listener);
    return () => ipcRenderer.removeListener('pet-action', listener);
  },
  onPetState: (handler) => {
    const listener = (_event, payload) => handler(payload);
    ipcRenderer.on('pet-state-changed', listener);
    return () => ipcRenderer.removeListener('pet-state-changed', listener);
  },
});
