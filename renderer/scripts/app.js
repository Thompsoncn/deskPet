/**
 * 桌面狗狗主窗口入口（外部脚本）
 *
 * 注意：必须是外部文件，不能内联到 index.html。
 * index.html 的 CSP 是 default-src 'self'，会拦截内联 <script>。
 * 外部脚本从 'self' 加载是允许的。
 */

// ---- DOM refs（脚本在 body 末尾加载，元素一定已存在）----
const pet = document.getElementById('pet');
const badge = document.getElementById('badge');
const bubble = document.getElementById('bubble');
const away = document.getElementById('away');

// ---- 同步 helpers，监听器触发时一定可用 ----
function applyTravelStatus(status) {
  const isAway = status === 'away';
  pet.style.display = isAway ? 'none' : '';
  away.hidden = !isAway;
}

let badgeTimer = null;
function showBadge(text, durationMs) {
  badge.textContent = text;
  badge.classList.add('badge--show');
  if (badgeTimer) clearTimeout(badgeTimer);
  badgeTimer = setTimeout(() => badge.classList.remove('badge--show'), durationMs);
}

let bubbleTimer = null;
function showBubble(text, durationMs) {
  bubble.textContent = text;
  bubble.classList.add('bubble--show');
  if (bubbleTimer) clearTimeout(bubbleTimer);
  bubbleTimer = setTimeout(() => bubble.classList.remove('bubble--show'), durationMs);
}

// 全局右键监听，避免 -webkit-app-region: drag 吞掉 contextmenu 事件
document.body.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  window.deskPet?.showContextMenu();
});

let animator = null;
const BADGE_LABELS = { eat: '正在进食…', play: '在玩耍…' };

// ---- IPC 监听器同步注册（避免与主进程初始化广播竞态）----
window.deskPet?.onPetAction?.((payload) => {
  if (!payload?.type) return;
  if (payload.type === 'levelup') {
    showBadge(`升级！Lv ${payload.level}`, payload.durationMs || 2500);
    animator?.playTransient('levelup', payload.durationMs || 2500);
    return;
  }
  const label = BADGE_LABELS[payload.type];
  if (label) showBadge(label, payload.durationMs || 2500);
  animator?.playTransient(payload.type, payload.durationMs || 2500);
});

window.deskPet?.onPetState?.((payload) => {
  if (payload?.mood) animator?.setMood(payload.mood);
  if (payload?.travelStatus) applyTravelStatus(payload.travelStatus);
});

window.deskPet?.onPetSpeak?.((payload) => {
  if (payload?.text) showBubble(payload.text, payload.durationMs || 4500);
});

// ---- 异步：只 animator 初始化要等 IPC + 帧加载 ----
(async () => {
  console.log('[setup] start');
  const save = await window.deskPet?.getSave?.();
  console.log('[setup] save loaded, status=', save?.travel?.status, 'mood=', save?.dog?.mood, 'breed=', save?.dog?.breed);
  const breed = save?.dog?.breed || 'shiba';
  const initialMood = save?.dog?.mood || 'normal';

  animator = new Animator(pet, { breed, action: 'idle', mood: initialMood });
  await animator.load('idle');
  animator.start();
  console.log('[setup] animator started, mode=', animator.mode, 'frames=', animator.frames.length);

  applyTravelStatus(save?.travel?.status || 'idle');
  console.log('[setup] applyTravelStatus done, pet.display=', pet.style.display, 'away.hidden=', away.hidden);

  window.deskPet?.onFocusChange?.((focused) => {
    animator.setFps(focused ? window.ANIMATOR_FPS.ACTIVE : window.ANIMATOR_FPS.IDLE);
  });

  // 二次拉取：setup 期间主进程可能已经转走过状态
  const freshSave = await window.deskPet?.getSave?.();
  if (freshSave) {
    if (freshSave.dog?.mood) animator.setMood(freshSave.dog.mood);
    applyTravelStatus(freshSave.travel?.status || 'idle');
  }
})();
