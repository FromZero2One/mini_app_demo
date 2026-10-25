const test = require('node:test');
const assert = require('node:assert');
const {
  clamp,
  hit,
  weaponPattern,
  bossSpread,
  bossRing,
  bossFireInterval,
  spawnInterval,
} = require('../../demo-app/pages/game/logic.js');

test('clamp 限定在区间内', () => {
  assert.equal(clamp(5, 0, 10), 5);
  assert.equal(clamp(-1, 0, 10), 0);
  assert.equal(clamp(11, 0, 10), 10);
});

test('hit 圆形碰撞判定', () => {
  assert.equal(hit({ x: 0, y: 0, r: 10 }, { x: 5, y: 0, r: 10 }), true);
  assert.equal(hit({ x: 0, y: 0, r: 10 }, { x: 20, y: 0, r: 10 }), true);
  assert.equal(hit({ x: 0, y: 0, r: 10 }, { x: 21, y: 0, r: 10 }), false);
  assert.equal(hit({ x: 0, y: 0, r: 1 }, { x: 0, y: 2, r: 1 }), true);
  assert.equal(hit({ x: 0, y: 0, r: 1 }, { x: 0, y: 2.1, r: 1 }), false);
});

test('weaponPattern 弹道数量随等级增加', () => {
  assert.equal(weaponPattern(1).length, 1);
  assert.equal(weaponPattern(2).length, 2);
  assert.equal(weaponPattern(3).length, 3);
  assert.equal(weaponPattern(99).length, 3); // 超上限按 3 级处理
});

test('weaponPattern 子弹都向上飞', () => {
  for (const level of [1, 2, 3]) {
    for (const b of weaponPattern(level)) {
      assert.ok(b.vy < 0, `level ${level} 子弹应向上`);
    }
  }
});

test('bossSpread 按血量分三阶段', () => {
  assert.equal(bossSpread(1).length, 3);
  assert.equal(bossSpread(0.8).length, 3);
  assert.equal(bossSpread(0.5).length, 5);
  assert.equal(bossSpread(0.2).length, 5);
});

test('bossRing 第一阶段不放环，后续阶段数量增加', () => {
  assert.equal(bossRing(0.8), 0);
  assert.equal(bossRing(0.5), 10);
  assert.equal(bossRing(0.2), 14);
});

test('bossFireInterval 随阶段缩短', () => {
  assert.equal(bossFireInterval(0.8), 1.4);
  assert.equal(bossFireInterval(0.5), 1.2);
  assert.equal(bossFireInterval(0.2), 1.0);
  assert.ok(bossFireInterval(0.2) < bossFireInterval(0.8));
});

test('spawnInterval 随时间缩短、Boss 期间降频、有下限', () => {
  const start = spawnInterval(0, false);
  const later = spawnInterval(60, false);
  const duringBoss = spawnInterval(0, true);
  assert.ok(later < start);
  assert.ok(duringBoss > start);
  assert.ok(spawnInterval(10000, false) >= 0.35);
});
