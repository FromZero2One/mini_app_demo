/**
 * 星河战机：纯逻辑函数（无 wx / canvas 依赖，便于单元测试）
 */

function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}

/** 圆形碰撞检测 */
function hit(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const r = a.r + b.r;
  return dx * dx + dy * dy <= r * r;
}

/** 玩家火力弹道（单位：设计稿像素，调用方乘以缩放系数 K） */
function weaponPattern(weapon) {
  if (weapon === 2) {
    return [
      { dx: -9, dy: -22, vx: 0, vy: -640 },
      { dx: 9, dy: -22, vx: 0, vy: -640 },
    ];
  }
  if (weapon >= 3) {
    return [
      { dx: 0, dy: -22, vx: 0, vy: -691 },
      { dx: -12, dy: -18, vx: -110, vy: -640 },
      { dx: 12, dy: -18, vx: 110, vy: -640 },
    ];
  }
  return [{ dx: 0, dy: -22, vx: 0, vy: -640 }];
}

/** Boss 瞄准散射角度（按血量比例分三阶段） */
function bossSpread(ratio) {
  if (ratio > 0.66) return [-0.22, 0, 0.22];
  if (ratio > 0.33) return [-0.5, -0.25, 0, 0.25, 0.5];
  return [-0.7, -0.35, 0, 0.35, 0.7];
}

/** Boss 环形弹幕数量（第一阶段不放环） */
function bossRing(ratio) {
  if (ratio > 0.66) return 0;
  return ratio > 0.33 ? 10 : 14;
}

/** Boss 开火间隔 */
function bossFireInterval(ratio) {
  if (ratio > 0.66) return 1.4;
  return ratio > 0.33 ? 1.2 : 1.0;
}

/** 普通敌机生成间隔（随游戏时间缩短；Boss 期间降频） */
function spawnInterval(time, bossAlive) {
  const base = Math.max(0.35, 0.95 - time * 0.008);
  return base * (bossAlive ? 1.8 : 1);
}

module.exports = {
  clamp,
  hit,
  weaponPattern,
  bossSpread,
  bossRing,
  bossFireInterval,
  spawnInterval,
};
