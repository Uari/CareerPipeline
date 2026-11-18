// 구조화 이력서 + 공유 링크: 소유자 API, 공개 뷰 화이트리스트, 파일 공개 범위, 링크 무효화
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { spawn, execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const net = require('node:net');
const http = require('node:http');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const PASSWORD = 'resume test password';
let server, base, tmp, cookie;

// GitHub API 스텁 (루프백). octo-user만 응답, 나머지는 500 → 섹션 생략 확인용
const GH_TOKEN = 'ghp_TEST_' + require('node:crypto').randomBytes(12).toString('hex');
const week = i => ({ contributionDays: Array.from({ length: 7 }, (_, d) => ({ date: 'x', contributionCount: (i * 7 + d) % 9, color: '#ff0000' })) });
const GH_USER = {
  name: 'Octo', bio: 'bio', email: 'leak@example.com', url: 'https://github.com/octo-user', followers: { totalCount: 42 },
  pinnedItems: { nodes: [
    { name: 'alpha', description: '<b>d</b>', url: 'https://github.com/octo-user/alpha', stargazerCount: 5, forkCount: 1, isPrivate: false,
      primaryLanguage: { name: 'Go', color: '#00ADD8' }, updatedAt: '2026-11-01T00:00:00Z', secret: 'x' },
    { name: 'hidden', url: 'https://github.com/octo-user/hidden', isPrivate: true },
    { name: 'evil', url: 'javascript:alert(1)', isPrivate: false, primaryLanguage: { name: 'X', color: 'red;background:url(x)' } },
    {},
  ] },
  repositories: { nodes: [] },
  contributionsCollection: { contributionCalendar: { totalContributions: 123, weeks: Array.from({ length: 53 }, (_, i) => week(i)) } },
};
const gh = { auth: null, hits: 0 };
const ghStub = http.createServer((req, res) => {
  let body = '';
  req.on('data', c => { body += c; });
  req.on('end', () => {
    gh.hits++;
    gh.auth = req.headers.authorization;
    const login = req.url === '/graphql' && JSON.parse(body).variables.login;
    if (login !== 'octo-user') { res.writeHead(500); return res.end(); }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ data: { user: GH_USER } }));
  });
});

const freePort = () => new Promise(res => {
  const s = net.createServer().listen(0, '127.0.0.1', () => { const { port } = s.address(); s.close(() => res(port)); });
});

before(async () => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cp-resume-'));
  const port = await freePort();
  base = `http://127.0.0.1:${port}`;
  await new Promise(r => ghStub.listen(0, '127.0.0.1', r));
  const env = {
    ...process.env, PORT: String(port), HOST: '127.0.0.1',
    DB_PATH: path.join(tmp, 'test.db'), UPLOAD_DIR: path.join(tmp, 'uploads'),
    AUTH_USER: 'tester',
    AUTH_PASS_HASH: execFileSync(process.execPath, ['scripts/hash-password.js', PASSWORD], { cwd: ROOT, encoding: 'utf8' }).trim(),
    SESSION_SECRET: 'y'.repeat(48),
    GITHUB_API_URL: `http://127.0.0.1:${ghStub.address().port}`, GITHUB_TOKEN: GH_TOKEN,
  };
  server = spawn(process.execPath, ['server.js'], { cwd: ROOT, env, stdio: ['ignore', 'ignore', 'inherit'] });
  for (let i = 0; i < 100 && !cookie; i++) {
    try {
      const r = await fetch(`${base}/api/auth/login`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'tester', password: PASSWORD }),
      });
      if (r.ok) cookie = r.headers.get('set-cookie').split(';')[0];
    } catch { await new Promise(r => setTimeout(r, 100)); }
  }
  assert.ok(cookie, 'server did not start');
});

after(() => {
  server?.kill();
  ghStub.close();
  try { fs.rmSync(tmp, { recursive: true, force: true }); } catch {}
});

