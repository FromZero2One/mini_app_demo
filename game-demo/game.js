/**
 * 星河战机 —— 原创纵版射击小游戏 Demo（微信小游戏）
 *
 * 玩法参考经典街机纵版射击（雷霆战机 / 飞机大战 类），
 * 所有代码与图形均由本项目原创绘制，未使用任何第三方游戏素材。
 *
 * 操作：按住屏幕左右拖动移动战机，自动开火。
 * 玩法：击落敌机得分；吃到蓝色道具提升火力（最高 3 级）；
 *       中弹或撞机掉血并降一级火力；血量归零游戏结束。
 * 最高分保存在本地 Storage。
 */

// ==================== 环境与画布 ====================

const info = wx.getWindowInfo();
const W = info.windowWidth;
const H = info.windowHeight;
const DPR = info.pixelRatio || 1;
const K = W / 375; // 以 375 逻辑宽为基准的缩放系数

const canvas = wx.createCanvas();
canvas.width = W * DPR;
canvas.height = H * DPR;
const ctx = canvas.getContext('2d');
ctx.scale(DPR, DPR);

// 小游戏环境提供全局 requestAnimationFrame，这里做个兜底
const raf = typeof requestAnimationFrame === 'function'
  ? requestAnimationFrame
  : cb => setTimeout(() => cb(Date.now()), 16);

// ==================== 工具函数 ====================

const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/** 圆形碰撞检测 */
function hit(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const r = a.r + b.r;
  return dx * dx + dy * dy <= r * r;
}

// ==================== 游戏状态 ====================

const state = {
  mode: 'ready',     // ready | playing | over
  paused: false,
  time: 0,           // 本局已进行秒数
  score: 0,
  best: wx.getStorageSync('xinghe_best') || 0,
  kills: 0,
  spawnTimer: 1,
  shake: 0,          // 屏幕震动强度
  overAt: 0,         // 游戏结束时间戳（防误触重开）
};

const player = {
  x: W / 2,
  y: H - 96 * K,
  r: 15 * K,
  hp: 5,
  maxHp: 5,
  weapon: 1,         // 1 单发 / 2 双发 / 3 三发
  fireTimer: 0,
  invincible: 0,     // 受击后无敌秒数
  targetX: W / 2,
};

let bullets = [];       // 玩家子弹
let enemyBullets = [];  // 敌方子弹
let enemies = [];
let particles = [];
let pickups = [];

// 背景星空
const stars = Array.from({ length: 70 }, () => ({
  x: rand(0, W),
  y: rand(0, H),
  r: rand(0.6, 1.8) * K,
  v: rand(24, 90) * K,
}));

// ==================== 输入 ====================

wx.onTouchStart(e => {
  const t = (e.touches && e.touches[0]) || (e.changedTouches && e.changedTouches[0]);
  if (!t) return;
  if (state.mode === 'ready') {
    startGame();
    player.targetX = t.clientX;
    return;
  }
  if (state.mode === 'over') {
    if (Date.now() - state.overAt > 500) startGame();
    return;
  }
  player.targetX = t.clientX;
});

wx.onTouchMove(e => {
  const t = (e.touches && e.touches[0]) || (e.changedTouches && e.changedTouches[0]);
  if (t && state.mode === 'playing') player.targetX = t.clientX;
});

// 切后台自动暂停，回前台恢复
wx.onHide(() => { state.paused = true; });
wx.onShow(() => { state.paused = false; lastTime = Date.now(); });

// ==================== 局内逻辑 ====================

function startGame() {
  state.mode = 'playing';
  state.time = 0;
  state.score = 0;
  state.kills = 0;
  state.spawnTimer = 0.6;
  state.shake = 0;

  bullets = [];
  enemyBullets = [];
  enemies = [];
  particles = [];
  pickups = [];

  player.x = player.targetX = W / 2;
  player.y = H - 96 * K;
  player.hp = player.maxHp;
  player.weapon = 1;
  player.fireTimer = 0;
  player.invincible = 1.2;
}

