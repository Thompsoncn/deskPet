/**
 * 明信片合成器（渲染端）
 *
 * 1200×800 canvas，主进程通过 executeJavaScript 调用 window.deskPetPostcard.render(...)
 * 拿到 data URL 后由主进程落盘到 userData/postcards/。
 *
 * 没有真景图时退化为渐变 + 几条简笔山线，保证占位也能截图分享不丢人。
 */

const W = 1200;
const H = 800;

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`load failed: ${src}`));
    img.src = src;
  });
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const chars = Array.from(text);
  let line = '';
  let curY = y;
  for (const ch of chars) {
    const test = line + ch;
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, curY);
      line = ch;
      curY += lineHeight;
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line, x, curY);
  return curY;
}

function drawProceduralScenery(ctx, destination) {
  const [c1, c2] = destination.bgColor || ['#f4a261', '#e76f51'];
  // 天空渐变
  const sky = ctx.createLinearGradient(0, 0, 0, H * 0.7);
  sky.addColorStop(0, lighten(c1, 0.18));
  sky.addColorStop(1, c1);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H * 0.7);

  // 太阳
  ctx.fillStyle = 'rgba(255, 240, 200, 0.85)';
  ctx.beginPath();
  ctx.arc(W * 0.78, H * 0.22, 64, 0, Math.PI * 2);
  ctx.fill();

  // 远山
  ctx.fillStyle = darken(c2, 0.1);
  ctx.beginPath();
  ctx.moveTo(0, H * 0.6);
  ctx.lineTo(W * 0.2, H * 0.42);
  ctx.lineTo(W * 0.35, H * 0.55);
  ctx.lineTo(W * 0.55, H * 0.38);
  ctx.lineTo(W * 0.72, H * 0.5);
  ctx.lineTo(W * 0.9, H * 0.36);
  ctx.lineTo(W, H * 0.48);
  ctx.lineTo(W, H * 0.7);
  ctx.lineTo(0, H * 0.7);
  ctx.closePath();
  ctx.fill();

  // 近景
  ctx.fillStyle = c2;
  ctx.fillRect(0, H * 0.7, W, H * 0.3);

  // 一棵小树
  ctx.fillStyle = 'rgba(60, 50, 40, 0.5)';
  ctx.fillRect(180, H * 0.66, 6, 30);
  ctx.beginPath();
  ctx.arc(183, H * 0.66 - 6, 22, 0, Math.PI * 2);
  ctx.fill();
}

function lighten(hex, amt) {
  return mix(hex, '#ffffff', amt);
}
function darken(hex, amt) {
  return mix(hex, '#000000', amt);
}
function mix(hex1, hex2, amt) {
  const [r1, g1, b1] = parseHex(hex1);
  const [r2, g2, b2] = parseHex(hex2);
  const r = Math.round(r1 + (r2 - r1) * amt);
  const g = Math.round(g1 + (g2 - g1) * amt);
  const b = Math.round(b1 + (b2 - b1) * amt);
  return `rgb(${r}, ${g}, ${b})`;
}
function parseHex(hex) {
  const s = hex.startsWith('#') ? hex.slice(1) : hex;
  const r = parseInt(s.slice(0, 2), 16);
  const g = parseInt(s.slice(2, 4), 16);
  const b = parseInt(s.slice(4, 6), 16);
  return [r, g, b];
}

function drawDogSilhouette(ctx, cx, cy, size, color) {
  ctx.fillStyle = color;
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 4;
  const r = size / 2;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  // 眼睛
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(cx - r * 0.3, cy - r * 0.15, r * 0.12, 0, Math.PI * 2);
  ctx.arc(cx + r * 0.3, cy - r * 0.15, r * 0.12, 0, Math.PI * 2);
  ctx.fill();
}

