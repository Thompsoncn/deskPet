const { app, BrowserWindow, Menu, ipcMain, screen, Notification, dialog } = require('electron');
const path = require('path');
const fs = require('fs').promises;
const save = require('./lib/save');
const stats = require('./lib/stats');
const speech = require('./lib/speech');
const travel = require('./lib/travel');

const PET_WIN_WIDTH = 256;
const PET_WIN_HEIGHT = 360;

const INTERACTION_COOLDOWN_MS = 60_000;
const FEED_HUNGER_DELTA = 20;
const FEED_EXP_DELTA = 3;
const PLAY_EXP_DELTA = 10;
const ACTION_DURATION_MS = 2500;
const LEVELUP_ANIM_MS = 2500;
const TICK_INTERVAL_MS = 60_000;
const BUBBLE_VISIBLE_MS = 4500;

const DEPARTING_HOLD_MS = 5_000;  // departing 阶段持续时间
const ARRIVING_HOLD_MS = 5_000;   // arriving 阶段持续时间
const TRAVEL_EXP_GAIN = 25;       // 旅行归来奖励

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
  return;
}

let petWindow = null;
let adoptWindow = null;
let albumWindow = null;
let quittingAfterFlush = false;
let tickTimer = null;
let speechTimer = null;
let travelCheckTimer = null;
let travelStateTimer = null;
let lastTickMs = Date.now();

app.on('second-instance', () => {
  const win = petWindow || adoptWindow || albumWindow;
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
    stopTravelCheck();
  });

  // 启动时若上次崩溃在 away 状态，恢复后立刻判定是否该归来。
  // 延迟 200ms 启动以确保渲染端 IPC 监听器已注册（避免初始广播被丢）
  petWindow.webContents.on('did-finish-load', () => {
    setTimeout(() => {
      resumeTravelIfMidFlight();
      startTick();
      startSpeech();
      startTravelCheck();
      broadcastPetState();
    }, 200);
  });
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

// ---------------------- 相册窗口 ----------------------

