const { app, BrowserWindow, Menu, ipcMain, screen } = require('electron');
const path = require('path');
const fs = require('fs').promises;
const save = require('./lib/save');

const PET_WIN_SIZE = 256;

// 互动规则（模块 6 接管完整数值系统时可抽离到独立常量模块）
// hunger 字段语义：饱腹度（0=极饿、100=极饱）。喂食上升、随时间下降。
const INTERACTION_COOLDOWN_MS = 60_000;
const FEED_HUNGER_DELTA = 20;
const FEED_EXP_DELTA = 3;
const PLAY_EXP_DELTA = 10;
const HUNGER_MAX = 100;
const ACTION_DURATION_MS = 2500;

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
  return;
}

let petWindow = null;
let adoptWindow = null;
let quittingAfterFlush = false;

app.on('second-instance', () => {
  const win = petWindow || adoptWindow;
  if (win) {
    if (win.isMinimized()) win.restore();
    win.focus();
  }
});

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

// ---------------------- 互动 ----------------------

function isOnCooldown(lastAt) {
  if (!lastAt) return false;
  return Date.now() - new Date(lastAt).getTime() < INTERACTION_COOLDOWN_MS;
}

function cooldownSecondsLeft(lastAt) {
  if (!lastAt) return 0;
  const left = INTERACTION_COOLDOWN_MS - (Date.now() - new Date(lastAt).getTime());
  return Math.max(0, Math.ceil(left / 1000));
}

function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}

function triggerFeed() {
  const cache = save.getCache();
  if (!cache) return;
  if (isOnCooldown(cache.interactions.lastFeedAt)) return;

  const nowIso = new Date().toISOString();
  save.update({
    'dog.hunger': clamp((cache.dog.hunger ?? 0) + FEED_HUNGER_DELTA, 0, HUNGER_MAX),
    'dog.exp': (cache.dog.exp ?? 0) + FEED_EXP_DELTA,
    'interactions.lastFeedAt': nowIso,
  });
  broadcastPetAction({ type: 'eat', durationMs: ACTION_DURATION_MS });
}

function triggerPlay() {
  const cache = save.getCache();
  if (!cache) return;
  if (isOnCooldown(cache.interactions.lastPlayAt)) return;

  const nowIso = new Date().toISOString();
  save.update({
    'dog.mood': 'happy',
    'dog.exp': (cache.dog.exp ?? 0) + PLAY_EXP_DELTA,
    'interactions.lastPlayAt': nowIso,
  });
  broadcastPetAction({ type: 'play', durationMs: ACTION_DURATION_MS });
}

function broadcastPetAction(payload) {
  if (petWindow) petWindow.webContents.send('pet-action', payload);
}

// ---------------------- 右键菜单 ----------------------

function buildContextMenu() {
  const cache = save.getCache();
  const lastFeed = cache?.interactions?.lastFeedAt;
  const lastPlay = cache?.interactions?.lastPlayAt;
  const feedLeft = cooldownSecondsLeft(lastFeed);
  const playLeft = cooldownSecondsLeft(lastPlay);

  return Menu.buildFromTemplate([
    {
      label: feedLeft > 0 ? `喂食（${feedLeft}s 后可用）` : '喂食',
      enabled: feedLeft === 0,
      click: () => triggerFeed(),
    },
    {
      label: playLeft > 0 ? `玩耍（${playLeft}s 后可用）` : '玩耍',
      enabled: playLeft === 0,
      click: () => triggerPlay(),
    },
    { type: 'separator' },
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

ipcMain.handle('get-save', () => save.getCache());

ipcMain.handle('update-save', (_event, patch) => save.update(patch));

ipcMain.handle('adopt-confirm', async (_event, payload) => {
  const breeds = ['shiba', 'corgi', 'golden', 'husky', 'teddy', 'zhongtian'];
  const genders = ['male', 'female'];
  if (!payload || !breeds.includes(payload.breed) || !genders.includes(payload.gender)) {
    return { ok: false, error: 'invalid payload' };
  }
  const name = String(payload.name || '').trim().slice(0, 8);
  if (!name) return { ok: false, error: 'empty name' };

  save.setCache(save.buildInitialSave({ breed: payload.breed, gender: payload.gender, name }));
  await save.flush();

  if (adoptWindow) adoptWindow.close();
  createPetWindow();
  return { ok: true };
});

// ---------------------- 启动流程 ----------------------

app.whenReady().then(async () => {
  const existing = await save.load();
  if (existing && existing.dog && existing.dog.breed) {
    createPetWindow();
  } else {
    createAdoptWindow();
  }
});

app.on('before-quit', (event) => {
  if (quittingAfterFlush) return;
  if (!save.hasPendingWrite()) return;
  event.preventDefault();
  save.flush().finally(() => {
    quittingAfterFlush = true;
    app.quit();
  });
});

app.on('window-all-closed', () => {
  app.quit();
});
