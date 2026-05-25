const { app, BrowserWindow, Menu, ipcMain, screen } = require('electron');
const path = require('path');
const fs = require('fs').promises;

const PET_WIN_SIZE = 256;

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
  return;
}

let petWindow = null;
let adoptWindow = null;

app.on('second-instance', () => {
  const win = petWindow || adoptWindow;
  if (win) {
    if (win.isMinimized()) win.restore();
    win.focus();
  }
});

// ---------------------- 临时存档（模块 4 替换） ----------------------

const SAVE_PATH = () => path.join(app.getPath('userData'), 'savegame.json');

async function readSave() {
  try {
    const raw = await fs.readFile(SAVE_PATH(), 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function writeSave(save) {
  await fs.mkdir(path.dirname(SAVE_PATH()), { recursive: true });
  await fs.writeFile(SAVE_PATH(), JSON.stringify(save, null, 2), 'utf8');
}

function buildInitialSave({ breed, gender, name }) {
  return {
    version: 1,
    dog: {
      breed,
      gender,
      name,
      adoptedAt: new Date().toISOString(),
      level: 1,
      exp: 0,
      mood: 'normal',
      hunger: 80,
    },
    settings: { quietMode: false },
    interactions: { lastFeedAt: null, lastPlayAt: null },
    travel: { status: 'idle', departedAt: null, returnAt: null },
    postcards: [],
  };
}

// ---------------------- 主窗口（桌面狗狗） ----------------------

function createPetWindow() {
  const { workArea } = screen.getPrimaryDisplay();
  const x = workArea.x + workArea.width - PET_WIN_SIZE - 32;
  const y = workArea.y + workArea.height - PET_WIN_SIZE - 32;

  petWindow = new BrowserWindow({
    width: PET_WIN_SIZE,
    height: PET_WIN_SIZE,
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

  petWindow.loadFile(path.join(__dirname, 'renderer/index.html'));

  petWindow.on('focus', () => petWindow.webContents.send('window-focus', true));
  petWindow.on('blur', () => petWindow.webContents.send('window-focus', false));
  petWindow.on('closed', () => { petWindow = null; });
}

// ---------------------- 领养窗口 ----------------------

function createAdoptWindow() {
  adoptWindow = new BrowserWindow({
    width: 640,
    height: 600,
    resizable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    title: '领养你的狗狗',
    backgroundColor: '#fefcf3',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  adoptWindow.setMenuBarVisibility(false);
  adoptWindow.loadFile(path.join(__dirname, 'renderer/adopt.html'));
  adoptWindow.on('closed', () => { adoptWindow = null; });
}

// ---------------------- 右键菜单 ----------------------

function buildContextMenu() {
  return Menu.buildFromTemplate([
    { label: '退出', click: () => app.quit() },
  ]);
}

ipcMain.on('show-context-menu', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win) return;
  buildContextMenu().popup({ window: win });
});

// ---------------------- 数据 IPC ----------------------

ipcMain.handle('count-frames', async (_event, breed, action) => {
  const dir = path.join(__dirname, 'assets', 'breeds', breed, action);
  try {
    const files = await fs.readdir(dir);
    return files.filter((f) => /^frame_\d{3}\.png$/i.test(f)).length;
  } catch {
    return 0;
  }
});

ipcMain.handle('get-save', async () => readSave());

ipcMain.handle('adopt-confirm', async (_event, payload) => {
  const breeds = ['shiba', 'corgi', 'golden', 'husky', 'teddy', 'zhongtian'];
  const genders = ['male', 'female'];
  if (!payload || !breeds.includes(payload.breed) || !genders.includes(payload.gender)) {
    return { ok: false, error: 'invalid payload' };
  }
  const name = String(payload.name || '').trim().slice(0, 8);
  if (!name) return { ok: false, error: 'empty name' };

  const save = buildInitialSave({ breed: payload.breed, gender: payload.gender, name });
  await writeSave(save);

  if (adoptWindow) adoptWindow.close();
  createPetWindow();
  return { ok: true };
});

// ---------------------- 启动流程 ----------------------

app.whenReady().then(async () => {
  const existing = await readSave();
  if (existing && existing.dog && existing.dog.breed) {
    createPetWindow();
  } else {
    createAdoptWindow();
  }
});

app.on('window-all-closed', () => {
  app.quit();
});