function firePlayer() {
  const y = player.y - 22 * K;
  const v = -640 * K;
  if (player.weapon === 1) {
    bullets.push({ x: player.x, y, vx: 0, vy: v, r: 4 * K });
  } else if (player.weapon === 2) {
    bullets.push({ x: player.x - 9 * K, y, vx: 0, vy: v, r: 4 * K });
    bullets.push({ x: player.x + 9 * K, y, vx: 0, vy: v, r: 4 * K });
  } else {
    bullets.push({ x: player.x, y, vx: 0, vy: v * 1.08, r: 4 * K });
    bullets.push({ x: player.x - 12 * K, y: y + 4 * K, vx: -110 * K, vy: v, r: 4 * K });
    bullets.push({ x: player.x + 12 * K, y: y + 4 * K, vx: 110 * K, vy: v, r: 4 * K });
  }
}

function spawnEnemy() {
  const t = state.time;
  const roll = Math.random();
  let type = 'small';
  if (t > 25 && roll > 0.82) type = 'elite';
  else if (t > 10 && roll > 0.55) type = 'medium';

  const base = {
    x: rand(30 * K, W - 30 * K),
    y: -44 * K,
    phase: rand(0, Math.PI * 2),
    wobble: rand(0.8, 1.6),
    wobbleAmp: rand(0, 44) * K,
    fireTimer: rand(1, 2.2),
    shoot: false,
  };

  if (type === 'small') {
    enemies.push(Object.assign(base, {
      type, r: 14 * K, hp: 1, maxHp: 1,
      vy: rand(120, 170) * K, score: 10, color: '#ffb36b',
    }));
  } else if (type === 'medium') {
    enemies.push(Object.assign(base, {
      type, r: 20 * K, hp: 3, maxHp: 3,
      vy: rand(85, 115) * K, score: 30, color: '#ff7b7b',
      shoot: true, fireInterval: rand(1.6, 2.4),
    }));
  } else {
    enemies.push(Object.assign(base, {
      type, r: 27 * K, hp: 9, maxHp: 9,
      vy: rand(55, 75) * K, score: 100, color: '#c98bff',
      shoot: true, fireInterval: rand(1.9, 2.8),
    }));
  }
}

function shootAtPlayer(en) {
  const ang = Math.atan2(player.y - en.y, player.x - en.x);
  const speed = 210 * K;
  if (en.type === 'elite') {
    for (const off of [-0.3, 0, 0.3]) {
      enemyBullets.push({
        x: en.x, y: en.y + en.r * 0.6,
        vx: Math.cos(ang + off) * speed,
        vy: Math.sin(ang + off) * speed,
        r: 5 * K,
      });
    }
  } else {
    enemyBullets.push({
      x: en.x, y: en.y + en.r * 0.6,
      vx: Math.cos(ang) * speed,
      vy: Math.sin(ang) * speed,
      r: 5 * K,
    });
  }
}

function damagePlayer() {
  player.hp -= 1;
  player.invincible = 1.2;
  player.weapon = Math.max(1, player.weapon - 1);
  state.shake = 14 * K;
  if (wx.vibrateShort) wx.vibrateShort({ type: 'heavy' });
  boom(player.x, player.y, 14, '#7fd7ff');
  if (player.hp <= 0) gameOver();
}

function gameOver() {
  state.mode = 'over';
  state.overAt = Date.now();
  if (state.score > state.best) {
    state.best = state.score;
    try { wx.setStorageSync('xinghe_best', state.best); } catch (e) { /* ignore */ }
  }
}

function spawnPickup(x, y) {
  pickups.push({ x, y, r: 12 * K });
}

function boom(x, y, n, color) {
  for (let i = 0; i < n; i++) {
    const a = rand(0, Math.PI * 2);
    const sp = rand(30, 220) * K;
    particles.push({
      x, y,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp,
      life: rand(0.25, 0.6),
      maxLife: 0.6,
      r: rand(1.2, 3) * K,
      color,
    });
  }
}

