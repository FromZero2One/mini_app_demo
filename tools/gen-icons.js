/**
 * tabBar 图标生成脚本（零依赖，仅用 Node 内置模块）
 *
 * 用法：node tools/gen-icons.js
 * 输出：demo-app/images/tab-*.png（81x81，微信 tabBar 推荐尺寸）
 *
 * 原理：先用 Node 内置 zlib 手写 PNG 编码器，
 *       再以 4 倍超采样绘制简单几何图形并降采样，得到抗锯齿图标。
 * 想改颜色/形状：修改下方的 COLORS 和 drawHome / drawList / drawAbout 即可。
 */
const zlib = require('zlib');
const fs = require('fs');
const path = require('path');

const SIZE = 81;        // 输出尺寸（px）
const SS = 4;           // 超采样倍数
const N = SIZE * SS;    // 渲染分辨率 324

/** 图标颜色：普通态灰、选中态蓝（与 app.json 的 tabBar 配色一致） */
const COLORS = {
  normal: [153, 153, 153, 255], // #999999
  active: [26, 115, 232, 255],  // #1a73e8
};

// ---------------- PNG 编码 ----------------
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const out = Buffer.alloc(8 + data.length + 4);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 'ascii');
  data.copy(out, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
}

function savePNG(file, size, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // color type: RGBA
  const stride = size * 4;
  const raw = Buffer.alloc((stride + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (stride + 1)] = 0; // filter: none
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
  fs.writeFileSync(file, png);
  console.log('已生成', path.relative(process.cwd(), file));
}

// ---------------- 极简画布（超采样渲染）----------------
class Canvas {
  constructor() {
    this.n = N;
    this.buf = Buffer.alloc(N * N * 4);
  }
  blend(x, y, color) {
    if (x < 0 || y < 0 || x >= this.n || y >= this.n) return;
    const i = (y * this.n + x) * 4;
    const a = color[3] / 255;
    const b = this.buf;
    b[i] = Math.round(color[0] * a + b[i] * (1 - a));
    b[i + 1] = Math.round(color[1] * a + b[i + 1] * (1 - a));
    b[i + 2] = Math.round(color[2] * a + b[i + 2] * (1 - a));
    b[i + 3] = Math.max(b[i + 3], Math.round(a * 255));
  }
  clearRect(x0, y0, x1, y1) {
    for (let y = Math.round(y0); y < y1; y++)
      for (let x = Math.round(x0); x < x1; x++) {
        if (x < 0 || y < 0 || x >= this.n || y >= this.n) continue;
        const i = (y * this.n + x) * 4;
        this.buf[i] = this.buf[i + 1] = this.buf[i + 2] = this.buf[i + 3] = 0;
      }
  }
  fillRect(x0, y0, x1, y1, color) {
    for (let y = Math.round(y0); y < y1; y++)
      for (let x = Math.round(x0); x < x1; x++) this.blend(x, y, color);
  }
  fillCircle(cx, cy, r, color) {
    for (let y = Math.floor(cy - r); y <= cy + r; y++)
      for (let x = Math.floor(cx - r); x <= cx + r; x++)
        if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) this.blend(x, y, color);
  }
  fillTriangle(ax, ay, bx, by, cx, cy, color) {
    const minX = Math.floor(Math.min(ax, bx, cx)), maxX = Math.ceil(Math.max(ax, bx, cx));
    const minY = Math.floor(Math.min(ay, by, cy)), maxY = Math.ceil(Math.max(ay, by, cy));
    const edge = (x1, y1, x2, y2, x3, y3) => (x1 - x3) * (y2 - y3) - (x2 - x3) * (y1 - y3);
    for (let y = minY; y <= maxY; y++)
      for (let x = minX; x <= maxX; x++) {
        const d1 = edge(x, y, ax, ay, bx, by);
        const d2 = edge(x, y, bx, by, cx, cy);
        const d3 = edge(x, y, cx, cy, ax, ay);
        const hasNeg = d1 < 0 || d2 < 0 || d3 < 0;
        const hasPos = d1 > 0 || d2 > 0 || d3 > 0;
        if (!(hasNeg && hasPos)) this.blend(x, y, color);
      }
  }
  /** 降采样回 SIZE x SIZE */
  downsample() {
    const out = Buffer.alloc(SIZE * SIZE * 4);
    const cells = SS * SS;
    for (let y = 0; y < SIZE; y++)
      for (let x = 0; x < SIZE; x++) {
        let r = 0, g = 0, b = 0, a = 0;
        for (let dy = 0; dy < SS; dy++)
          for (let dx = 0; dx < SS; dx++) {
            const i = ((y * SS + dy) * this.n + (x * SS + dx)) * 4;
            r += this.buf[i]; g += this.buf[i + 1]; b += this.buf[i + 2]; a += this.buf[i + 3];
          }
        const o = (y * SIZE + x) * 4;
        out[o] = Math.round(r / cells);
        out[o + 1] = Math.round(g / cells);
        out[o + 2] = Math.round(b / cells);
        out[o + 3] = Math.round(a / cells);
      }
    return out;
  }
}

// ---------------- 图标定义（坐标基于 81x81 设计稿，内部自动乘 SS）----------------
function drawHome(c, color) {
  const u = v => v * SS;
  c.fillTriangle(u(40.5), u(11), u(13), u(41), u(68), u(41), color); // 屋顶
  c.fillRect(u(21), u(39), u(60), u(69), color);                     // 房体
  c.clearRect(u(35), u(53), u(46), u(69));                           // 门（镂空）
}

function drawList(c, color) {
  const u = v => v * SS;
  c.fillRect(u(16), u(18), u(65), u(27), color);   // 条 1
  c.fillRect(u(16), u(36.5), u(65), u(45.5), color); // 条 2
  c.fillRect(u(16), u(55), u(65), u(64), color);   // 条 3
}

function drawAbout(c, color) {
  const u = v => v * SS;
  c.fillCircle(u(40.5), u(40.5), u(29), color);      // 圆底
  c.fillCircle(u(40.5), u(26), u(4.5), color);       // i 点（镂空由下一步完成）
  c.clearRect(u(35.5), u(20.5), u(45.5), u(31.5));   // 先把 i 点区域清空
  c.fillCircle(u(40.5), u(26), u(4.5), color);       // 画 i 点
  c.clearRect(u(36.5), u(35), u(44.5), u(58));       // i 杆（镂空）
  c.fillRect(u(36.5), u(35), u(44.5), u(57), color); // 画 i 杆
}

// ---------------- 生成 ----------------
const outDir = path.join(__dirname, '..', 'demo-app', 'images');
fs.mkdirSync(outDir, { recursive: true });

const icons = [
  ['tab-home', drawHome],
  ['tab-list', drawList],
  ['tab-about', drawAbout],
];

for (const [name, draw] of icons) {
  for (const [suffix, color] of [['', COLORS.normal], ['-active', COLORS.active]]) {
    const canvas = new Canvas();
    draw(canvas, color);
    savePNG(path.join(outDir, `${name}${suffix}.png`), SIZE, canvas.downsample());
  }
}

console.log('全部图标生成完毕 →', path.relative(process.cwd(), outDir));
