require('dotenv').config();
const express = require('express');
const path = require('path');
const crypto = require('crypto');
const { promisify } = require('util');
const scrypt = promisify(crypto.scrypt);
const db = require('./db');
const { hashPassword } = require('./scripts/hash-password');

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '127.0.0.1';

// ── 인증 설정 (없으면 기동 거부) ──────────────────
const { AUTH_USER, AUTH_PASS_HASH, SESSION_SECRET } = process.env;
if (!AUTH_USER || !/^scrypt\$[0-9a-f]+\$[0-9a-f]+$/i.test(AUTH_PASS_HASH || '') || !SESSION_SECRET || SESSION_SECRET.length < 32) {
  console.error('AUTH_USER, AUTH_PASS_HASH(scrypt$salt$hash), SESSION_SECRET(32자 이상)을 .env에 설정하세요. (node scripts/hash-password.js <password>)');
  process.exit(1);
}
let passHash = AUTH_PASS_HASH; // 기동 시 DB settings.pass_hash가 있으면 그것으로 교체
const SESSION_MS = 7 * 24 * 60 * 60 * 1000;
const LOCK_MS = 15 * 60 * 1000;
const MAX_FAILS_PER_IP = 5;
const MAX_FAILS_GLOBAL = 100;

const sha256 = s => crypto.createHash('sha256').update(String(s)).digest();
const safeEqual = (a, b) => crypto.timingSafeEqual(sha256(a), sha256(b));
// 서명에 현재 비밀번호 해시 포함 → 비밀번호 변경 시 기존 세션 전부 무효
const sign = data => crypto.createHmac('sha256', SESSION_SECRET).update(`${passHash}|${data}`).digest('base64url');

async function checkPassword(pw) {
  const [, salt, hash] = passHash.split('$');
  const expected = Buffer.from(hash, 'hex');
  const got = await scrypt(String(pw), Buffer.from(salt, 'hex'), expected.length);
  return crypto.timingSafeEqual(got, expected);
}

function issueSession(req, res) {
  const data = `${AUTH_USER}|${Date.now() + SESSION_MS}`;
  res.cookie('sid', `${data}|${sign(data)}`, { ...cookieOpts(req), maxAge: SESSION_MS });
}

// 쿠키 값: user|expiry|HMAC(passHash|user|expiry)
function isLoggedIn(req) {
  const m = /(?:^|;\s*)sid=([^;]*)/.exec(req.headers.cookie || '');
  if (!m) return false;
  let v;
  try { v = decodeURIComponent(m[1]); } catch { return false; }
  const i = v.lastIndexOf('|');
  const data = v.slice(0, i);
  if (i < 0 || !safeEqual(v.slice(i + 1), sign(data))) return false;
  const j = data.lastIndexOf('|');
  return data.slice(0, j) === AUTH_USER && Number(data.slice(j + 1)) > Date.now();
}

function cookieOpts(req) {
  // 평문 http는 localhost 개발 환경에서만 허용
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(req.hostname);
  return { httpOnly: true, secure: req.secure || !local, sameSite: 'strict', path: '/' };
}

// ── 로그인 실패 카운터 (메모리) ───────────────────
// ponytail: in-memory, 재시작 시 초기화. 다중 프로세스면 공유 저장소 필요.
const fails = new Map(); // key(ip 또는 '*') -> { n, t: 마지막 실패 시각 }
function isLocked(key, max) {
  const e = fails.get(key);
  if (e && Date.now() - e.t > LOCK_MS) { fails.delete(key); return false; }
  return !!e && e.n >= max;
}
function countAttempt(key) {
  const e = fails.get(key) || { n: 0 };
  e.n++; e.t = Date.now();
  fails.set(key, e);
  if (fails.size > 1000) for (const [k, x] of fails) if (Date.now() - x.t > LOCK_MS) fails.delete(k);
}
function clearFails(ip) {
  fails.delete(ip);
  const all = fails.get('*');
  if (all) all.n--;
}

const app = express();
app.set('trust proxy', 'loopback');
app.disable('x-powered-by');

// 보안 헤더
app.use((req, res, next) => {
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'same-origin',
    'X-Robots-Tag': 'noindex, nofollow',
    'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; " +
      "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; font-src 'self' https://cdn.jsdelivr.net; " +
      "img-src 'self' data:; object-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
  });
  next();
});

// 헬스체크 (OCI 유휴 방지용)
app.get('/health', (req, res) => res.json({ status: 'ok' }));
app.get('/robots.txt', (req, res) => res.type('text/plain').send('User-agent: *\nDisallow: /\n'));