const api = async (method, p, body) => {
  const r = await fetch(base + p, {
    method, headers: { cookie, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: r.status, body: await r.json().catch(() => null) };
};
const upload = async (name, content) => {
  const fd = new FormData();
  fd.append('file', new Blob([content]), name);
  const r = await fetch(`${base}/api/files/upload`, { method: 'POST', headers: { cookie }, body: fd });
  assert.strictEqual(r.status, 201);
  return (await r.json()).id;
};

const PRIVATE = { phone: '010-1234-5678', address: '서울시 비밀구 비밀로 1', birth_date: '1990-01-02', github_username: 'secret-gh' };
let resumeId, itemIds = {};

test('profile and resume items CRUD + validation', async () => {
  let r = await api('PUT', '/api/profile', {
    name: '박개발', headline: '백엔드 개발자', intro: '안녕하세요.\n두 번째 문단.', email: 'dev@example.com', ...PRIVATE,
    links: [{ label: 'GitHub', url: 'https://github.com/x' }],
  });
  assert.strictEqual(r.status, 200);
  assert.strictEqual(r.body.name, '박개발');
  assert.deepStrictEqual(r.body.links, [{ label: 'GitHub', url: 'https://github.com/x' }]);
  assert.strictEqual((await api('PUT', '/api/profile', { links: [{ label: 'x', url: 'javascript:alert(1)' }] })).status, 400);
  assert.strictEqual((await api('PUT', '/api/profile', { email: 'not-an-email' })).status, 400);
  assert.strictEqual((await api('GET', '/api/profile')).body.email, 'dev@example.com'); // 실패한 요청은 반영 안 됨

  r = await api('POST', '/api/resume-items', { type: 'experience', data: { company: '  카카오  ', role: '서버', start: '2022-03', current: true, evil: '<x>' } });
  assert.strictEqual(r.status, 201);
  assert.strictEqual(r.body.data.company, '카카오');
  assert.strictEqual(r.body.data.evil, undefined);
  itemIds.exp = r.body.id;

  assert.strictEqual((await api('POST', '/api/resume-items', { type: 'experience', data: { role: 'x' } })).status, 400);
  assert.strictEqual((await api('POST', '/api/resume-items', { type: 'nope', data: { name: 'x' } })).status, 400);
  assert.strictEqual((await api('POST', '/api/resume-items', { type: 'experience', data: { company: 'a', start: '2022/03' } })).status, 400);
  assert.strictEqual((await api('POST', '/api/resume-items', { type: 'project', data: { title: 'p', links: [{ url: 'ftp://x' }] } })).status, 400);

  r = await api('POST', '/api/resume-items', { type: 'project', data: { title: '결제 시스템', experience_id: itemIds.exp, metrics: ['p99 40% 감소', ''], stack: ['Node.js'] } });
  assert.strictEqual(r.status, 201);
  assert.deepStrictEqual(r.body.data.metrics, ['p99 40% 감소']);
  itemIds.proj = r.body.id;
  itemIds.cert = (await api('POST', '/api/resume-items', { type: 'certification', data: { name: '정보처리기사', date: '2020-05' } })).body.id;
  const second = (await api('POST', '/api/resume-items', { type: 'certification', data: { name: 'SQLD' } })).body.id;

  assert.strictEqual((await api('POST', `/api/resume-items/${second}/move`, { dir: 'up' })).status, 200);
  const certs = (await api('GET', '/api/resume-items?type=certification')).body;
  assert.deepStrictEqual(certs.map(c => c.data.name), ['SQLD', '정보처리기사']);

  r = await api('PUT', `/api/resume-items/${second}`, { data: { name: 'SQLD 2' } });
  assert.strictEqual(r.body.data.name, 'SQLD 2');
  assert.strictEqual((await api('DELETE', `/api/resume-items/${second}`)).status, 200);
  assert.strictEqual((await api('DELETE', `/api/resume-items/${second}`)).status, 404);

  await api('POST', '/api/skills', { name: 'Node.js', category: 'lang', level: 4, note: '비공개 메모' });

  r = await api('POST', '/api/resume', { title: '백엔드용', headline: '결제 백엔드 엔지니어', include: { item_ids: [itemIds.exp, itemIds.proj] } });
  assert.strictEqual(r.status, 201);
  resumeId = r.body.id;
});

let file = {};
test('files: public toggle', async () => {
  file.secret = await upload('secret.pdf', '%PDF-1.4 secret');
  file.pdf = await upload('portfolio.pdf', '%PDF-1.4 public');
  file.html = await upload('evil.html', '<script>alert(1)</script>');
  for (const id of [file.pdf, file.html]) {
    const r = await api('PUT', `/api/files/${id}`, { is_public: true, title: '포트폴리오' });
    assert.strictEqual(r.status, 200);
    assert.strictEqual(r.body.is_public, 1);
  }
  assert.strictEqual((await api('PUT', `/api/files/${file.pdf}`, { is_public: 'yes' })).status, 400);
});

const NOT_FOUND = { error: '링크를 찾을 수 없습니다.' };
const pub = (token, suffix = '') => fetch(`${base}/api/public/${token}${suffix}`);
const randomToken = () => require('node:crypto').randomBytes(32).toString('base64url');

test('share link: public view is whitelisted and logged', async () => {
  const c = await api('POST', '/api/share-links', { resume_id: resumeId, label: '카카오 채용담당', days: 30 });
  assert.strictEqual(c.status, 201);
  assert.strictEqual(c.body.status, 'active');
  const token = c.body.token;
  assert.match(token, /^[A-Za-z0-9_-]{43}$/);
  assert.strictEqual(c.body.url, `${base}/r/${token}`);

  const page = await fetch(`${base}/r/${token}`);
  assert.strictEqual(page.status, 200);
  assert.match(await page.text(), /noindex,nofollow/);

  const r = await pub(token);
  assert.strictEqual(r.status, 200);
  const text = await r.clone().text();
  const v = await r.json();
  assert.strictEqual(v.name, '박개발');
  assert.strictEqual(v.email, 'dev@example.com');
  assert.strictEqual(v.headline, '결제 백엔드 엔지니어'); // 버전 오버라이드
  assert.strictEqual(v.phone, undefined);
  for (const s of Object.values(PRIVATE)) assert.ok(!text.includes(s), `leaked ${s}`);
  assert.ok(!text.includes('비공개 메모'));
  assert.deepStrictEqual(v.items.map(i => i.id).sort(), [itemIds.exp, itemIds.proj].sort()); // include 부분집합
  assert.deepStrictEqual(v.skills, [{ category: 'lang', label: '언어', items: [{ name: 'Node.js', level: 4 }] }]);
  assert.deepStrictEqual(v.files.map(f => f.id).sort(), [file.pdf, file.html].sort());
  assert.deepStrictEqual(Object.keys(v.files[0]).sort(), ['id', 'mime', 'original_name', 'size', 'title']);

  // 비공개 파일은 공개 엔드포인트로 접근 불가
  assert.strictEqual((await pub(token, `/files/${file.secret}`)).status, 404);
  const pdf = await pub(token, `/files/${file.pdf}`);
  assert.strictEqual(pdf.status, 200);
  assert.strictEqual(pdf.headers.get('content-type'), 'application/pdf');
  assert.ok(gh.hits > 0 && v.github === undefined, 'github fetch failure → section omitted');
  assert.match(pdf.headers.get('content-disposition'), /^inline/);
  assert.match(pdf.headers.get('content-security-policy'), /sandbox/);
  assert.strictEqual(pdf.headers.get('x-content-type-options'), 'nosniff');
  const html = await pub(token, `/files/${file.html}`);
  assert.strictEqual(html.headers.get('content-type'), 'application/octet-stream');
  assert.match(html.headers.get('content-disposition'), /^attachment/);

  const list = (await api('GET', '/api/share-links')).body;
  assert.strictEqual(list[0].view_count, 1);
  assert.ok(list[0].last_viewed_at);
  const views = (await api('GET', `/api/share-links/${c.body.id}/views`)).body;
  assert.strictEqual(views.length, 1);
  assert.ok(views[0].ip);
});

test('share link: show_phone toggle', async () => {
  const c = await api('POST', '/api/share-links', { resume_id: resumeId, show_phone: true });
  assert.strictEqual((await (await pub(c.body.token)).json()).phone, PRIVATE.phone);
});

test('github/blog sections: validated, whitelisted, token never exposed, failures omitted', async () => {
  for (const body of [{ github_username: '-bad' }, { github_username: 'a'.repeat(40) }, { github_username: 'a_b' }, { blog_rss_url: 'http://blog.example.com/rss' }])
    assert.strictEqual((await api('PUT', '/api/profile', body)).status, 400, JSON.stringify(body));
  // RSS는 SSRF 가드에 막혀 섹션 생략 (네트워크 없이 실패 경로 확인)
  assert.strictEqual((await api('PUT', '/api/profile', { github_username: 'octo-user', blog_rss_url: 'https://127.0.0.1/rss' })).status, 200);
  const link = (await api('POST', '/api/share-links', { resume_id: resumeId })).body;
  const r = await pub(link.token);
  assert.strictEqual(r.status, 200);
  const text = await r.text();
  const v = JSON.parse(text);
  assert.strictEqual(v.name, '박개발');
  assert.strictEqual(v.blog, undefined);
  assert.strictEqual(gh.auth, `bearer ${GH_TOKEN}`);
  const { calendar, ...rest } = v.github;
  assert.deepStrictEqual(rest, {
    url: 'https://github.com/octo-user', login: 'octo-user', name: 'Octo', bio: 'bio', followers: 42,
    repos: [{ name: 'alpha', description: '<b>d</b>', url: 'https://github.com/octo-user/alpha', stars: 5, forks: 1, language: 'Go', color: '#00ADD8', updated_at: '2026-11-01' }],
  });
  assert.strictEqual(calendar.total, 123);
  assert.strictEqual(calendar.weeks.length, 52);
  assert.deepStrictEqual(calendar.weeks[51], GH_USER.contributionsCollection.contributionCalendar.weeks[52].contributionDays.map(d => d.contributionCount));
  assert.ok(!text.includes('leak@example.com') && !text.includes('#ff0000'));

  const responses = [text, JSON.stringify((await api('GET', `/api/preview/${resumeId}`)).body), JSON.stringify((await api('GET', '/api/profile')).body),
    await (await fetch(`${base}/r/${link.token}`)).text()];
  assert.ok((await api('GET', `/api/preview/${resumeId}`)).body.github, 'preview includes github');
  for (const s of responses) assert.ok(!s.includes(GH_TOKEN), 'token leaked');
});

test('revoked / expired / random tokens give identical 404', async () => {
  const random = await pub(randomToken());
  const ref = { status: random.status, body: await random.json() };
  assert.deepStrictEqual(ref, { status: 404, body: NOT_FOUND });

  const revoked = (await api('POST', '/api/share-links', { resume_id: resumeId })).body;
  assert.strictEqual((await pub(revoked.token)).status, 200);
  assert.strictEqual((await api('POST', `/api/share-links/${revoked.id}/revoke`)).body.status, 'revoked');
  const expired = (await api('POST', '/api/share-links', { resume_id: resumeId, expires_at: '2000-01-01' })).body;
  assert.strictEqual(expired.status, 'expired');

  for (const t of [revoked.token, expired.token]) {
    const r = await pub(t);
    assert.deepStrictEqual({ status: r.status, body: await r.json() }, ref);
    assert.strictEqual((await pub(t, `/files/${file.pdf}`)).status, 404);
    assert.strictEqual((await fetch(`${base}/r/${t}`)).status, 404);
  }
  assert.strictEqual((await fetch(`${base}/r/${randomToken()}`)).status, 404);
  const views = (await api('GET', `/api/share-links/${revoked.id}/views`)).body;
  assert.strictEqual(views.length, 1); // 폐기 후 요청은 기록 안 됨
});

test('owner endpoints require login', async () => {
  for (const p of ['/api/share-links', '/api/profile', '/api/resume-items', `/api/preview/${resumeId}`]) {
    assert.strictEqual((await fetch(base + p)).status, 401, p);
  }
  const prev = await fetch(`${base}/preview/${resumeId}`, { redirect: 'manual' });
  assert.strictEqual(prev.status, 302);
  assert.strictEqual(prev.headers.get('location'), '/login');
  // 형식이 다른 경로는 허용 목록에 걸리지 않음
  assert.strictEqual((await fetch(`${base}/api/public/short`)).status, 401);

  const own = await api('GET', `/api/preview/${resumeId}`);
  assert.strictEqual(own.status, 200);
  assert.strictEqual(own.body.preview, true);
  assert.strictEqual((await fetch(`${base}/preview/${resumeId}`, { headers: { cookie } })).status, 200);
});
