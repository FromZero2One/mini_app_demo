const test = require('node:test');
const assert = require('node:assert');
const http = require('node:http');
const path = require('node:path');
const { spawn } = require('node:child_process');

const PORT = 3199;
let child;

function get(p) {
  return new Promise((resolve, reject) => {
    const req = http.get({ host: '127.0.0.1', port: PORT, path: p }, res => {
      let body = '';
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => {
        let parsed = null;
        try { parsed = JSON.parse(body); } catch (e) { /* keep null */ }
        resolve({ status: res.statusCode, body: parsed });
      });
    });
    req.on('error', reject);
    req.setTimeout(2000, () => req.destroy(new Error('timeout')));
  });
}

async function waitForServer() {
  for (let i = 0; i < 50; i++) {
    try {
      await get('/api/health');
      return;
    } catch (e) {
      await new Promise(r => setTimeout(r, 100));
    }
  }
  throw new Error('mock server 未能在 5 秒内启动');
}

test.before(async () => {
  child = spawn(process.execPath, [path.join(__dirname, '..', '..', 'mock-server', 'server.js')], {
    env: Object.assign({}, process.env, { PORT: String(PORT) }),
    stdio: 'ignore',
  });
  await waitForServer();
});

test.after(() => {
  if (child) child.kill();
});

test('GET /api/health 返回 code=0 且状态 up', async () => {
  const res = await get('/api/health');
  assert.equal(res.status, 200);
  assert.equal(res.body.code, 0);
  assert.equal(res.body.data.status, 'up');
});

test('GET /api/articles 分页正确且列表不含正文', async () => {
  const res = await get('/api/articles?page=2&size=3');
  assert.equal(res.status, 200);
  assert.equal(res.body.code, 0);
  assert.equal(res.body.data.list.length, 3);
  assert.equal(res.body.data.page, 2);
  assert.equal(res.body.data.size, 3);
  assert.equal(typeof res.body.data.hasMore, 'boolean');
  assert.equal(res.body.data.list[0].content, undefined);
});

test('GET /api/articles/:id 返回正文', async () => {
  const res = await get('/api/articles/1');
  assert.equal(res.body.code, 0);
  assert.equal(res.body.data.id, 1);
  assert.ok(typeof res.body.data.content === 'string' && res.body.data.content.length > 0);
});

test('GET /api/articles/999 返回 404', async () => {
  const res = await get('/api/articles/999');
  assert.equal(res.status, 404);
  assert.equal(res.body.code, 404);
});
