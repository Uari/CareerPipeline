// 서버를 임시 DB/업로드 폴더로 띄워서 인증·보안 동작을 확인
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { spawn, spawnSync, execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const net = require('node:net');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const PASSWORD = 'correct horse battery';
let server, base, tmp, env;

const freePort = () => new Promise(res => {
  const s = net.createServer().listen(0, '127.0.0.1', () => { const { port } = s.address(); s.close(() => res(port)); });
});
const login = (password, headers = {}) => fetch(`${base}/api/auth/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json', ...headers },
  body: JSON.stringify({ username: 'tester', password }),
});

before(async () => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cp-test-'));
  const port = await freePort();
  base = `http://127.0.0.1:${port}`;
  env = {
    ...process.env, PORT: String(port), HOST: '127.0.0.1',
    DB_PATH: path.join(tmp, 'test.db'), UPLOAD_DIR: path.join(tmp, 'uploads'),
    AUTH_USER: 'tester',
    AUTH_PASS_HASH: execFileSync(process.execPath, ['scripts/hash-password.js', PASSWORD], { cwd: ROOT, encoding: 'utf8' }).trim(),
    SESSION_SECRET: 'x'.repeat(48),
  };
  server = spawn(process.execPath, ['server.js'], { cwd: ROOT, env, stdio: ['ignore', 'ignore', 'inherit'] });
  for (let i = 0; i < 100; i++) {
    try { if ((await fetch(`${base}/health`)).ok) return; } catch {}
    await new Promise(r => setTimeout(r, 100));
  }
  throw new Error('server did not start');
});

after(() => {
  server?.kill();
  try { fs.rmSync(tmp, { recursive: true, force: true }); } catch {}
});

test('refuses to start without auth config', () => {
  const r = spawnSync(process.execPath, ['server.js'], { cwd: ROOT, env: { ...env, AUTH_USER: '', PORT: '0' }, timeout: 10000 });
  assert.strictEqual(r.status, 1);
});

test('public endpoints and security headers', async () => {
  const h = await fetch(`${base}/health`);
  assert.deepStrictEqual(await h.json(), { status: 'ok' });
  assert.strictEqual(h.headers.get('x-content-type-options'), 'nosniff');
  assert.strictEqual(h.headers.get('x-frame-options'), 'DENY');
  assert.strictEqual(h.headers.get('referrer-policy'), 'same-origin');
  assert.strictEqual(h.headers.get('x-robots-tag'), 'noindex, nofollow');
  assert.match(h.headers.get('content-security-policy'), /frame-ancestors 'none'/);
  assert.strictEqual(h.headers.get('x-powered-by'), null);

  const robots = await fetch(`${base}/robots.txt`);
  assert.strictEqual(robots.status, 200);
  assert.match(await robots.text(), /Disallow: \//);

  assert.strictEqual((await fetch(`${base}/login`)).status, 200);
  assert.strictEqual((await fetch(`${base}/style.css`)).status, 200);
});

test('unauthenticated requests are blocked', async () => {
  const api = await fetch(`${base}/api/skills`);
  assert.strictEqual(api.status, 401);
  for (const p of ['/', '/app.js', '/index.html']) {
    const r = await fetch(base + p, { redirect: 'manual' });
    assert.strictEqual(r.status, 302, p);
    assert.strictEqual(r.headers.get('location'), '/login');
  }
});

test('wrong password 401, 6th rapid failure 429', async () => {
  assert.strictEqual((await login('nope')).status, 401);
  const xff = { 'X-Forwarded-For': '203.0.113.9' }; // 별도 IP로 잠금 (trust proxy 확인 겸)
  for (let i = 1; i <= 5; i++) assert.strictEqual((await login('nope', xff)).status, 401, `attempt ${i}`);
  assert.strictEqual((await login(PASSWORD, xff)).status, 429);
});

test('login, session cookie, tamper, CSRF, logout', async () => {
  const r = await login(PASSWORD, { 'X-Forwarded-Proto': 'https' });
  assert.strictEqual(r.status, 200);
  const setCookie = r.headers.get('set-cookie');
  assert.match(setCookie, /HttpOnly/);
  assert.match(setCookie, /SameSite=Strict/);
  assert.match(setCookie, /Secure/);
  const cookie = setCookie.split(';')[0];

  assert.strictEqual((await fetch(`${base}/api/skills`, { headers: { cookie } })).status, 200);
  assert.strictEqual((await fetch(`${base}/`, { headers: { cookie }, redirect: 'manual' })).status, 200);

  const tampered = cookie.slice(0, -2) + (cookie.endsWith('AA') ? 'BB' : 'AA');
  assert.strictEqual((await fetch(`${base}/api/skills`, { headers: { cookie: tampered } })).status, 401);

  const post = origin => fetch(`${base}/api/skills`, {
    method: 'POST', headers: { cookie, origin, 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'x' }),
  });
  assert.strictEqual((await post('https://evil.example')).status, 403);
  assert.strictEqual((await post(base)).status, 201);

  const out = await fetch(`${base}/api/auth/logout`, { method: 'POST', headers: { cookie } });
  assert.strictEqual(out.status, 200);
  assert.match(out.headers.get('set-cookie'), /sid=;/);
});
