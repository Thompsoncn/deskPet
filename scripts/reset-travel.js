/**
 * 救援脚本：把存档里 travel 状态清回 idle，并清理可能粘住的 wantsToTravel 情绪。
 *
 * 用途：当狗狗卡在「去旅行了」占位无法恢复时跑一次。
 *
 * 运行：node scripts/reset-travel.js
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

function savePath() {
  const home = os.homedir();
  if (process.platform === 'darwin') {
    return path.join(home, 'Library', 'Application Support', 'deskPet', 'savegame.json');
  }
  if (process.platform === 'win32') {
    return path.join(process.env.APPDATA || path.join(home, 'AppData', 'Roaming'), 'deskPet', 'savegame.json');
  }
  return path.join(home, '.config', 'deskPet', 'savegame.json');
}

const p = savePath();
if (!fs.existsSync(p)) {
  console.log(`存档不存在：${p}`);
  console.log('应该是首次启动，直接 npm start 即可领养。');
  process.exit(0);
}

const before = JSON.parse(fs.readFileSync(p, 'utf8'));
const lastReturnAt = before.travel?.lastReturnAt || null;
const beforeMood = before.dog?.mood;

const next = {
  ...before,
  travel: {
    status: 'idle',
    destination: null,
    departedAt: null,
    returnAt: null,
    lastReturnAt,
  },
  dog: {
    ...before.dog,
    mood: beforeMood === 'wantsToTravel' ? 'normal' : beforeMood,
  },
};

fs.writeFileSync(p, JSON.stringify(next, null, 2));
console.log('已重置：');
console.log(`  路径：${p}`);
console.log(`  travel.status：${before.travel?.status} → idle`);
if (beforeMood === 'wantsToTravel') {
  console.log(`  dog.mood：wantsToTravel → normal`);
}
console.log('现在可以 npm run start:dev 启动。');
