/**
 * 零依赖静态检查：所有 JS 语法合法 + 所有 JSON 可解析
 * 用法：node tools/check.js（CI 与本地共用）
 */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
let jsCount = 0;
let jsonCount = 0;
let failed = 0;

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    const rel = path.relative(ROOT, full);

    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.git') continue;
      walk(full);
      continue;
    }

    if (entry.name.endsWith('.js')) {
      jsCount += 1;
      const res = spawnSync(process.execPath, ['--check', full], { encoding: 'utf8' });
      if (res.status !== 0) {
        failed += 1;
        console.error(`❌ JS 语法错误: ${rel}\n${res.stderr || res.stdout}`);
      }
    } else if (entry.name.endsWith('.json')) {
      jsonCount += 1;
      try {
        JSON.parse(fs.readFileSync(full, 'utf8'));
      } catch (err) {
        failed += 1;
        console.error(`❌ JSON 无效: ${rel}\n${err.message}`);
      }
    }
  }
}

walk(ROOT);
console.log(`检查完成：JS ${jsCount} 个，JSON ${jsonCount} 个，失败 ${failed} 个`);
process.exit(failed ? 1 : 0);
