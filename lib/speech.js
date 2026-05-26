/**
 * 主动搭话台词模块（主进程）
 *
 * 设计要点（方案模块 7 / PRD 第 6 章）：
 *   - 台词来源：data/lines.json，按 byMood/byBreed/byTime/byEvent 分桶
 *   - 随机说话频率：每 15-20 分钟尝试一次
 *   - 每日上限：默认 25 次，跨日重置
 *   - 安静模式：直接跳过所有尝试（事件类如升级也跳过）
 *   - 加权抽桶：mood 3、breed 2、time 2（无 time 桶则跳过）
 *
 * lastSpokenAt / dailyCount 只在内存里，关机重开会重置——PRD 不要求持久化。
 */

const lines = require('../data/lines.json');

const MIN_INTERVAL_MS = 15 * 60_000;
const MAX_INTERVAL_MS = 20 * 60_000;
const DEFAULT_DAILY_LIMIT = 25;
// 启动后首次说话用较短延迟，便于用户验证
const INITIAL_DELAY_MIN_MS = 30_000;
const INITIAL_DELAY_MAX_MS = 90_000;

let lastSpokenAt = 0;
let dailyCount = 0;
let dailyDate = null;

// 本地日切，避免 UTC 时区下「明天」实际是用户本地的「今晚」
function todayIso(now = new Date()) {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function resetDailyIfNeeded(now = new Date()) {
  const today = todayIso(now);
  if (dailyDate !== today) {
    dailyDate = today;
    dailyCount = 0;
  }
}

function timeBucket(now = new Date()) {
  const h = now.getHours();
  // 饭点优先于 morning（11-14 既算 mealtime 也算上午尾）
  if ((h >= 11 && h < 14) || (h >= 17 && h < 20)) return 'mealtime';
  if (h >= 5 && h < 11) return 'morning';
  if (h >= 22 || h < 5) return 'night';
  return null;
}

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function pickWeighted(buckets) {
  const validBuckets = buckets.filter((b) => b.items && b.items.length > 0);
  if (validBuckets.length === 0) return null;
  const total = validBuckets.reduce((s, b) => s + b.weight, 0);
  let r = Math.random() * total;
  for (const b of validBuckets) {
    if (r < b.weight) return pickRandom(b.items);
    r -= b.weight;
  }
  return pickRandom(validBuckets[validBuckets.length - 1].items);
}

function pickLine({ mood, breed, now = new Date() } = {}) {
  const buckets = [
    { weight: 3, items: lines.byMood?.[mood] },
    { weight: 2, items: lines.byBreed?.[breed] },
  ];
  const tb = timeBucket(now);
  if (tb) buckets.push({ weight: 2, items: lines.byTime?.[tb] });
  return pickWeighted(buckets);
}

function getEventLine(eventName) {
  const arr = lines.byEvent?.[eventName];
  if (!arr || arr.length === 0) return null;
  return pickRandom(arr);
}

function canSpeak({ quietMode } = {}, dailyLimit = DEFAULT_DAILY_LIMIT, now = new Date()) {
  if (quietMode) return false;
  resetDailyIfNeeded(now);
  if (dailyCount >= dailyLimit) return false;
  if (lastSpokenAt > 0 && now.getTime() - lastSpokenAt < MIN_INTERVAL_MS - 1000) return false;
  return true;
}

function recordSpoken(now = new Date()) {
  resetDailyIfNeeded(now);
  lastSpokenAt = now.getTime();
  dailyCount += 1;
}

function nextDelayMs() {
  return MIN_INTERVAL_MS + Math.random() * (MAX_INTERVAL_MS - MIN_INTERVAL_MS);
}

function initialDelayMs() {
  return INITIAL_DELAY_MIN_MS + Math.random() * (INITIAL_DELAY_MAX_MS - INITIAL_DELAY_MIN_MS);
}

module.exports = {
  pickLine,
  getEventLine,
  canSpeak,
  recordSpoken,
  nextDelayMs,
  initialDelayMs,
  timeBucket,
  MIN_INTERVAL_MS,
  MAX_INTERVAL_MS,
  DEFAULT_DAILY_LIMIT,
};
