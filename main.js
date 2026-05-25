const { app, BrowserWindow, Menu, ipcMain, screen } = require('electron');
const path = require('path');
const fs = require('fs').promises;

const WIN_SIZE = 256;

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
  return;
}

let mainWindow = null;

app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

function createWindow() {
  const { workArea } = screen.getPrimaryDisplay();
  const x = workArea.x + workArea.width - WIN_SIZE - 32;
  const y = workArea.y + workArea.height - WIN_SIZE - 32;

  mainWindow = new BrowserWindow({
    width: WIN_SIZE,
    height: WIN_SIZE,
    x,
    y,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    movable: true,
    hasShadow: false,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer/index.html'));

  mainWindow.on('focus', () => mainWindow.webContents.send('window-focus', true));
  mainWindow.on('blur', () => mainWindow.webContents.send('window-focus', false));
}

function buildContextMenu() {
  return Menu.buildFromTemplate([
    {
      label: '退出',
      click: () => {
        app.quit();
      },
    },
  ]);
}

ipcMain.on('show-context-menu', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win) return;
  buildContextMenu().popup({ window: win });
});

ipcMain.handle('count-frames', async (_event, breed, action) => {
  const dir = path.join(__dirname, 'assets', 'breeds', breed, action);
  try {
    const files = await fs.readdir(dir);
    return files.filter((f) => /^frame_\d{3}\.png$/i.test(f)).length;
  } catch {
    return 0;
  }
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  app.quit();
});