function openAlbumWindow() {
  if (albumWindow) {
    albumWindow.focus();
    return;
  }
  albumWindow = new BrowserWindow({
    width: 960,
    height: 720,
    title: '明信片相册',
    backgroundColor: '#fefcf3',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  albumWindow.setMenuBarVisibility(false);
  albumWindow.loadFile(path.join(__dirname, 'renderer/postcard.html'));
  albumWindow.on('closed', () => { albumWindow = null; });
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
  // 旅行中不衰减饥饿（狗狗在外面自己吃），也不强行换情绪
  if (cache.travel?.status && cache.travel.status !== 'idle') return;

  const nowMs = Date.now();
  const minutesPassed = (nowMs - lastTickMs) / 60_000;
  lastTickMs = nowMs;

  const newHunger = stats.decayHunger(cache.dog.hunger, minutesPassed);
  const draftSave = { ...cache, dog: { ...cache.dog, hunger: newHunger } };
  const newMood = stats.computeMood(draftSave, nowMs);

  const moodChanged = cache.dog.mood !== newMood;
  save.update({ 'dog.hunger': newHunger, 'dog.mood': newMood });
  if (moodChanged) broadcastPetState();
}

// ---------------------- 主动搭话 ----------------------

function startSpeech() {
  stopSpeech();
  speechTimer = setTimeout(tryToSpeak, speech.initialDelayMs());
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
  // 旅行中不主动说话（狗狗不在桌面）
  if (cache.travel?.status === 'away') {
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
  speech.recordSpoken();
  broadcastPetSpeak(text);
}

function broadcastPetSpeak(text) {
  if (petWindow) petWindow.webContents.send('pet-speak', { text, durationMs: BUBBLE_VISIBLE_MS });
}

// ---------------------- 旅行 ----------------------

function startTravelCheck() {
  stopTravelCheck();
  travelCheckTimer = setInterval(checkTravelTrigger, travel.checkIntervalMs());
}

function stopTravelCheck() {
  if (travelCheckTimer) clearInterval(travelCheckTimer);
  travelCheckTimer = null;
}

function checkTravelTrigger() {
  const cache = save.getCache();
  if (!cache) return;
  if (!travel.shouldTriggerTravel(cache)) return;
  startTravel();
}

function forceEndTravel() {
  if (travelStateTimer) {
    clearTimeout(travelStateTimer);
    travelStateTimer = null;
  }
  save.update({
    'travel.status': 'idle',
    'travel.destination': null,
    'travel.departedAt': null,
    'travel.returnAt': null,
    'travel.lastReturnAt': new Date().toISOString(),
    'dog.mood': 'normal',
  });
  broadcastPetState();
}

function startTravel() {
  const cache = save.getCache();
  if (!cache || cache.travel?.status !== 'idle') return;

  const destination = travel.pickDestination();
  if (!destination) return;

  const durationMs = travel.randomDurationMs();
  const now = Date.now();
  const returnAt = new Date(now + durationMs);

  save.update({
    'travel.status': 'departing',
    'travel.destination': destination.id,
    'travel.departedAt': new Date(now).toISOString(),
    'travel.returnAt': returnAt.toISOString(),
  });
  broadcastPetState();

  speakEvent('travelStart');

  // departing → away
  scheduleTravelStateTimer(() => {
    save.update({ 'travel.status': 'away' });
    broadcastPetState();
    // 安排归来
    const remain = returnAt.getTime() - Date.now();
    scheduleTravelStateTimer(() => generatePostcardAndArrive(destination), Math.max(0, remain));
  }, DEPARTING_HOLD_MS);
}

function scheduleTravelStateTimer(fn, delayMs) {
  if (travelStateTimer) clearTimeout(travelStateTimer);
  travelStateTimer = setTimeout(() => {
    travelStateTimer = null;
    fn();
  }, delayMs);
}

async function generatePostcardAndArrive(destination) {
  const cache = save.getCache();
  if (!cache) return;

  const line = travel.pickLineFor(destination) || `${destination.name}真好玩！`;
  const dateStr = formatLocalDate(new Date());
  const postcard = await renderAndSavePostcard({
    destination,
    breed: cache.dog.breed,
    dogName: cache.dog.name,
    line,
    dateStr,
  });
  if (!postcard) {
    console.warn('[travel] postcard generation failed, returning without postcard');
  }

  // 把明信片入相册
  const existing = save.getCache()?.postcards || [];
  const next = postcard ? [...existing, postcard] : existing;

  save.update({
    'postcards': next,
    'travel.status': 'arriving',
  });
  broadcastPetState();

  // 系统通知
  if (Notification.isSupported()) {
    const n = new Notification({
      title: '狗狗寄明信片回来啦',
      body: `来自${destination.name}：${line}`,
      silent: false,
    });
    n.on('click', () => openAlbumWindow());
    n.show();
  }

  speakEvent('travelEnd');

  // arriving → idle，发放奖励
  scheduleTravelStateTimer(() => {
    const c = save.getCache();
    if (!c) return;
    const expResult = stats.applyExpGain(c.dog, TRAVEL_EXP_GAIN);
    save.update({
      'travel.status': 'idle',
      'travel.lastReturnAt': new Date().toISOString(),
      'travel.destination': null,
      'travel.departedAt': null,
      'travel.returnAt': null,
      'dog.mood': 'happy',
      'dog.exp': expResult.exp,
      'dog.level': expResult.level,
      'dog.dailyExp': expResult.dailyExp,
      'dog.dailyExpDate': expResult.dailyExpDate,
    });
    broadcastPetState();
    if (expResult.leveledUp) {
      broadcastPetAction({ type: 'levelup', level: expResult.level, durationMs: LEVELUP_ANIM_MS });
      speakEvent('levelUp');
    }
  }, ARRIVING_HOLD_MS);
}

function resumeTravelIfMidFlight() {
  const cache = save.getCache();
  if (!cache) return;
  const status = cache.travel?.status;
  if (!status || status === 'idle') return;

  const destination = travel.findDestination(cache.travel.destination);
  if (!destination) {
    // 数据异常（destination 丢失或无效），清回 idle
    console.warn('[travel] resume: invalid destination, resetting to idle');
    save.update({
      'travel.status': 'idle',
      'travel.destination': null,
      'travel.departedAt': null,
      'travel.returnAt': null,
    });
    broadcastPetState();
    return;
  }

  if (status === 'departing') {
    // 直接接续到 away
    save.update({ 'travel.status': 'away' });
    const returnAt = cache.travel.returnAt ? new Date(cache.travel.returnAt).getTime() : Date.now();
    const remain = Math.max(0, returnAt - Date.now());
    scheduleTravelStateTimer(() => generatePostcardAndArrive(destination), remain);
  } else if (status === 'away') {
    const returnAt = cache.travel.returnAt ? new Date(cache.travel.returnAt).getTime() : Date.now();
    const remain = returnAt - Date.now();
    if (remain <= 0) {
      generatePostcardAndArrive(destination);
    } else {
      scheduleTravelStateTimer(() => generatePostcardAndArrive(destination), remain);
    }
  } else if (status === 'arriving') {
    // 异常状态，立刻回 idle
    save.update({
      'travel.status': 'idle',
      'travel.lastReturnAt': new Date().toISOString(),
    });
  }
}

async function renderAndSavePostcard({ destination, breed, dogName, line, dateStr }) {
  if (!petWindow) return null;
  try {
    const payload = JSON.stringify({
      destination,
      breed,
      dogName,
      line,
      dateStr,
      watermark: 'deskPet',
    });
    const dataURL = await petWindow.webContents.executeJavaScript(
      `window.deskPetPostcard.render(${payload})`,
      true,
    );
    if (!dataURL || typeof dataURL !== 'string') return null;

    const base64 = dataURL.replace(/^data:image\/png;base64,/, '');
    const buf = Buffer.from(base64, 'base64');
    const id = `postcard_${Date.now()}`;
    const dir = path.join(app.getPath('userData'), 'postcards');
    await fs.mkdir(dir, { recursive: true });
    const filename = `${id}.png`;
    await fs.writeFile(path.join(dir, filename), buf);

    return {
      id,
      destinationId: destination.id,
      destinationName: destination.name,
      line,
      createdAt: new Date().toISOString(),
      filename,
    };
  } catch (err) {
    console.error('[travel] render postcard failed:', err);
    return null;
  }
}

function formatLocalDate(now = new Date()) {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}.${m}.${d}`;
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
  // 旅行中无法互动
  if (cache.travel?.status && cache.travel.status !== 'idle') return;

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
    travelStatus: cache.travel?.status || 'idle',
    travelDestination: cache.travel?.destination || null,
  });
}

// ---------------------- 右键菜单 ----------------------

function buildContextMenu() {
  const cache = save.getCache();
  const feedLeft = cooldownSecondsLeft(cache?.interactions?.lastFeedAt);
  const playLeft = cooldownSecondsLeft(cache?.interactions?.lastPlayAt);
  const quiet = !!cache?.settings?.quietMode;
  const traveling = cache?.travel?.status && cache.travel.status !== 'idle';
  const postcardCount = (cache?.postcards || []).length;

  const items = [
    {
      label: traveling ? '喂食（旅行中）' : (feedLeft > 0 ? `喂食（${feedLeft}s 后可用）` : '喂食'),
      enabled: !traveling && feedLeft === 0,
      click: () => triggerInteraction('eat'),
    },
    {
      label: traveling ? '玩耍（旅行中）' : (playLeft > 0 ? `玩耍（${playLeft}s 后可用）` : '玩耍'),
      enabled: !traveling && playLeft === 0,
      click: () => triggerInteraction('play'),
    },
    { type: 'separator' },
    {
      label: `明信片相册${postcardCount > 0 ? `（${postcardCount}）` : ''}`,
      click: () => openAlbumWindow(),
    },
    {
      label: '安静模式',
      type: 'checkbox',
      checked: quiet,
      click: () => {
        save.update({ 'settings.quietMode': !quiet });
        broadcastPetState();
      },
    },
  ];

  if (travel.isDev()) {
    items.push({ type: 'separator' });
    items.push({
      label: '[DEV] 立刻去旅行',
      enabled: !traveling,
      click: () => startTravel(),
    });
    items.push({
      label: '[DEV] 强制结束旅行（救援）',
      enabled: !!traveling,
      click: () => forceEndTravel(),
    });
  }

  items.push({ type: 'separator' });
  items.push({ label: '退出', click: () => app.quit() });

  return Menu.buildFromTemplate(items);
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

ipcMain.handle('list-postcards', async () => {
  const cache = save.getCache();
  const list = cache?.postcards || [];
  const dir = path.join(app.getPath('userData'), 'postcards');
  const out = [];
  for (const p of list) {
    try {
      const buf = await fs.readFile(path.join(dir, p.filename));
      const dataURL = `data:image/png;base64,${buf.toString('base64')}`;
      out.push({ ...p, dataURL });
    } catch {
      // 文件丢失就跳过
    }
  }
  // 倒序：新明信片在前
  return out.reverse();
});

ipcMain.handle('save-postcard-as', async (event, id) => {
  const cache = save.getCache();
  const p = (cache?.postcards || []).find((x) => x.id === id);
  if (!p) return { ok: false, error: 'not found' };
  const srcPath = path.join(app.getPath('userData'), 'postcards', p.filename);
  const win = BrowserWindow.fromWebContents(event.sender);
  const res = await dialog.showSaveDialog(win, {
    title: '保存明信片',
    defaultPath: `${p.destinationName}_${p.createdAt.slice(0, 10)}.png`,
    filters: [{ name: 'PNG 图片', extensions: ['png'] }],
  });
  if (res.canceled || !res.filePath) return { ok: false, canceled: true };
  try {
    await fs.copyFile(srcPath, res.filePath);
    return { ok: true, path: res.filePath };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('open-album', () => {
  openAlbumWindow();
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