function update(dt) {
  // 星空始终滚动（开始/结束界面也有动感）
  for (const s of stars) {
    s.y += s.v * dt;
    if (s.y > H + 2) {
      s.y = -2;
      s.x = rand(0, W);
    }
  }

  if (state.mode !== 'playing' || state.paused) return;

  state.time += dt;
  if (state.shake > 0) state.shake = Math.max(0, state.shake - dt * 30);

  // 玩家跟随手指（平滑）
  player.x += (player.targetX - player.x) * Math.min(1, dt * 14);
  player.x = clamp(player.x, player.r + 4, W - player.r - 4);
  player.invincible = Math.max(0, player.invincible - dt);

  // 自动开火
  player.fireTimer -= dt;
  if (player.fireTimer <= 0) {
    player.fireTimer = 0.14;
    firePlayer();
  }

  // 敌机生成（随时间加快）
  state.spawnTimer -= dt;
  if (state.spawnTimer <= 0) {
    spawnEnemy();
    const base = Math.max(0.35, 0.95 - state.time * 0.008);
    state.spawnTimer = base * rand(0.75, 1.25);
  }

  // 玩家子弹
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    if (b.y < -24 || b.x < -24 || b.x > W + 24) {
      bullets.splice(i, 1);
      continue;
    }
    for (let j = enemies.length - 1; j >= 0; j--) {
      const en = enemies[j];
      if (!hit(b, en)) continue;
      en.hp -= 1;
      bullets.splice(i, 1);
      boom(b.x, b.y, 2, en.color);
      if (en.hp <= 0) {
        state.score += en.score;
        state.kills += 1;
        boom(en.x, en.y, en.type === 'elite' ? 18 : 10, en.color);
        if (en.type === 'elite' || state.kills % 8 === 0) spawnPickup(en.x, en.y);
        enemies.splice(j, 1);
      }
      break;
    }
  }

  // 敌机移动与射击
  for (let i = enemies.length - 1; i >= 0; i--) {
    const en = enemies[i];
    en.y += en.vy * dt;
    en.x += Math.sin(state.time * en.wobble + en.phase) * en.wobbleAmp * dt;
    en.fireTimer -= dt;
    if (en.shoot && en.fireTimer <= 0 && en.y > 0) {
      en.fireTimer = en.fireInterval;
      shootAtPlayer(en);
    }
    if (en.y > H + 44) enemies.splice(i, 1);
  }

  // 敌方子弹
  for (let i = enemyBullets.length - 1; i >= 0; i--) {
    const b = enemyBullets[i];
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    if (b.y > H + 24 || b.y < -24 || b.x < -24 || b.x > W + 24) {
      enemyBullets.splice(i, 1);
      continue;
    }
    if (player.invincible <= 0 && hit(b, player)) {
      enemyBullets.splice(i, 1);
      damagePlayer();
    }
  }

  // 敌机撞机
  for (let i = enemies.length - 1; i >= 0; i--) {
    const en = enemies[i];
    if (player.invincible <= 0 && hit(en, player)) {
      boom(en.x, en.y, 10, en.color);
      enemies.splice(i, 1);
      damagePlayer();
    }
  }

  // 道具
  for (let i = pickups.length - 1; i >= 0; i--) {
    const p = pickups[i];
    p.y += 90 * K * dt;
    if (p.y > H + 24) {
      pickups.splice(i, 1);
      continue;
    }
    if (hit(p, player)) {
      pickups.splice(i, 1);
      player.weapon = Math.min(3, player.weapon + 1);
      state.score += 20;
      if (wx.vibrateShort) wx.vibrateShort({ type: 'light' });
      boom(p.x, p.y, 10, '#7fe7ff');
    }
  }

  // 粒子
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.life -= dt;
    if (p.life <= 0) {
      particles.splice(i, 1);
      continue;
    }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= 0.98;
    p.vy *= 0.98;
  }
}

