const { app, BrowserWindow, Menu, ipcMain, screen } = require('electron');
const path = require('path');
const fs = require('fs').promises;
const save = require('./lib/save');
const stats = require('./lib/stats');
const speech = require('./lib/speech');

const PET_WIN_WIDTH = 256;
const PET_WIN_HEIGHT = 360; // 顶部 104px 留给气泡，底部 256px 是狗狗画布

const INTERACTION_COOLDOWN_MS = 60_000;
const FEED_HUNGER_DELTA = 20;
const FEED_EXP_DELTA = 3;
const PLAY_EXP_DELTA = 10;
const ACTION_DURATION_MS = 2500;
const LEVELUP_ANIM_MS = 2500;
const TICK_INTERVAL_MS = 60_000;
const BUBBLE_VISIBLE_MS = 4500;

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
  return;
}

let petWindow = null;
let adoptWindow = null;
let quittingAfterFlush = false;
let tickTimer = null;
let speechTimer = null;
let lastTickMs = Date.now();

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
  const x = workArea.x + workArea.width - PET_WIN_WIDTH - 32;
  const y = workArea.y + workArea.height - PET_WIN_HEIGHT - 32;

  petWindow = new BrowserWindow({
    width: PET_WIN_WIDTH,
    height: PET_WIN_HEIGHT,
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
  petWindow.on('closed', () => {
    petWindow = null;
    stopTick();
    stopSpeech();
  });

  startTick();
  startSpeech();
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

// ---------------------- 1 分钟 tick：饥饿 + 情绪 ----------------------

function startTick() {
  stopTick();
  lastTickMs = Date.now();
  tickTimer = setInterval(onTick, TICK_INTERVAL_MS);
}

function stopTick() {
  if (tickTimer) clearInterval(tickTimer);
  tickTimer = null;
}

function onTick() {
  const cache = save.getCache();
  if (!cache) return;
  const nowMs = Date.now();
  const minutesPassed = (nowMs - lastTickMs) / 60_000;
  lastTickMs = nowMs;

  const newHunger = stats.decayHunger(cache.dog.hunger, minutesPassed);
  const draftSave = { ...cache, dog: { ...cache.dog, hunger: newHunger } };
  const newMood = stats.computeMood(draftSave, nowMs);

  const moodChanged = cache.dog.mood !== newMood;
  save.update({
    'dog.hunger': newHunger,
    'dog.mood': newMood,
  });
  if (moodChanged) broadcastPetState();
}

// ---------------------- 主动搭话 ----------------------

function startSpeech() {
  stopSpeech();
  const delay = speech.initialDelayMs();
  speechTimer = setTimeout(tryToSpeak, delay);
}

function stopSpeech() {
  if (speechTimer) clearTimeout(speechTimer);
  speechTimer = null;
}

function rescheduleSpeech(delayOverrideMs) {
  if (speechTimer) clearTimeout(speechTimer);
  speechTimer = setTimeout(tryToSpeak, delayOverrideMs ?? speech.nextDelayMs());
}

function tryToSpeak() {
  const cache = save.getCache();
  if (!cache) {
    rescheduleSpeech();
    return;
  }
  const quietMode = !!cache.settings?.quietMode;
  if (!speech.canSpeak({ quietMode })) {
    rescheduleSpeech();
    return;
  }
  const text = speech.pickLine({ mood: cache.dog.mood, breed: cache.dog.breed });
  if (text) {
    speech.recordSpoken();
    broadcastPetSpeak(text);
  }
  rescheduleSpeech();
}

function speakEvent(eventName) {
  const cache = save.getCache();
  if (!cache) return;
  if (cache.settings?.quietMode) return;
  const text = speech.getEventLine(eventName);
  if (!text) return;
  // 事件类不受 15min 间隔限制，但计入每日上限，避免疯狂事件刷屏
  speech.recordSpoken();
  broadcastPetSpeak(text);
}

function broadcastPetSpeak(text) {
  if (petWindow) {
    petWindow.webContents.send('pet-speak', { text, durationMs: BUBBLE_VISIBLE_MS });
  }
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

function triggerInteraction(kind) {
  const cache = save.getCache();
  if (!cache) return;
  const lastAt = kind === 'eat' ? cache.interactions.lastFeedAt : cache.interactions.lastPlayAt;
  if (isOnCooldown(lastAt)) return;

  const nowIso = new Date().toISOString();
  const expGain = kind === 'eat' ? FEED_EXP_DELTA : PLAY_EXP_DELTA;
  const expResult = stats.applyExpGain(cache.dog, expGain);

  const newHunger = kind === 'eat'
    ? stats.clamp((cache.dog.hunger ?? 0) + FEED_HUNGER_DELTA, stats.HUNGER_MIN, stats.HUNGER_MAX)
    : cache.dog.hunger;

  const draftDog = { ...cache.dog, ...expResult, hunger: newHunger };
  const newMood = kind === 'play'
    ? 'happy'
    : stats.computeMood({ ...cache, dog: draftDog, interactions: { ...cache.interactions, lastFeedAt: nowIso } });

  const patch = {
    'dog.hunger': newHunger,
    'dog.exp': expResult.exp,
    'dog.level': expResult.level,
    'dog.dailyExp': expResult.dailyExp,
    'dog.dailyExpDate': expResult.dailyExpDate,
    'dog.mood': newMood,
  };
  if (kind === 'eat') patch['interactions.lastFeedAt'] = nowIso;
  else patch['interactions.lastPlayAt'] = nowIso;
  save.update(patch);

  broadcastPetAction({ type: kind, durationMs: ACTION_DURATION_MS });
  if (expResult.leveledUp) {
    broadcastPetAction({ type: 'levelup', level: expResult.level, durationMs: LEVELUP_ANIM_MS });
    speakEvent('levelUp');
  }
  broadcastPetState();
}

function broadcastPetAction(payload) {
  if (petWindow) petWindow.webContents.send('pet-action', payload);
}

function broadcastPetState() {
  const cache = save.getCache();
  if (!cache || !petWindow) return;
  petWindow.webContents.send('pet-state-changed', {
    mood: cache.dog.mood,
    level: cache.dog.level,
    exp: cache.dog.exp,
    hunger: cache.dog.hunger,
    quietMode: !!cache.settings?.quietMode,
  });
}

// ---------------------- 右键菜单 ----------------------

function buildContextMenu() {
  const cache = save.getCache();
  const feedLeft = cooldownSecondsLeft(cache?.interactions?.lastFeedAt);
  const playLeft = cooldownSecondsLeft(cache?.interactions?.lastPlayAt);
  const quiet = !!cache?.settings?.quietMode;

  return Menu.buildFromTemplate([
    {
      label: feedLeft > 0 ? `喂食（${feedLeft}s 后可用）` : '喂食',
      enabled: feedLeft === 0,
      click: () => triggerInteraction('eat'),
    },
    {
      label: playLeft > 0 ? `玩耍（${playLeft}s 后可用）` : '玩耍',
      enabled: playLeft === 0,
      click: () => triggerInteraction('play'),
    },
    { type: 'separator' },
    {
      label: '安静模式',
      type: 'checkbox',
      checked: quiet,
      click: () => {
        save.update({ 'settings.quietMode': !quiet });
        broadcastPetState();
      },
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

// ---------------------- 启动 / 退出 ----------------------

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
