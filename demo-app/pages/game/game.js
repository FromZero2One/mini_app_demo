/**
 * 星河战机 —— 跑在小程序里的 Canvas 2D 纵版射击游戏
 *
 * 为什么是「小程序页面」而不是「小游戏」：
 * 本账号是「小程序」类型，开发者工具会强制按小程序导入；
 * 小游戏工程需要独立的小游戏账号（企业资质 + 版号）。因此游戏以小程序的
 * canvas 2D 页面形式运行，使用同一个 AppID。
 *
 * 操作：按住屏幕左右拖动（相对拖动，战机跟随手指位移），自动开火。
 * 玩法：击落敌机得分；蓝色道具提升火力（最高 3 级）；中弹掉血并降 1 级火力；
 *       每 60 秒出现一只 Boss（三阶段弹幕）；血量归零结束。
 */

const { createAudio } = require('./audio.js');
const {
  clamp,
  hit,
  weaponPattern,
  bossSpread,
  bossRing,
  bossFireInterval,
  spawnInterval,
} = require('./logic.js');

const rand = (a, b) => a + Math.random() * (b - a);

Page({
  data: {},

  onReady() {
    const query = wx.createSelectorQuery().in(this);
    query.select('#game').fields({ node: true, size: true }).exec(res => {
      const item = res && res[0];
      if (!item || !item.node) {
        console.error('[星河战机] canvas 初始化失败', res);
        return;
      }
      const canvas = item.node;
      const W = item.width;
      const H = item.height;
      const winInfo = typeof wx.getWindowInfo === 'function' ? wx.getWindowInfo() : wx.getSystemInfoSync();
      const dpr = winInfo.pixelRatio || 1;

      canvas.width = W * dpr;
      canvas.height = H * dpr;
      const ctx = canvas.getContext('2d');
      ctx.scale(dpr, dpr);

      console.log('[星河战机] init', { width: W, height: H, dpr });
      this.initGame(canvas, ctx, W, H);
    });
  },

  onHide() {
    // 切后台/离开页面：暂停并停止渲染循环，省电
    this.paused = true;
    if (this.canvas && this.rafId != null && typeof this.canvas.cancelAnimationFrame === 'function') {
      this.canvas.cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  },

  onShow() {
    // 首次进入时 canvas 还没初始化，忽略
    if (!this.canvas) return;
    if (!this.paused) return;
    this.paused = false;
    this.lastTime = Date.now();
    if (this.state.mode === 'playing') this.resumeCountdown = 3;
    this.loop();
  },

  onUnload() {
    if (this.canvas && this.rafId != null && typeof this.canvas.cancelAnimationFrame === 'function') {
      this.canvas.cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  },

  // ==================== 初始化 ====================

  initGame(canvas, ctx, W, H) {
    this.canvas = canvas;
    this.ctx = ctx;
    this.W = W;
    this.H = H;
    this.K = W / 375; // 以 375 逻辑宽为基准的缩放系数
    this.paused = false;
    this.resumeCountdown = 0;
    this.loopErrorCount = 0;
    this.audio = createAudio();

    this.state = {
      mode: 'ready',   // ready | playing | over
      time: 0,
      score: 0,
      best: wx.getStorageSync('xinghe_best') || 0,
      kills: 0,
      spawnTimer: 1,
      shake: 0,
      overAt: 0,
      bossTimer: 60,   // 第一只 Boss 在 60 秒时出现
      bossAlive: false,
      bossLevel: 0,
      shotSeq: 0,
    };

    this.player = {
      x: W / 2,
      y: H - 96 * this.K,
      r: 15 * this.K,
      hp: 5,
      maxHp: 5,
      weapon: 1,
      fireTimer: 0,
      invincible: 0,
      targetX: W / 2,
    };

    this.touchLastX = null;
    this.bullets = [];
    this.enemyBullets = [];
    this.enemies = [];
    this.particles = [];
    this.pickups = [];

    this.stars = Array.from({ length: 70 }, () => ({
      x: rand(0, W),
      y: rand(0, H),
      r: rand(0.6, 1.8) * this.K,
      v: rand(24, 90) * this.K,
    }));

    this.lastTime = Date.now();
    this.loop = this.loop.bind(this);

    try {
      this.render();
    } catch (err) {
      console.error('[星河战机] 首帧渲染失败', err && (err.stack || err.message || err));
    }
    this.rafId = this.canvas.requestAnimationFrame(this.loop);
  },

  startGame() {
    console.log('[星河战机] startGame');
    const st = this.state;
    st.mode = 'playing';
    st.time = 0;
    st.score = 0;
    st.kills = 0;
    st.spawnTimer = 0.6;
    st.shake = 0;
    st.bossTimer = 60;
    st.bossAlive = false;
    st.bossLevel = 0;
    st.shotSeq = 0;

    this.resumeCountdown = 0;
    this.bullets = [];
    this.enemyBullets = [];
    this.enemies = [];
    this.particles = [];
    this.pickups = [];

    this.player.x = this.player.targetX = this.W / 2;
    this.player.y = this.H - 96 * this.K;
    this.player.hp = this.player.maxHp;
    this.player.weapon = 1;
    this.player.fireTimer = 0;
    this.player.invincible = 1.2;
    this.touchLastX = null;
  },

  // ==================== 输入 ====================

  onTouchStart(e) {
    const t = (e.touches && e.touches[0]) || (e.changedTouches && e.changedTouches[0]);
    if (!t) return;
    const x = t.x != null ? t.x : t.clientX;

    if (this.audio) this.audio.unlock();

    console.log('[星河战机] touchstart, mode =', this.state.mode);
    if (this.state.mode === 'ready') {
      this.startGame();
      this.touchLastX = x;
      return;
    }
    if (this.state.mode === 'over') {
      if (Date.now() - this.state.overAt > 500) this.startGame();
      this.touchLastX = x;
      return;
    }
    this.touchLastX = x;
  },

  onTouchMove(e) {
    if (this.state.mode !== 'playing') return;
    const t = (e.touches && e.touches[0]) || (e.changedTouches && e.changedTouches[0]);
    if (!t) return;
    const x = t.x != null ? t.x : t.clientX;

    // 相对拖动：战机跟随手指位移，不会瞬移到手指位置；1.2px 死区防抖动
    if (this.touchLastX == null) {
      this.touchLastX = x;
      return;
    }
    const dx = x - this.touchLastX;
    this.touchLastX = x;
    if (Math.abs(dx) < 1.2) return;

    const p = this.player;
    p.targetX = clamp(p.targetX + dx, p.r + 4, this.W - p.r - 4);
  },

  // ==================== 主循环 ====================

  loop() {
    if (this.paused) return; // 取消后的残余帧不要再启动循环

    try {
      const now = Date.now();
      let dt = (now - this.lastTime) / 1000;
      this.lastTime = now;
      if (dt > 0.05) dt = 0.05; // 卡顿保护
      if (this.resumeCountdown > 0) {
        this.resumeCountdown = Math.max(0, this.resumeCountdown - dt);
      }
      this.update(dt);
      this.render();
    } catch (err) {
      // 单帧异常不能打断 RAF 链，否则游戏会“无响应”
      if (this.loopErrorCount < 3) {
        this.loopErrorCount += 1;
        console.error('[星河战机] 帧循环异常', err && (err.stack || err.message || err));
      }
    }
    this.rafId = this.canvas.requestAnimationFrame(this.loop);
  },

  // ==================== 局内逻辑 ====================

  firePlayer() {
    const p = this.player;
    const K = this.K;

    if (this.state.shotSeq % 3 === 0) this.audio.shoot();
    this.state.shotSeq += 1;

    for (const b of weaponPattern(p.weapon)) {
      this.bullets.push({
        x: p.x + b.dx * K,
        y: p.y + b.dy * K,
        vx: b.vx * K,
        vy: b.vy * K,
        r: 4 * K,
      });
    }
  },

  spawnEnemy() {
    const t = this.state.time;
    const K = this.K;
    const roll = Math.random();
    let type = 'small';
    if (t > 25 && roll > 0.82) type = 'elite';
    else if (t > 10 && roll > 0.55) type = 'medium';

    const base = {
      x: rand(30 * K, this.W - 30 * K),
      y: -44 * K,
      phase: rand(0, Math.PI * 2),
      wobble: rand(0.8, 1.6),
      wobbleAmp: rand(0, 44) * K,
      fireTimer: rand(1, 2.2),
      shoot: false,
    };

    if (type === 'small') {
      this.enemies.push(Object.assign(base, {
        type, r: 14 * K, hp: 1, maxHp: 1,
        vy: rand(120, 170) * K, score: 10, color: '#ffb36b',
      }));
    } else if (type === 'medium') {
      this.enemies.push(Object.assign(base, {
        type, r: 20 * K, hp: 3, maxHp: 3,
        vy: rand(85, 115) * K, score: 30, color: '#ff7b7b',
        shoot: true, fireInterval: rand(1.6, 2.4),
      }));
    } else {
      this.enemies.push(Object.assign(base, {
        type, r: 27 * K, hp: 9, maxHp: 9,
        vy: rand(55, 75) * K, score: 100, color: '#c98bff',
        shoot: true, fireInterval: rand(1.9, 2.8),
      }));
    }
  },

  /** Boss：每 60 秒一只，血量与弹幕随等级增强 */
  spawnBoss() {
    const K = this.K;
    const lv = this.state.bossLevel;
    const maxHp = 90 + lv * 45;
    this.enemies.push({
      type: 'boss',
      x: this.W / 2,
      y: -110 * K,
      r: 46 * K,
      hp: maxHp,
      maxHp,
      score: 500 + lv * 100,
      targetY: 150 * K,
      entering: true,
      fireTimer: 1.6,
      fireInterval: 1.4,
      color: '#ff5c8a',
    });
    this.state.bossAlive = true;
    this.audio.bossWarn();
    console.log('[星河战机] boss spawn, level =', lv + 1);
  },

  shootAtPlayer(en) {
    const K = this.K;
    const p = this.player;
    const ang = Math.atan2(p.y - en.y, p.x - en.x);
    const speed = 210 * K;
    if (en.type === 'elite') {
      for (const off of [-0.3, 0, 0.3]) {
        this.enemyBullets.push({
          x: en.x, y: en.y + en.r * 0.6,
          vx: Math.cos(ang + off) * speed,
          vy: Math.sin(ang + off) * speed,
          r: 5 * K,
        });
      }
    } else {
      this.enemyBullets.push({
        x: en.x, y: en.y + en.r * 0.6,
        vx: Math.cos(ang) * speed,
        vy: Math.sin(ang) * speed,
        r: 5 * K,
      });
    }
  },

  /** Boss 三阶段弹幕：瞄准散射 → 加环形弹幕 → 更密集 */
  bossFire(en) {
    const st = this.state;
    const p = this.player;
    const K = this.K;
    const ratio = en.hp / en.maxHp;
    const ang = Math.atan2(p.y - en.y, p.x - en.x);
    const speed = 210 * K;

    for (const off of bossSpread(ratio)) {
      this.enemyBullets.push({
        x: en.x, y: en.y + en.r * 0.5,
        vx: Math.cos(ang + off) * speed,
        vy: Math.sin(ang + off) * speed,
        r: 5.5 * K,
        color: '#ff9ad0',
      });
    }

    const ringCount = bossRing(ratio);
    if (ringCount > 0) {
      const ringSpeed = 150 * K;
      const base = st.time * 1.2;
      for (let i = 0; i < ringCount; i++) {
        const a = base + (i / ringCount) * Math.PI * 2;
        this.enemyBullets.push({
          x: en.x, y: en.y,
          vx: Math.cos(a) * ringSpeed,
          vy: Math.sin(a) * ringSpeed,
          r: 5 * K,
          color: '#c98bff',
        });
      }
    }

    en.fireInterval = bossFireInterval(ratio);
  },

  damagePlayer() {
    const p = this.player;
    p.hp -= 1;
    p.invincible = 1.2;
    p.weapon = Math.max(1, p.weapon - 1);
    this.state.shake = 14 * this.K;
    if (wx.vibrateShort) wx.vibrateShort({ type: 'heavy' });
    this.audio.hurt();
    this.boom(p.x, p.y, 14, '#7fd7ff');
    if (p.hp <= 0) this.gameOver();
  },

  gameOver() {
    this.state.mode = 'over';
    this.state.overAt = Date.now();
    this.audio.over();
    if (this.state.score > this.state.best) {
      this.state.best = this.state.score;
      try { wx.setStorageSync('xinghe_best', this.state.best); } catch (e) { /* ignore */ }
    }
  },

  spawnPickup(x, y) {
    this.pickups.push({ x, y, r: 12 * this.K });
  },

  boom(x, y, n, color) {
    const K = this.K;
    for (let i = 0; i < n; i++) {
      const a = rand(0, Math.PI * 2);
      const sp = rand(30, 220) * K;
      this.particles.push({
        x, y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life: rand(0.25, 0.6),
        maxLife: 0.6,
        r: rand(1.2, 3) * K,
        color,
      });
    }
  },

  update(dt) {
    const W = this.W;
    const H = this.H;
    const K = this.K;
    const st = this.state;
    const p = this.player;

    // 星空始终滚动（开始/结束/暂停倒计时界面也有动感）
    for (const s of this.stars) {
      s.y += s.v * dt;
      if (s.y > H + 2) {
        s.y = -2;
        s.x = rand(0, W);
      }
    }

    if (st.mode !== 'playing' || this.resumeCountdown > 0) return;

    st.time += dt;
    if (st.shake > 0) st.shake = Math.max(0, st.shake - dt * 30);

    // 玩家跟随（相对拖动 + 平滑）
    p.x += (p.targetX - p.x) * Math.min(1, dt * 14);
    p.x = clamp(p.x, p.r + 4, W - p.r - 4);
    p.invincible = Math.max(0, p.invincible - dt);

    // 自动开火
    p.fireTimer -= dt;
    if (p.fireTimer <= 0) {
      p.fireTimer = 0.14;
      this.firePlayer();
    }

    // Boss 计时
    if (!st.bossAlive) {
      st.bossTimer -= dt;
      if (st.bossTimer <= 0) this.spawnBoss();
    }

    // 敌机生成（随时间加快；Boss 期间降频）
    st.spawnTimer -= dt;
    if (st.spawnTimer <= 0) {
      this.spawnEnemy();
      st.spawnTimer = spawnInterval(st.time, st.bossAlive) * rand(0.75, 1.25);
    }

    // 玩家子弹
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      if (b.y < -24 || b.x < -24 || b.x > W + 24) {
        this.bullets.splice(i, 1);
        continue;
      }
      for (let j = this.enemies.length - 1; j >= 0; j--) {
        const en = this.enemies[j];
        if (!hit(b, en)) continue;
        en.hp -= 1;
        this.bullets.splice(i, 1);
        this.boom(b.x, b.y, 2, en.color);
        if (en.hp <= 0) {
          st.score += en.score;
          this.boom(en.x, en.y, en.type === 'boss' ? 40 : en.type === 'elite' ? 18 : 10, en.color);
          this.audio.boom();

          if (en.type === 'boss') {
            st.bossAlive = false;
            st.bossLevel += 1;
            st.bossTimer = 60;
            p.hp = Math.min(p.maxHp, p.hp + 1); // 击破 Boss 回 1 血
            this.spawnPickup(en.x - 34 * K, en.y);
            this.spawnPickup(en.x + 34 * K, en.y);
            console.log('[星河战机] boss defeated, level =', st.bossLevel);
          } else {
            st.kills += 1;
            if (en.type === 'elite' || st.kills % 8 === 0) this.spawnPickup(en.x, en.y);
          }
          this.enemies.splice(j, 1);
        }
        break;
      }
    }

    // 敌机移动与射击
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const en = this.enemies[i];

      if (en.type === 'boss') {
        if (en.y < en.targetY) {
          en.y += 70 * K * dt;
        } else {
          en.entering = false;
          en.x = W / 2 + Math.sin(st.time * 0.9) * (W * 0.26);
          en.fireTimer -= dt;
          if (en.fireTimer <= 0) {
            en.fireTimer = en.fireInterval;
            this.bossFire(en);
          }
        }
        continue;
      }

      en.y += en.vy * dt;
      en.x += Math.sin(st.time * en.wobble + en.phase) * en.wobbleAmp * dt;
      en.fireTimer -= dt;
      if (en.shoot && en.fireTimer <= 0 && en.y > 0) {
        en.fireTimer = en.fireInterval;
        this.shootAtPlayer(en);
      }
      if (en.y > H + 44) this.enemies.splice(i, 1);
    }

    // 敌方子弹
    for (let i = this.enemyBullets.length - 1; i >= 0; i--) {
      const b = this.enemyBullets[i];
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      if (b.y > H + 24 || b.y < -24 || b.x < -24 || b.x > W + 24) {
        this.enemyBullets.splice(i, 1);
        continue;
      }
      if (p.invincible <= 0 && hit(b, p)) {
        this.enemyBullets.splice(i, 1);
        this.damagePlayer();
      }
    }

    // 敌机撞机
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const en = this.enemies[i];
      if (p.invincible <= 0 && hit(en, p)) {
        this.boom(en.x, en.y, 10, en.color);
        this.enemies.splice(i, 1);
        this.damagePlayer();
      }
    }

    // 道具
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const pk = this.pickups[i];
      pk.y += 90 * K * dt;
      if (pk.y > H + 24) {
        this.pickups.splice(i, 1);
        continue;
      }
      if (hit(pk, p)) {
        this.pickups.splice(i, 1);
        p.weapon = Math.min(3, p.weapon + 1);
        st.score += 20;
        if (wx.vibrateShort) wx.vibrateShort({ type: 'light' });
        this.audio.pickup();
        this.boom(pk.x, pk.y, 10, '#7fe7ff');
      }
    }

    // 粒子
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const pt = this.particles[i];
      pt.life -= dt;
      if (pt.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.vx *= 0.98;
      pt.vy *= 0.98;
    }
  },

  // ==================== 渲染 ====================

  render() {
    const ctx = this.ctx;
    const st = this.state;
    ctx.save();
    if (st.mode === 'playing' && st.shake > 0.2) {
      ctx.translate(rand(-st.shake, st.shake) * 0.5, rand(-st.shake, st.shake) * 0.5);
    }

    this.drawBackground();

    if (st.mode === 'playing' || st.mode === 'over') {
      this.drawPickups();
      this.drawBullets();
      this.drawEnemyBullets();
      this.drawEnemies();
      this.drawPlayer();
      this.drawParticles();
      this.drawHud();
    }

    if (st.mode === 'ready') this.drawReady();
    if (st.mode === 'over') this.drawOver();
    if (this.resumeCountdown > 0) this.drawCountdown();

    ctx.restore();
  },

  drawBackground() {
    const ctx = this.ctx;
    ctx.fillStyle = '#05060f';
    ctx.fillRect(0, 0, this.W, this.H);
    for (const s of this.stars) {
      ctx.globalAlpha = 0.3 + s.r * 0.3;
      ctx.fillStyle = '#9fc9ff';
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  },

  drawPlayer() {
    const ctx = this.ctx;
    const p = this.player;
    const k = this.K;
    if (p.invincible > 0 && Math.floor(p.invincible * 12) % 2 === 0) return;

    ctx.fillStyle = 'rgba(120, 220, 255, 0.55)';
    ctx.beginPath();
    ctx.moveTo(p.x - 5 * k, p.y + 14 * k);
    ctx.lineTo(p.x + 5 * k, p.y + 14 * k);
    ctx.lineTo(p.x, p.y + (26 + Math.random() * 8) * k);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#eaf6ff';
    ctx.beginPath();
    ctx.moveTo(p.x, p.y - 20 * k);
    ctx.lineTo(p.x - 13 * k, p.y + 12 * k);
    ctx.lineTo(p.x - 5 * k, p.y + 8 * k);
    ctx.lineTo(p.x, p.y + 16 * k);
    ctx.lineTo(p.x + 5 * k, p.y + 8 * k);
    ctx.lineTo(p.x + 13 * k, p.y + 12 * k);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#1a73e8';
    ctx.beginPath();
    ctx.moveTo(p.x, p.y - 12 * k);
    ctx.lineTo(p.x - 6 * k, p.y + 6 * k);
    ctx.lineTo(p.x + 6 * k, p.y + 6 * k);
    ctx.closePath();
    ctx.fill();
  },

  drawEnemies() {
    const ctx = this.ctx;
    const K = this.K;
    for (const en of this.enemies) {
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
      } else if (en.type === 'elite') {
        ctx.beginPath();
        ctx.arc(0, 0, en.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
        ctx.beginPath();
        ctx.arc(0, 0, en.r * 0.55, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // Boss：六边形母舰
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
          const a = Math.PI / 6 + (i * Math.PI) / 3;
          const px = Math.cos(a) * en.r;
          const py = Math.sin(a) * en.r * 0.85;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
        ctx.beginPath();
        ctx.arc(0, 0, en.r * 0.45, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffd0e2';
        ctx.beginPath();
        ctx.arc(0, 0, en.r * 0.22, 0, Math.PI * 2);
        ctx.fill();
      }

      if (en.maxHp > 1 && en.type !== 'boss') {
        const w = en.r * 1.8;
        const hpRatio = en.hp / en.maxHp;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
        ctx.fillRect(-w / 2, en.r + 6 * K, w, 4 * K);
        ctx.fillStyle = hpRatio > 0.4 ? '#7ef0a0' : '#ff8b7b';
        ctx.fillRect(-w / 2, en.r + 6 * K, w * hpRatio, 4 * K);
      }
      ctx.restore();
    }
  },

  drawBullets() {
    const ctx = this.ctx;
    ctx.fillStyle = '#7fe7ff';
    for (const b of this.bullets) {
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r + 1, 0, Math.PI * 2);
      ctx.fill();
    }
  },

  drawEnemyBullets() {
    const ctx = this.ctx;
    for (const b of this.enemyBullets) {
      ctx.fillStyle = b.color || '#ff6b6b';
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r + 1, 0, Math.PI * 2);
      ctx.fill();
    }
  },

  drawPickups() {
    const ctx = this.ctx;
    const K = this.K;
    const t = this.state.time * 4;
    for (const p of this.pickups) {
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

      ctx.fillStyle = '#083049';
      ctx.fillRect(p.x - 2 * K, p.y - 6 * K, 4 * K, 12 * K);
      ctx.fillRect(p.x - 6 * K, p.y - 2 * K, 12 * K, 4 * K);
    }
  },

  drawParticles() {
    const ctx = this.ctx;
    for (const p of this.particles) {
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  },

  drawHud() {
    const ctx = this.ctx;
    const K = this.K;
    const pad = 16 * K;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillStyle = '#eaf6ff';
    ctx.font = `bold ${18 * K}px sans-serif`;
    ctx.fillText(`得分 ${this.state.score}`, pad, pad);

    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(234, 246, 255, 0.7)';
    ctx.font = `${14 * K}px sans-serif`;
    ctx.fillText(`最高 ${this.state.best}`, this.W - pad, pad + 2 * K);
    ctx.fillText(`火力 ${'★'.repeat(this.player.weapon)}`, this.W - pad, pad + 22 * K);

    ctx.textAlign = 'left';
    for (let i = 0; i < this.player.maxHp; i++) {
      ctx.fillStyle = i < this.player.hp ? '#ff6b6b' : 'rgba(255, 107, 107, 0.22)';
      ctx.beginPath();
      ctx.arc(pad + 8 * K + i * 20 * K, this.H - 20 * K, 6 * K, 0, Math.PI * 2);
      ctx.fill();
    }

    if (this.state.bossAlive) this.drawBossBar();
  },

  drawBossBar() {
    const boss = this.enemies.find(e => e.type === 'boss');
    if (!boss) return;
    const ctx = this.ctx;
    const K = this.K;
    const w = this.W * 0.62;
    const x = (this.W - w) / 2;
    const y = 58 * K;
    const h = 8 * K;
    const ratio = Math.max(0, boss.hp / boss.maxHp);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.14)';
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = ratio > 0.33 ? '#ff5c8a' : '#ff2d55';
    ctx.fillRect(x, y, w * ratio, h);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillStyle = '#ffd0e2';
    ctx.font = `bold ${11 * K}px sans-serif`;
    ctx.fillText(`BOSS  Lv.${this.state.bossLevel + 1}`, this.W / 2, y - 4 * K);
  },

  drawCenterText(text, y, size, color, weight) {
    const ctx = this.ctx;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = color;
    ctx.font = `${weight || 'normal'} ${size * this.K}px sans-serif`;
    ctx.fillText(text, this.W / 2, y * this.K);
  },

  drawReady() {
    const H = this.H;
    const pulse = 0.6 + 0.4 * Math.sin(Date.now() / 300);
    this.drawCenterText('星 河 战 机', H * 0.3, 36, '#eaf6ff', 'bold');
    this.drawCenterText('纵版射击 · 原创 Demo', H * 0.3 + 44, 15, 'rgba(234, 246, 255, 0.6)');
    this.drawCenterText('按住屏幕左右拖动 · 自动开火', H * 0.52, 14, 'rgba(234, 246, 255, 0.75)');
    this.drawCenterText('吃蓝色道具提升火力', H * 0.52 + 30, 14, 'rgba(127, 231, 255, 0.85)');
    this.drawCenterText('每 60 秒出现 Boss', H * 0.52 + 60, 14, 'rgba(255, 154, 208, 0.85)');

    this.ctx.globalAlpha = pulse;
    this.drawCenterText('点击屏幕开始', H * 0.72, 20, '#7fe7ff', 'bold');
    this.ctx.globalAlpha = 1;

    this.drawCenterText(`最高分 ${this.state.best}`, H * 0.78, 13, 'rgba(234, 246, 255, 0.55)');
  },

  drawOver() {
    const ctx = this.ctx;
    const H = this.H;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
    ctx.fillRect(0, 0, this.W, H);

    this.drawCenterText('游 戏 结 束', H * 0.36, 30, '#ff8b7b', 'bold');
    this.drawCenterText(`本局得分 ${this.state.score}`, H * 0.46, 20, '#eaf6ff');
    this.drawCenterText(`历史最高 ${this.state.best}`, H * 0.46 + 34, 14, 'rgba(234, 246, 255, 0.65)');

    const pulse = 0.6 + 0.4 * Math.sin(Date.now() / 300);
    ctx.globalAlpha = pulse;
    this.drawCenterText('点击屏幕重新开始', H * 0.66, 18, '#7fe7ff', 'bold');
    ctx.globalAlpha = 1;
  },

  drawCountdown() {
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.fillRect(0, 0, this.W, this.H);
    const n = Math.ceil(this.resumeCountdown);
    const text = n > 0 ? String(n) : 'GO';
    this.drawCenterText(text, this.H * 0.5, 56, '#7fe7ff', 'bold');
  },
});
