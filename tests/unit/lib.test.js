/**
 * 纯逻辑模块单元测试（node --test）
 *
 * 运行：npm run test:unit  或  node --test tests/unit/
 */

const { test } = require('node:test');
const assert = require('node:assert');

const stats = require('../../lib/stats');
const speech = require('../../lib/speech');
const travel = require('../../lib/travel');

// ---------------------- stats ----------------------

test('stats: expForNextLevel 公式 50 + level*30', () => {
  assert.equal(stats.expForNextLevel(1), 80);
  assert.equal(stats.expForNextLevel(19), 620);
});

test('stats: applyExpGain 简单累积不升级', () => {
  const r = stats.applyExpGain({ level: 1, exp: 0, dailyExp: 0, dailyExpDate: null }, 30, new Date('2026-05-25T10:00:00'));
  assert.equal(r.level, 1);
  assert.equal(r.exp, 30);
  assert.equal(r.leveledUp, false);
});

test('stats: applyExpGain 跨一级', () => {
  const r = stats.applyExpGain({ level: 1, exp: 70, dailyExp: 0, dailyExpDate: null }, 20, new Date('2026-05-25T10:00:00'));
  assert.equal(r.level, 2);
  assert.equal(r.exp, 10);
  assert.equal(r.leveledUp, true);
});

test('stats: applyExpGain 一次跨多级', () => {
  const r = stats.applyExpGain({ level: 1, exp: 0, dailyExp: 0, dailyExpDate: null }, 250, new Date('2026-05-25T10:00:00'));
  assert.equal(r.level, 3); // 80 + 110 消耗，余 60
  assert.equal(r.exp, 60);
});

test('stats: 每日经验软上限 300', () => {
  const r = stats.applyExpGain({ level: 1, exp: 0, dailyExp: 290, dailyExpDate: '2026-05-25' }, 50, new Date('2026-05-25T10:00:00'));
  assert.equal(r.gained, 10);
  assert.equal(r.dailyExp, 300);
});

test('stats: 跨日重置每日经验', () => {
  const r = stats.applyExpGain({ level: 1, exp: 0, dailyExp: 300, dailyExpDate: '2026-05-25' }, 50, new Date('2026-05-26T10:00:00'));
  assert.equal(r.gained, 50);
  assert.equal(r.dailyExp, 50);
});

test('stats: 满级不再加经验', () => {
  const r = stats.applyExpGain({ level: 20, exp: 0, dailyExp: 0, dailyExpDate: null }, 100, new Date('2026-05-25T10:00:00'));
  assert.equal(r.level, 20);
  assert.equal(r.leveledUp, false);
});

test('stats: computeMood 优先级 hungry > happy > bored > normal', () => {
  const now = new Date('2026-05-25T12:00:00').getTime();
  const base = { dog: { mood: 'normal', hunger: 80, adoptedAt: '2026-05-25T11:40:00' }, interactions: {} };
  assert.equal(stats.computeMood(base, now), 'normal');

  base.interactions.lastPlayAt = '2026-05-25T11:59:00';
  assert.equal(stats.computeMood(base, now), 'happy');

  base.interactions = { lastPlayAt: '2026-05-25T11:00:00', lastFeedAt: '2026-05-25T11:00:00' };
  base.dog.adoptedAt = '2026-05-25T08:00:00';
  assert.equal(stats.computeMood(base, now), 'bored');

  base.dog.hunger = 20;
  assert.equal(stats.computeMood(base, now), 'hungry');

  base.dog.mood = 'wantsToTravel';
  assert.equal(stats.computeMood(base, now), 'wantsToTravel');
});

test('stats: decayHunger 每分钟 -0.5 且 clamp', () => {
  assert.equal(stats.decayHunger(80, 1), 79.5);
  assert.equal(stats.decayHunger(80, 10), 75);
  assert.equal(stats.decayHunger(0.1, 5), 0);
});

// ---------------------- speech ----------------------

test('speech: pickLine 返回非空字符串', () => {
  const line = speech.pickLine({ mood: 'happy', breed: 'shiba' });
  assert.equal(typeof line, 'string');
  assert.ok(line.length > 0);
});

test('speech: 多次抽样覆盖多条台词', () => {
  const seen = new Set();
  for (let i = 0; i < 200; i++) seen.add(speech.pickLine({ mood: 'happy', breed: 'shiba' }));
  assert.ok(seen.size > 3);
});

test('speech: timeBucket 分时段', () => {
  assert.equal(speech.timeBucket(new Date('2026-05-25T08:00:00')), 'morning');
  assert.equal(speech.timeBucket(new Date('2026-05-25T12:30:00')), 'mealtime');
  assert.equal(speech.timeBucket(new Date('2026-05-25T18:00:00')), 'mealtime');
  assert.equal(speech.timeBucket(new Date('2026-05-25T23:30:00')), 'night');
  assert.equal(speech.timeBucket(new Date('2026-05-25T15:00:00')), null);
});

test('speech: 安静模式不说话', () => {
  assert.equal(speech.canSpeak({ quietMode: true }), false);
});

test('speech: 从未说话过时可说', () => {
  assert.equal(speech.canSpeak({}, 25, new Date(0)), true);
});

test('speech: getEventLine 已知/未知事件', () => {
  assert.equal(typeof speech.getEventLine('levelUp'), 'string');
  assert.equal(speech.getEventLine('nonexistent'), null);
});

// ---------------------- travel ----------------------

test('travel: pickDestination / findDestination', () => {
  const d = travel.pickDestination();
  assert.ok(d && d.id && d.name);
  assert.equal(travel.findDestination('xinjiang')?.name, '新疆');
  assert.equal(travel.findDestination('nope'), null);
});

test('travel: shouldTriggerTravel 非 idle 不触发', () => {
  const save = { dog: { mood: 'normal' }, travel: { status: 'away', lastReturnAt: null } };
  assert.equal(travel.shouldTriggerTravel(save), false);
});

test('travel: 距上次回家不足间隔不触发', () => {
  const save = {
    dog: { mood: 'wantsToTravel' },
    travel: { status: 'idle', lastReturnAt: new Date(Date.now() - 60_000).toISOString() },
  };
  assert.equal(travel.shouldTriggerTravel(save), false);
});
