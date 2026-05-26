/**
 * 帧动画播放器
 *
 * 两种渲染模式：
 *   - 'frames'：从 assets/breeds/{breed}/{action}/frame_NNN.png 加载真帧并按 fps 切换
 *   - 'procedural'：没有真帧时退化为画布上画的占位狗
 *
 * 模块 5 起：playTransient 播放瞬态动作（eat/play/levelup）后自动回 idle
 * 模块 6 起：setMood 切换情绪，procedural 模式按情绪上色（happy/hungry/bored/wantsToTravel/normal）
 */

const FRAME_PATH = (breed, action, idx) =>
  `../assets/breeds/${breed}/${action}/frame_${String(idx).padStart(3, '0')}.png`;

const FPS_ACTIVE = 10;
const FPS_IDLE = 4;

// 占位狗的情绪配色（PNG 帧到位后这些不会被用到）
const MOOD_COLORS = {
  happy:          { top: '#ffd166', bot: '#ff7676', breath: { speed: 3, amp: 0.06 } },
  normal:         { top: '#ffb88c', bot: '#ff7676', breath: { speed: 2, amp: 0.04 } },
  hungry:         { top: '#d4a373', bot: '#a0826d', breath: { speed: 1.2, amp: 0.025 } },
  bored:          { top: '#b8b3ad', bot: '#8a857f', breath: { speed: 1, amp: 0.02 } },
  wantsToTravel:  { top: '#a8d8ea', bot: '#7eb9d2', breath: { speed: 1.6, amp: 0.035 } },
};

class Animator {
  constructor(canvas, { breed = 'shiba', action = 'idle', mood = 'normal' } = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.breed = breed;
    this.action = action;
    this.mood = mood;
    this.fps = FPS_ACTIVE;
    this.tick = 0;
    this.timer = null;
    this.transientTimer = null;
    this.mode = 'procedural';
    this.frames = [];
  }

  async load(action = this.action) {
    this.action = action;
    this.tick = 0;
    const count = await window.deskPet.countFrames(this.breed, action);
    if (count > 0) {
      this.frames = await this._preloadImages(count);
      this.mode = this.frames.length === count ? 'frames' : 'procedural';
    } else {
      this.mode = 'procedural';
      this.frames = [];
    }
  }

  _preloadImages(count) {
    const promises = Array.from({ length: count }, (_, i) => {
      return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => resolve(null);
        img.src = FRAME_PATH(this.breed, this.action, i + 1);
      });
    });
    return Promise.all(promises).then((imgs) => imgs.filter(Boolean));
  }

  start() {
    this.stop();
    this.timer = setInterval(() => this._render(), 1000 / this.fps);
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  setFps(fps) {
    this.fps = fps;
    if (this.timer) this.start();
  }

  setMood(mood) {
    if (mood && MOOD_COLORS[mood]) this.mood = mood;
  }

  async playTransient(action, durationMs = 2500) {
    if (this.transientTimer) clearTimeout(this.transientTimer);
    await this.load(action);
    this.start();
    this.transientTimer = setTimeout(async () => {
      this.transientTimer = null;
      await this.load('idle');
      this.start();
    }, durationMs);
  }

  _render() {
    this.tick++;
    if (this.mode === 'frames' && this.frames.length > 0) {
      this._drawFrame();
    } else {
      this._drawProcedural();
    }
  }

  _drawFrame() {
    const idx = this.tick % this.frames.length;
    const img = this.frames[idx];
    const { width: W, height: H } = this.canvas;
    this.ctx.clearRect(0, 0, W, H);
    this.ctx.drawImage(img, 0, 0, W, H);
  }

  _drawProcedural() {
    const { width: W, height: H } = this.canvas;
    const ctx = this.ctx;
    ctx.clearRect(0, 0, W, H);

    const t = this.tick / this.fps;

    // 颜色与呼吸节奏：瞬态动作（eat/play/levelup）覆盖情绪配色
    let palette = MOOD_COLORS[this.mood] || MOOD_COLORS.normal;
    if (this.action === 'play') palette = { top: '#ffd166', bot: '#ff7676', breath: { speed: 6, amp: 0.08 } };
    else if (this.action === 'eat') palette = { top: '#ff9a76', bot: '#e76f51', breath: { speed: 4, amp: 0.06 } };
    else if (this.action === 'levelup') palette = { top: '#ffe066', bot: '#f4a261', breath: { speed: 8, amp: 0.1 } };

    const breathScale = 1 + palette.breath.amp * Math.sin(t * palette.breath.speed);
    const cx = W / 2;
    const cy = H / 2;
    const r = 90 * breathScale;

    const grad = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
    grad.addColorStop(0, palette.top);
    grad.addColorStop(1, palette.bot);

    ctx.fillStyle = grad;
    ctx.shadowColor = 'rgba(0, 0, 0, 0.2)';
    ctx.shadowBlur = 16;
    ctx.shadowOffsetY = 8;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowColor = 'transparent';

    // 眼睛：眨眼频率随情绪
    ctx.fillStyle = 'rgba(255, 255, 255, 0.88)';
    const blinkCycle = this.mood === 'bored' ? 4 : 6;
    const blinkPhase = Math.floor(t) % blinkCycle;
    const eyeOpen = blinkPhase !== (blinkCycle - 1);
    const eyeR = eyeOpen ? 6 : 1.5;
    // hungry / bored 眼神往下
    const eyeDy = (this.mood === 'hungry' || this.mood === 'bored') ? -6 : -12;
    ctx.beginPath();
    ctx.arc(cx - 22, cy + eyeDy, eyeR, 0, Math.PI * 2);
    ctx.arc(cx + 22, cy + eyeDy, eyeR, 0, Math.PI * 2);
    ctx.fill();

    // 嘴型：按 action 或 mood 调整
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    if (this.action === 'eat') {
      ctx.arc(cx, cy + 16, 12, 0.1, Math.PI - 0.1);
    } else if (this.action === 'play' || this.mood === 'happy') {
      ctx.arc(cx, cy + 12, 14, 0, Math.PI);
    } else if (this.mood === 'hungry' || this.mood === 'bored') {
      // 倒微笑
      ctx.arc(cx, cy + 24, 10, Math.PI, 0);
    } else {
      ctx.arc(cx, cy + 14, 10, 0, Math.PI);
    }
    ctx.stroke();

    // levelup：星星粒子
    if (this.action === 'levelup') {
      this._drawSparkles(ctx, cx, cy, t);
    }
  }

  _drawSparkles(ctx, cx, cy, t) {
    const count = 6;
    ctx.fillStyle = '#fff7c0';
    ctx.strokeStyle = '#ffd166';
    ctx.lineWidth = 1.5;
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + t * 2;
      const dist = 100 + Math.sin(t * 3 + i) * 6;
      const sx = cx + Math.cos(angle) * dist;
      const sy = cy + Math.sin(angle) * dist;
      const size = 4 + Math.abs(Math.sin(t * 4 + i)) * 3;
      this._star(ctx, sx, sy, size);
      ctx.fill();
      ctx.stroke();
    }
  }

  _star(ctx, x, y, r) {
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
      const rr = i % 2 === 0 ? r : r * 0.45;
      const px = x + Math.cos(a) * rr;
      const py = y + Math.sin(a) * rr;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
  }
}

window.Animator = Animator;
window.ANIMATOR_FPS = { ACTIVE: FPS_ACTIVE, IDLE: FPS_IDLE };
