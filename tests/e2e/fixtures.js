/**
 * Playwright Electron 测试夹具
 *
 * launchApp 用独立的临时 userData 目录启动应用，避免污染真实存档。
 * 可选 seedSave 预置存档，控制启动进入领养页还是桌面狗狗。
 */

const { _electron: electron } = require('@playwright/test');
const path = require('path');
const os = require('os');
const fs = require('fs');

const APP_ROOT = path.join(__dirname, '..', '..');

function makeTempUserData() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'deskpet-test-'));
}

function buildSave(overrides = {}) {
  const base = {
    version: 2,
    dog: {
      breed: 'shiba',
      gender: 'male',
      name: '测试狗',
      adoptedAt: new Date().toISOString(),
      level: 1,
      exp: 0,
      mood: 'normal',
      hunger: 80,
      dailyExp: 0,
      dailyExpDate: null,
    },
    settings: { quietMode: false },
    interactions: { lastFeedAt: null, lastPlayAt: null },
    travel: { status: 'idle', destination: null, departedAt: null, returnAt: null, lastReturnAt: null },
    postcards: [],
  };
  return {
    ...base,
    ...overrides,
    dog: { ...base.dog, ...(overrides.dog || {}) },
    travel: { ...base.travel, ...(overrides.travel || {}) },
    settings: { ...base.settings, ...(overrides.settings || {}) },
    interactions: { ...base.interactions, ...(overrides.interactions || {}) },
  };
}

function seedSave(userDataDir, save) {
  fs.mkdirSync(userDataDir, { recursive: true });
  fs.writeFileSync(path.join(userDataDir, 'savegame.json'), JSON.stringify(save, null, 2));
}

/**
 * @param {object} opts
 * @param {object|null} opts.save  预置存档（传 null 表示不预置 → 进领养页）
 * @param {boolean} opts.dev       是否开 DESKPET_DEV
 * @returns {Promise<{app, userDataDir}>}
 */
async function launchApp({ save = buildSave(), dev = true } = {}) {
  const userDataDir = makeTempUserData();
  if (save) seedSave(userDataDir, save);

  const env = { ...process.env, DESKPET_USERDATA: userDataDir, DESKPET_TEST: '1' };
  if (dev) env.DESKPET_DEV = '1';

  const app = await electron.launch({
    args: [APP_ROOT],
    env,
  });
  return { app, userDataDir };
}

function readSave(userDataDir) {
  const p = path.join(userDataDir, 'savegame.json');
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function cleanup(userDataDir) {
  try {
    fs.rmSync(userDataDir, { recursive: true, force: true });
  } catch {
    /* ignore */
  }
}

module.exports = { launchApp, buildSave, seedSave, readSave, cleanup, APP_ROOT };
