/**
 * 本地存档模块（主进程）
 *
 * 设计要点（PRD 第 8 章「不丢档」红线 + 方案模块 4）：
 *   - 内存缓存 saveCache 为唯一真源；磁盘是 saveCache 的快照
 *   - debounce 1s 写盘，避免每次数值变化都 IO
 *   - 原子写：写 .tmp 文件后 rename，避免半截文件
 *   - before-quit 强制 flush，确保异常关闭也不丢
 *   - update(patch) 支持 'a.b.c' 路径键，渲染端可一次提交多字段
 *
 * 后续模块（5/6/7/8）通过 IPC `update-save` 走这个唯一入口。
 */

const path = require('path');
const fs = require('fs').promises;
const { app } = require('electron');

const SCHEMA_VERSION = 1;
const DEBOUNCE_MS = 1000;
const SAVE_FILE = 'savegame.json';

let saveCache = null;
let savePath = null;
let writeTimer = null;
let pendingWrite = false;
let inFlightWrite = null;

function getSavePath() {
  if (!savePath) savePath = path.join(app.getPath('userData'), SAVE_FILE);
  return savePath;
}

function buildInitialSave({ breed, gender, name }) {
  return {
    version: SCHEMA_VERSION,
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

function migrate(save) {
  if (!save || typeof save !== 'object') return null;
  // 当前只有 v1，后续 schema 升级时在这里做兼容
  if (save.version !== SCHEMA_VERSION) {
    console.warn(`[save] unknown version ${save.version}, attempting to use as-is`);
  }
  return save;
}

async function load() {
  try {
    const raw = await fs.readFile(getSavePath(), 'utf8');
    const parsed = JSON.parse(raw);
    saveCache = migrate(parsed);
    return saveCache;
  } catch (err) {
    if (err.code !== 'ENOENT') {
      console.warn(`[save] failed to read: ${err.message}`);
    }
    saveCache = null;
    return null;
  }
}

function getCache() {
  return saveCache;
}

function setCache(next) {
  saveCache = next;
  scheduleWrite();
  return saveCache;
}

function setPath(obj, dotted, value) {
  const parts = dotted.split('.');
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const key = parts[i];
    if (cur[key] == null || typeof cur[key] !== 'object') cur[key] = {};
    cur = cur[key];
  }
  cur[parts[parts.length - 1]] = value;
}

function update(patch) {
  if (!saveCache || !patch || typeof patch !== 'object') return saveCache;
  const next = JSON.parse(JSON.stringify(saveCache));
  for (const [key, value] of Object.entries(patch)) {
    if (key.includes('.')) {
      setPath(next, key, value);
    } else {
      next[key] = value;
    }
  }
  saveCache = next;
  scheduleWrite();
  return saveCache;
}

function scheduleWrite() {
  pendingWrite = true;
  if (writeTimer) clearTimeout(writeTimer);
  writeTimer = setTimeout(() => {
    writeTimer = null;
    flush().catch((err) => console.error(`[save] flush error: ${err.message}`));
  }, DEBOUNCE_MS);
}

async function _writeNow() {
  if (!saveCache) return;
  const data = JSON.stringify(saveCache, null, 2);
  const target = getSavePath();
  const tmp = `${target}.tmp`;
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(tmp, data, 'utf8');
  await fs.rename(tmp, target);
}

async function flush() {
  if (inFlightWrite) await inFlightWrite;
  if (!pendingWrite) return;
  if (writeTimer) {
    clearTimeout(writeTimer);
    writeTimer = null;
  }
  pendingWrite = false;
  inFlightWrite = _writeNow();
  try {
    await inFlightWrite;
  } finally {
    inFlightWrite = null;
  }
}

function hasPendingWrite() {
  return pendingWrite || inFlightWrite !== null;
}

module.exports = {
  SCHEMA_VERSION,
  load,
  getCache,
  setCache,
  update,
  flush,
  hasPendingWrite,
  buildInitialSave,
  getSavePath,
};
