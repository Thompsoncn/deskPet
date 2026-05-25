/**
 * 帧动画播放器
 *
 * 两种渲染模式：
 *   - 'frames'：从 assets/breeds/{breed}/{action}/frame_NNN.png 加载真帧并按 fps 切换
 *   - 'procedural'：没有真帧时退化为画布上画的占位狗（橙色圆 + 呼吸缩放）
 *
 * Module 3 接管后，breed 从存档读取；当前默认 'shiba'。
 */

const FRAME_PATH = (breed, action, idx) =>
  `../assets/breeds/${breed}/${action}/frame_${String(idx).padStart(3, '0')}.png`;

const FPS_ACTIVE = 10;
const FPS_IDLE = 4;

class Animator {
  constructor(canvas, { breed = 'shiba', action = 'idle' } = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.breed = breed;
    this.action = action;
    this.fps = FPS_ACTIVE;
    this.tick = 0;
    this.timer = null;
    this.mode = 'procedural';
    this.frames = [];
  }

  async load(action = this.action) {
    this.action = action;
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
    const breathScale = 1 + 0.04 * Math.sin(t * 2);
    const cx = W / 2;
    const cy = H / 2;
    const r = 90 * breathScale;

    const grad = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
    grad.addColorStop(0, '#ffb88c');
    grad.addColorStop(1, '#ff7676');

    ctx.fillStyle = grad;
    ctx.shadowColor = 'rgba(0, 0, 0, 0.2)';
    ctx.shadowBlur = 16;
    ctx.shadowOffsetY = 8;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();

    ctx.shadowColor = 'transparent';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    const blinkPhase = Math.floor(t) % 6;
    const eyeOpen = blinkPhase !== 5;
    const eyeR = eyeOpen ? 6 : 1.5;
    ctx.beginPath();
    ctx.arc(cx - 22, cy - 12, eyeR, 0, Math.PI * 2);
    ctx.arc(cx + 22, cy - 12, eyeR, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy + 14, 10, 0, Math.PI);
    ctx.stroke();
  }
}

window.Animator = Animator;
window.ANIMATOR_FPS = { ACTIVE: FPS_ACTIVE, IDLE: FPS_IDLE };