// CSRF: 상태 변경 요청은 Origin이 있으면 Host와 일치해야 함 (+ SameSite=Strict 쿠키)
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method) || !origin) return next();
  let host;
  try { host = new URL(origin).host; } catch {}
  if (host !== req.headers.host) return res.status(403).json({ error: '허용되지 않은 요청입니다.' });
  next();
});

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// ── 로그인 / 로그아웃 ─────────────────────────────
app.get('/login', (req, res) => res.sendFile(path.join(__dirname, 'public', 'login.html')));

app.post('/api/auth/login', async (req, res) => {
  const ip = req.ip;
  if (isLocked(ip, MAX_FAILS_PER_IP) || isLocked('*', MAX_FAILS_GLOBAL))
    return res.status(429).json({ error: '로그인 시도가 너무 많습니다. 15분 후 다시 시도하세요.' });
  // 검증 전에 먼저 카운트 (동시 요청으로 한도 우회 방지)
  countAttempt(ip); countAttempt('*');
  const { username = '', password = '' } = req.body || {};
  const userOk = safeEqual(username, AUTH_USER);
  const passOk = await checkPassword(password);
  if (!userOk || !passOk) return res.status(401).json({ error: '아이디 또는 비밀번호가 올바르지 않습니다.' });
  clearFails(ip);
  issueSession(req, res);
  res.json({ ok: true });
});

// 인증 게이트: 여기 이후의 모든 경로(정적 파일 포함)는 로그인 필요
const PUBLIC_PATHS = new Set(['/login', '/style.css']);
app.use((req, res, next) => {
  if (PUBLIC_PATHS.has(req.path) || isLoggedIn(req)) return next();
  if (req.path.toLowerCase().startsWith('/api/')) return res.status(401).json({ error: '로그인이 필요합니다.' });
  res.redirect('/login');
});

app.post('/api/auth/logout', (req, res) => {
  res.clearCookie('sid', cookieOpts(req));
  res.json({ ok: true });
});

app.post('/api/auth/password', async (req, res, next) => {
  const { currentPassword = '', newPassword } = req.body || {};
  if (typeof newPassword !== 'string' || newPassword.length < 8 || newPassword.length > 200)
    return res.status(400).json({ error: '새 비밀번호는 8자 이상 200자 이하여야 합니다.' });
  if (newPassword === currentPassword)
    return res.status(400).json({ error: '새 비밀번호가 현재 비밀번호와 같습니다.' });
  const ip = req.ip;
  if (isLocked(ip, MAX_FAILS_PER_IP) || isLocked('*', MAX_FAILS_GLOBAL))
    return res.status(429).json({ error: '시도가 너무 많습니다. 15분 후 다시 시도하세요.' });
  countAttempt(ip); countAttempt('*');
  // 401은 클라이언트가 로그인 페이지로 보내므로 403 사용
  if (!(await checkPassword(currentPassword)))
    return res.status(403).json({ error: '현재 비밀번호가 올바르지 않습니다.' });
  clearFails(ip);
  try {
    const hash = hashPassword(newPassword);
    await db.runAsync('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', ['pass_hash', hash]);
    passHash = hash;
  } catch (e) { return next(e); }
  issueSession(req, res); // 기존 쿠키는 무효가 됐으므로 호출자에게 새로 발급
  res.json({ ok: true });
});

app.use(express.static(path.join(__dirname, 'public')));

// API 라우트
app.use('/api/skills', require('./routes/skills'));
app.use('/api/resume', require('./routes/resume'));
app.use('/api/goals', require('./routes/goals'));
app.use('/api/files', require('./routes/files'));

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 전역 에러 핸들러
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: '서버 오류가 발생했습니다.' });
});

// serialize: db.js의 CREATE TABLE 이후에 조회되도록 보장
new Promise(r => db.serialize(() => r(db.getAsync("SELECT value FROM settings WHERE key = 'pass_hash'")))).then(row => {
  if (row) passHash = row.value;
  app.listen(PORT, HOST, () => {
    console.log(`🚀 Career PMS 서버 시작: http://${HOST}:${PORT}`);
    console.log(`📁 파일 업로드 한도: ${process.env.MAX_FILE_SIZE_MB || 50}MB / 파일`);
    console.log(`💾 전체 저장 한도: ${process.env.MAX_STORAGE_GB || 10}GB`);
  });
});
