/**
 * 数值系统（纯函数 / 主进程）
 *
 * 不直接依赖 save 模块，只接收 dog/save 对象返回新字段，便于单测。
 *
 * 规则（来自方案模块 6 / PRD 第 4 章）：
 *   - hunger 语义：饱腹度 0–100（0=极饿，100=极饱）
 *   - 每分钟 -0.5；< 30 触发 hungry
 *   - 等级 1–20，升级所需 exp = 50 + level * 30
 *   - 每日 exp 软上限 300（按本地日切，跨日重置）
 *   - 情绪机：wantsToTravel(外部) > hungry > happy > bored > normal
 */

const MAX_LEVEL = 20;
const HUNGER_MIN = 0;
const HUNGER_MAX = 100;
const HUNGER_DECAY_PER_MIN = 0.5;
const HUNGER_HUNGRY_THRESHOLD = 30;
const HAPPY_WINDOW_MS = 5 * 60_000;
const BORED_THRESHOLD_MS = 30 * 60_000;
const DAILY_EXP_CAP = 300;

const MOODS = ['happy', 'normal', 'bored', 'hungry', 'wantsToTravel'];

function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}

function expForNextLevel(level) {
  return 50 + level * 30;
}

// 本地日切（与 lib/speech.js 一致）：每日上限按用户本地时间重置
function todayIso(now = new Date()) {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * 返回经验/等级变更后的新 dog 子集字段（不修改入参）。
 * 已达 MAX_LEVEL 后不再增加 exp，但 dailyExp 仍计入（保持上限统计准确）。
 */
function applyExpGain(dog, baseAmount, now = new Date()) {
  const today = todayIso(now);
  const dailyDate = dog.dailyExpDate;
  const dailyExp = dailyDate === today ? (dog.dailyExp || 0) : 0;

  let level = dog.level || 1;
  let exp = dog.exp || 0;

  const allowed = Math.max(0, Math.min(baseAmount, DAILY_EXP_CAP - dailyExp));

  if (level >= MAX_LEVEL) {
    return { exp, level, dailyExp: dailyExp + allowed, dailyExpDate: today, leveledUp: false, gained: 0 };
  }

  exp += allowed;
  let leveledUp = false;
  while (level < MAX_LEVEL && exp >= expForNextLevel(level)) {
    exp -= expForNextLevel(level);
    level++;
    leveledUp = true;
  }
  if (level >= MAX_LEVEL) exp = 0;

  return {
    exp,
    level,
    dailyExp: dailyExp + allowed,
    dailyExpDate: today,
    leveledUp,
    gained: allowed,
  };
}

/**
 * 计算当前应处的情绪。wantsToTravel 由模块 8 设置，本函数保留之。
 * 其余按优先级：hungry > happy > bored > normal。
 */
function computeMood(save, nowMs = Date.now()) {
  if (save?.dog?.mood === 'wantsToTravel') return 'wantsToTravel';

  const hunger = save?.dog?.hunger ?? HUNGER_MAX;
  if (hunger < HUNGER_HUNGRY_THRESHOLD) return 'hungry';

  const lastFeed = save?.interactions?.lastFeedAt ? new Date(save.interactions.lastFeedAt).getTime() : 0;
  const lastPlay = save?.interactions?.lastPlayAt ? new Date(save.interactions.lastPlayAt).getTime() : 0;
  const lastInteraction = Math.max(lastFeed, lastPlay);
  const adoptedMs = save?.dog?.adoptedAt ? new Date(save.dog.adoptedAt).getTime() : nowMs;
  // 取「最后一次让狗狗开心的事件」作为无聊判定的基准（包括领养这件事）
  const lastEvent = Math.max(lastInteraction, adoptedMs);
  const sinceLastEvent = nowMs - lastEvent;

  if (lastInteraction > 0 && nowMs - lastInteraction < HAPPY_WINDOW_MS) return 'happy';
  if (sinceLastEvent > BORED_THRESHOLD_MS) return 'bored';
  return 'normal';
}

function decayHunger(current, deltaMinutes) {
  return clamp((current ?? HUNGER_MAX) - HUNGER_DECAY_PER_MIN * deltaMinutes, HUNGER_MIN, HUNGER_MAX);
}

module.exports = {
  MAX_LEVEL,
  HUNGER_MIN,
  HUNGER_MAX,
  HUNGER_DECAY_PER_MIN,
  HUNGER_HUNGRY_THRESHOLD,
  HAPPY_WINDOW_MS,
  BORED_THRESHOLD_MS,
  DAILY_EXP_CAP,
  MOODS,
  clamp,
  expForNextLevel,
  applyExpGain,
  computeMood,
  decayHunger,
};
