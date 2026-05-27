/**
 * 旅行调度（主进程）
 *
 * 状态机：idle → departing → away → arriving → idle
 *   - idle：常态
 *   - departing：刚触发，气泡告别中（约 5s）
 *   - away：狗狗不在桌面，渲染端显示「去旅行了」占位
 *   - arriving：明信片已生成，通知已弹出（约 5s）
 *
 * 触发条件（来自方案模块 8 / PRD 第 5 章）：
 *   - 距上次回家 ≥ intervalMinMs
 *   - 若情绪 wantsToTravel：高概率立即触发
 *   - 否则每次 check 按 normalProbability 抽签
 *
 * DESKPET_DEV=1 环境变量：缩短所有时间到秒级，便于验证完整流程。
 */

const destinations = require('../data/destinations.json');

const PROD = {
  intervalMinMs: 48 * 60 * 60_000,
  intervalMaxMs: 96 * 60 * 60_000,
  durationMinMs: 2 * 60 * 60_000,
  durationMaxMs: 6 * 60 * 60_000,
  checkIntervalMs: 10 * 60_000,
  normalProbability: 0.005,
  eagerProbability: 0.5,
};

// DEV 模式：默认不自动触发，避免连续触发干扰其它功能验证。
// 想验证旅行流程：右键菜单「[DEV] 立刻去旅行」即可
// 想测自动触发：编辑 savegame.json 把 dog.mood 改为 'wantsToTravel'
const DEV = {
  intervalMinMs: 30_000,
  intervalMaxMs: 60_000,
  durationMinMs: 30_000,
  durationMaxMs: 60_000,
  checkIntervalMs: 8_000,
  normalProbability: 0,
  eagerProbability: 0.95,
};

function isDev() {
  return process.env.DESKPET_DEV === '1';
}

function rules() {
  return isDev() ? DEV : PROD;
}

function pickDestination() {
  const list = destinations.destinations;
  if (!list || list.length === 0) return null;
  return list[Math.floor(Math.random() * list.length)];
}

function findDestination(id) {
  return destinations.destinations.find((d) => d.id === id) || null;
}

function pickLineFor(destination) {
  if (!destination || !destination.lines || destination.lines.length === 0) return null;
  return destination.lines[Math.floor(Math.random() * destination.lines.length)];
}

function shouldTriggerTravel(saveCache, nowMs = Date.now()) {
  const status = saveCache?.travel?.status || 'idle';
  if (status !== 'idle') return false;

  const r = rules();
  const lastReturn = saveCache?.travel?.lastReturnAt ? new Date(saveCache.travel.lastReturnAt).getTime() : 0;
  const sinceReturn = lastReturn > 0 ? nowMs - lastReturn : Infinity;
  if (sinceReturn < r.intervalMinMs) return false;

  const eager = saveCache?.dog?.mood === 'wantsToTravel';
  const p = eager ? r.eagerProbability : r.normalProbability;
  return Math.random() < p;
}

function randomDurationMs() {
  const r = rules();
  return r.durationMinMs + Math.random() * (r.durationMaxMs - r.durationMinMs);
}

function checkIntervalMs() {
  return rules().checkIntervalMs;
}

module.exports = {
  isDev,
  rules,
  pickDestination,
  findDestination,
  pickLineFor,
  shouldTriggerTravel,
  randomDurationMs,
  checkIntervalMs,
};