// ==================== 渲染 ====================

function drawBackground() {
  ctx.fillStyle = '#05060f';
  ctx.fillRect(0, 0, W, H);
  for (const s of stars) {
    ctx.globalAlpha = 0.3 + s.r * 0.3;
    ctx.fillStyle = '#9fc9ff';
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawPlayer() {
  if (player.invincible > 0 && Math.floor(player.invincible * 12) % 2 === 0) return;

  const x = player.x;
  const y = player.y;
  const k = K;

  // 尾焰
  ctx.fillStyle = 'rgba(120, 220, 255, 0.55)';
  ctx.beginPath();
  ctx.moveTo(x - 5 * k, y + 14 * k);
  ctx.lineTo(x + 5 * k, y + 14 * k);
  ctx.lineTo(x, y + (26 + Math.random() * 8) * k);
  ctx.closePath();
  ctx.fill();

  // 机身
  ctx.fillStyle = '#eaf6ff';
  ctx.beginPath();
  ctx.moveTo(x, y - 20 * k);
  ctx.lineTo(x - 13 * k, y + 12 * k);
  ctx.lineTo(x - 5 * k, y + 8 * k);
  ctx.lineTo(x, y + 16 * k);
  ctx.lineTo(x + 5 * k, y + 8 * k);
  ctx.lineTo(x + 13 * k, y + 12 * k);
  ctx.closePath();
  ctx.fill();

  // 座舱
  ctx.fillStyle = '#1a73e8';
  ctx.beginPath();
  ctx.moveTo(x, y - 12 * k);
  ctx.lineTo(x - 6 * k, y + 6 * k);
  ctx.lineTo(x + 6 * k, y + 6 * k);
  ctx.closePath();
  ctx.fill();
}

function drawEnemies() {
  for (const en of enemies) {
    ctx.save();
    ctx.translate(en.x, en.y);
    ctx.fillStyle = en.color;

    if (en.type === 'small') {
      ctx.beginPath();
      ctx.moveTo(0, en.r);
      ctx.lineTo(-en.r, -en.r);
      ctx.lineTo(en.r, -en.r);
      ctx.closePath();
      ctx.fill();
    } else if (en.type === 'medium') {
      ctx.beginPath();
      ctx.moveTo(0, en.r);
      ctx.lineTo(-en.r, 0);
      ctx.lineTo(-en.r * 0.6, -en.r);
      ctx.lineTo(en.r * 0.6, -en.r);
      ctx.lineTo(en.r, 0);
      ctx.closePath();
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.arc(0, 0, en.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
      ctx.beginPath();
      ctx.arc(0, 0, en.r * 0.55, 0, Math.PI * 2);
      ctx.fill();
    }

    // 血条（中型/精英）
    if (en.maxHp > 1) {
      const w = en.r * 1.8;
      const hpRatio = en.hp / en.maxHp;
      ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
      ctx.fillRect(-w / 2, en.r + 6 * K, w, 4 * K);
      ctx.fillStyle = hpRatio > 0.4 ? '#7ef0a0' : '#ff8b7b';
      ctx.fillRect(-w / 2, en.r + 6 * K, w * hpRatio, 4 * K);
    }
    ctx.restore();
  }
}

function drawBullets() {
  ctx.fillStyle = '#7fe7ff';
  for (const b of bullets) {
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r + 1, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawEnemyBullets() {
  ctx.fillStyle = '#ff6b6b';
  for (const b of enemyBullets) {
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r + 1, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawPickups() {
  const t = state.time * 4;
  for (const p of pickups) {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(t);
    ctx.fillStyle = '#7fe7ff';
    ctx.beginPath();
    ctx.moveTo(0, -p.r);
    ctx.lineTo(p.r, 0);
    ctx.lineTo(0, p.r);
    ctx.lineTo(-p.r, 0);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // 中间加号
    ctx.fillStyle = '#083049';
    ctx.fillRect(p.x - 2 * K, p.y - 6 * K, 4 * K, 12 * K);
    ctx.fillRect(p.x - 6 * K, p.y - 2 * K, 12 * K, 4 * K);
  }
}

function drawParticles() {
  for (const p of particles) {
    ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawHud() {
  const pad = 16 * K;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillStyle = '#eaf6ff';
  ctx.font = `bold ${18 * K}px sans-serif`;
  ctx.fillText(`得分 ${state.score}`, pad, pad);

  ctx.textAlign = 'right';
  ctx.fillStyle = 'rgba(234, 246, 255, 0.7)';
  ctx.font = `${14 * K}px sans-serif`;
  ctx.fillText(`最高 ${state.best}`, W - pad, pad + 2 * K);
  ctx.fillText(`火力 ${'★'.repeat(player.weapon)}`, W - pad, pad + 22 * K);

  // 血量
  ctx.textAlign = 'left';
  for (let i = 0; i < player.maxHp; i++) {
    ctx.fillStyle = i < player.hp ? '#ff6b6b' : 'rgba(255, 107, 107, 0.22)';
    ctx.beginPath();
    ctx.arc(pad + 8 * K + i * 20 * K, H - 20 * K, 6 * K, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawCenterText(text, y, size, color, weight) {
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = color;
  ctx.font = `${weight || 'normal'} ${size * K}px sans-serif`;
  ctx.fillText(text, W / 2, y * K);
}

function drawReady() {
  const pulse = 0.6 + 0.4 * Math.sin(Date.now() / 300);
  drawCenterText('星 河 战 机', H * 0.3, 36, '#eaf6ff', 'bold');
  drawCenterText('纵版射击 · 原创 Demo', H * 0.3 + 44, 15, 'rgba(234, 246, 255, 0.6)');
  drawCenterText('按住屏幕左右拖动 · 自动开火', H * 0.52, 14, 'rgba(234, 246, 255, 0.75)');
  drawCenterText('吃蓝色道具提升火力', H * 0.52 + 30, 14, 'rgba(127, 231, 255, 0.85)');

  ctx.globalAlpha = pulse;
  drawCenterText('点击屏幕开始', H * 0.72, 20, '#7fe7ff', 'bold');
  ctx.globalAlpha = 1;

  drawCenterText(`最高分 ${state.best}`, H * 0.78, 13, 'rgba(234, 246, 255, 0.55)');
}

function drawOver() {
  ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
  ctx.fillRect(0, 0, W, H);

  drawCenterText('游 戏 结 束', H * 0.36, 30, '#ff8b7b', 'bold');
  drawCenterText(`本局得分 ${state.score}`, H * 0.46, 20, '#eaf6ff');
  drawCenterText(`历史最高 ${state.best}`, H * 0.46 + 34, 14, 'rgba(234, 246, 255, 0.65)');

  const pulse = 0.6 + 0.4 * Math.sin(Date.now() / 300);
  ctx.globalAlpha = pulse;
  drawCenterText('点击屏幕重新开始', H * 0.66, 18, '#7fe7ff', 'bold');
  ctx.globalAlpha = 1;
}

function render() {
  ctx.save();
  if (state.mode === 'playing' && state.shake > 0.2) {
    ctx.translate(rand(-state.shake, state.shake) * 0.5, rand(-state.shake, state.shake) * 0.5);
  }

  drawBackground();

  if (state.mode === 'playing' || state.mode === 'over') {
    drawPickups();
    drawBullets();
    drawEnemyBullets();
    drawEnemies();
    drawPlayer();
    drawParticles();
    drawHud();
  }

  if (state.mode === 'ready') drawReady();
  if (state.mode === 'over') drawOver();

  ctx.restore();
}

// ==================== 主循环 ====================

let lastTime = Date.now();

function loop() {
  const now = Date.now();
  let dt = (now - lastTime) / 1000;
  lastTime = now;
  if (dt > 0.05) dt = 0.05; // 卡顿保护
  update(dt);
  render();
  raf(loop);
}

raf(loop);
