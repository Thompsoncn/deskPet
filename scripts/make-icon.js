/**
 * 生成占位图标 assets/icon.png（256×256 PNG，纯 Node 实现，无外部依赖）。
 *
 * 用途：electron-builder 打包时 win/mac/linux 都需要图标文件。等并行轨道 A 出真图标
 * 后，把 256×256 的 PNG 覆盖 assets/icon.png 即可（electron-builder 会自动转 .ico）。
 *
 * 运行：node scripts/make-icon.js
 */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const SIZE = 512;
const OUT_PATH = path.join(__dirname, '..', 'assets', 'icon.png');

// CRC32 实现（PNG 校验用）
const crcTable = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let j = 0; j < 8; j++) {
    c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
  }
  crcTable[i] = c;
}

function crc32(buf) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) {
    c = crcTable[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
  }
  return (c ^ 0xFFFFFFFF) >>> 0;
}

function writeChunk(type, data) {
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type);
  const combined = Buffer.concat([typeBuf, data]);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(combined), 0);
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

function makeIconPNG(size) {
  const sig = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr.writeUInt8(8, 8);  // bit depth
  ihdr.writeUInt8(6, 9);  // color type RGBA
  ihdr.writeUInt8(0, 10);
  ihdr.writeUInt8(0, 11);
  ihdr.writeUInt8(0, 12);
  const ihdrChunk = writeChunk('IHDR', ihdr);

  const cx = size / 2;
  const cy = size / 2;
  const radius = size * 0.42;
  const rowSize = 1 + size * 4;
  const raw = Buffer.alloc(rowSize * size);

  for (let y = 0; y < size; y++) {
    raw[y * rowSize] = 0;
    for (let x = 0; x < size; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const i = y * rowSize + 1 + x * 4;
      if (dist <= radius) {
        const t = dist / radius;
        raw[i] = Math.round(255 - 14 * t);
        raw[i + 1] = Math.round(184 - 64 * t);
        raw[i + 2] = Math.round(140 - 32 * t);
        raw[i + 3] = 255;
        // 简单画两个眼睛
        const eyeY = cy - size * 0.05;
        if (
          (Math.abs(x - (cx - size * 0.09)) <= 5 && Math.abs(y - eyeY) <= 5) ||
          (Math.abs(x - (cx + size * 0.09)) <= 5 && Math.abs(y - eyeY) <= 5)
        ) {
          raw[i] = 60;
          raw[i + 1] = 50;
          raw[i + 2] = 40;
        }
        // 嘴
        const mouthY = cy + size * 0.06;
        if (Math.abs(y - mouthY) <= 2 && Math.abs(x - cx) <= size * 0.07) {
          raw[i] = 60;
          raw[i + 1] = 50;
          raw[i + 2] = 40;
        }
      } else if (dist <= radius + 1.5) {
        raw[i + 3] = Math.round(255 * (1 - (dist - radius) / 1.5));
      }
    }
  }

  const idatChunk = writeChunk('IDAT', zlib.deflateSync(raw));
  const iendChunk = writeChunk('IEND', Buffer.alloc(0));
  return Buffer.concat([sig, ihdrChunk, idatChunk, iendChunk]);
}

fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
fs.writeFileSync(OUT_PATH, makeIconPNG(SIZE));
console.log(`Generated ${OUT_PATH} (${SIZE}×${SIZE} placeholder icon)`);