function drawStamp(ctx, x, y, destination, dateStr) {
  ctx.save();
  ctx.translate(x, y);
  // 邮票纸底
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#8a7762';
  ctx.lineWidth = 2;
  ctx.setLineDash([4, 3]);
  roundRect(ctx, 0, 0, 130, 90, 6);
  ctx.fill();
  ctx.stroke();
  ctx.setLineDash([]);
  // 邮戳印章
  ctx.strokeStyle = 'rgba(180, 60, 60, 0.75)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(65, 38, 28, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = 'rgba(180, 60, 60, 0.75)';
  ctx.font = 'bold 14px "PingFang SC", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(destination.name, 65, 36);
  ctx.font = '10px "PingFang SC", sans-serif';
  ctx.fillText(dateStr, 65, 50);
  ctx.textAlign = 'left';
  ctx.restore();
}

const BREED_COLORS = {
  shiba: '#ff9a76',
  corgi: '#fdcb6e',
  golden: '#f6b93b',
  husky: '#74b9ff',
  teddy: '#d4a373',
  zhongtian: '#e8a87c',
};

async function render({ destination, breed, dogName, line, dateStr, watermark }) {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');

  // 1. 背景：优先用真景图，回退到程序化绘制
  let usedRealImage = false;
  try {
    const bg = await loadImage(`../assets/postcards/scenes/${destination.id}.jpg`);
    ctx.drawImage(bg, 0, 0, W, H);
    usedRealImage = true;
  } catch {
    drawProceduralScenery(ctx, destination);
  }

  // 2. 半透明遮罩，让文字更清晰
  if (usedRealImage) {
    const overlay = ctx.createLinearGradient(0, H * 0.45, 0, H);
    overlay.addColorStop(0, 'rgba(0,0,0,0)');
    overlay.addColorStop(1, 'rgba(0,0,0,0.35)');
    ctx.fillStyle = overlay;
    ctx.fillRect(0, 0, W, H);
  }

  // 3. 明信片白色内边框
  ctx.strokeStyle = 'rgba(255,255,255,0.95)';
  ctx.lineWidth = 14;
  ctx.strokeRect(20, 20, W - 40, H - 40);

  // 4. 邮戳（右上）
  drawStamp(ctx, W - 170, 50, destination, dateStr);

  // 5. 狗狗剪影（左上）
  drawDogSilhouette(ctx, 110, 110, 80, BREED_COLORS[breed] || '#ff9a76');

  // 6. 底部文字面板
  const panelX = 60;
  const panelY = 540;
  const panelW = W - 120;
  const panelH = 220;
  ctx.fillStyle = 'rgba(255,255,255,0.94)';
  ctx.shadowColor = 'rgba(0,0,0,0.18)';
  ctx.shadowBlur = 12;
  ctx.shadowOffsetY = 4;
  roundRect(ctx, panelX, panelY, panelW, panelH, 18);
  ctx.fill();
  ctx.shadowColor = 'transparent';

  // 7. 目的地名 + 副标
  ctx.fillStyle = '#4a3c2e';
  ctx.font = 'bold 34px "PingFang SC", "Microsoft YaHei", sans-serif';
  ctx.fillText(destination.name, panelX + 32, panelY + 50);
  if (destination.subtitle) {
    ctx.font = '18px "PingFang SC", "Microsoft YaHei", sans-serif';
    ctx.fillStyle = '#8a7762';
    ctx.fillText(destination.subtitle, panelX + 32, panelY + 76);
  }

  // 8. 正文（来自目的地 lines 之一）
  ctx.fillStyle = '#4a3c2e';
  ctx.font = '24px "PingFang SC", "Microsoft YaHei", sans-serif';
  wrapText(ctx, line, panelX + 32, panelY + 120, panelW - 64, 34);

  // 9. 签名
  ctx.font = 'italic 20px "PingFang SC", sans-serif';
  ctx.fillStyle = '#8a7762';
  const sig = `— 你的 ${dogName} · ${dateStr}`;
  ctx.fillText(sig, panelX + 32, panelY + panelH - 24);

  // 10. 水印
  ctx.font = '14px sans-serif';
  ctx.fillStyle = 'rgba(74,60,46,0.55)';
  ctx.textAlign = 'right';
  ctx.fillText(watermark || 'deskPet', W - 36, H - 32);
  ctx.textAlign = 'left';

  return canvas.toDataURL('image/png');
}

window.deskPetPostcard = { render };
