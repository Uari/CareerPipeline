// 공유 링크(소유자) + 공개 열람(/r, /api/public) + 소유자 미리보기(/preview) — 루트에 마운트
// /r/<token>, /api/public/<token>[/files/<id>]만 server.js 인증 게이트 허용 목록에 있음. 나머지는 로그인 필요.
const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const db = require('../db');
const { v4: uuidv4 } = require('uuid');
const { cleanItem, links, str, parseJSON, wrap, fail } = require('../resume-schema');
const feeds = require('../feeds');

const UPLOAD_DIR = path.resolve(process.env.UPLOAD_DIR || './uploads');
const R_HTML = path.join(__dirname, '..', 'public', 'r.html');
const TOKEN_RE = /^[A-Za-z0-9_-]{43}$/; // randomBytes(32) base64url
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CATS = { lang: '언어', framework: '프레임워크', devops: 'DevOps', etc: '기타', soft: '소프트스킬' };
// 브라우저에서 바로 볼 수 있게 허용하는 확장자만. 그 외(html/svg 포함)는 전부 다운로드 강제
const INLINE_TYPES = {
  '.pdf': 'application/pdf', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.gif': 'image/gif', '.webp': 'image/webp',
};
const inlineType = name => INLINE_TYPES[path.extname(String(name)).toLowerCase()];

// ── 공개 뷰 빌더: 명시적 화이트리스트로만 구성 (주소·생년월일은 절대 포함 안 함) ──
// GitHub/블로그는 사용자명·RSS URL이 설정된 경우만, feeds.js가 가공한 필드만 포함. 실패하면 키 자체가 빠짐
async function buildView(resume, showPhone) {
  const p = (await db.getAsync('SELECT name, headline, intro, email, phone, links, github_username, blog_rss_url FROM profile WHERE id = 1')) || {};
  const external = Promise.all([feeds.github(p.github_username), feeds.blog(p.blog_rss_url)]); // 나머지 조회와 병렬 (reject 안 함)
  const inc = parseJSON(resume.include, null);
  const only = inc && Array.isArray(inc.item_ids) ? new Set(inc.item_ids) : null;

  const items = [];
  for (const r of await db.allAsync('SELECT id, type, data FROM resume_items ORDER BY sort_order, created_at')) {
    if (only && !only.has(r.id)) continue;
    try { items.push({ id: r.id, type: r.type, data: cleanItem(r.type, parseJSON(r.data, {})) }); } catch {} // 손상된 행은 생략
  }

  const skills = [];
  for (const s of await db.allAsync('SELECT name, category, level FROM skills ORDER BY level DESC, name')) {
    const category = Object.hasOwn(CATS, s.category) ? s.category : 'etc';
    let g = skills.find(x => x.category === category);
    if (!g) skills.push(g = { category, label: CATS[category], items: [] });
    g.items.push({ name: String(s.name), level: Math.max(1, Math.min(5, parseInt(s.level, 10) || 1)) });
  }
  const catOrder = Object.keys(CATS);
  skills.sort((a, b) => catOrder.indexOf(a.category) - catOrder.indexOf(b.category));

  const files = await db.allAsync('SELECT id, title, original_name, size FROM files WHERE is_public = 1 ORDER BY created_at DESC');
  let profileLinks = [];
  try { profileLinks = links(parseJSON(p.links, [])); } catch {}

  const view = {
    name: str(p.name, 100),
    headline: str(resume.headline || p.headline, 200),
    intro: str(resume.intro || p.intro, 5000),
    email: str(p.email, 200),
    links: profileLinks,
    skills,
    items,
    files: files.map(f => ({
      id: f.id, title: str(f.title, 200), original_name: String(f.original_name),
      mime: inlineType(f.original_name) || 'application/octet-stream', size: f.size,
    })),
  };
  if (showPhone && p.phone) view.phone = str(p.phone, 50);
  const [github, blog] = await external;
  if (github) view.github = github;
  if (blog && blog.posts.length) view.blog = blog;
  return view;
}

function sendPublicFile(res, file) {
  const filePath = path.join(UPLOAD_DIR, path.basename(file.stored_name));
  if (!fs.existsSync(filePath)) return notFound(res);
  const type = inlineType(file.original_name);
  res.set({
    'Content-Type': type || 'application/octet-stream', // 저장된 mime은 신뢰하지 않음
    'Content-Disposition': `${type ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(file.original_name)}`,
    'Content-Security-Policy': "sandbox; default-src 'none'; img-src 'self'; style-src 'unsafe-inline'",
    'Cache-Control': 'private, no-store',
  });
  res.sendFile(filePath);
}

// 없음/만료/폐기 모두 같은 응답 (존재 여부 오라클 방지)
const notFound = res => res.status(404).json({ error: '링크를 찾을 수 없습니다.' });

async function activeLink(token) {
  if (!TOKEN_RE.test(token)) return null;
  return db.getAsync(
    `SELECT l.id AS link_id, l.show_phone, r.* FROM share_links l JOIN resumes r ON r.id = l.resume_id
     WHERE l.token = ? AND l.revoked_at IS NULL AND (l.expires_at IS NULL OR l.expires_at > datetime('now','localtime'))`,
    [token]
  );
}

// ── 공개 (로그인 불필요) ──
router.get('/r/:token', wrap(async (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.status((await activeLink(req.params.token)) ? 200 : 404).sendFile(R_HTML);
}));

router.get('/api/public/:token', wrap(async (req, res) => {
  res.set('Cache-Control', 'no-store');
  const link = await activeLink(req.params.token);
  if (!link) return notFound(res);
  const view = await buildView(link, !!link.show_phone);
  await db.runAsync('INSERT INTO share_views (link_id, ip, user_agent) VALUES (?, ?, ?)',
    [link.link_id, String(req.ip || '').slice(0, 64), String(req.get('user-agent') || '').slice(0, 300)]);
  res.json(view);
}));

router.get('/api/public/:token/files/:fileId', wrap(async (req, res) => {
  const link = await activeLink(req.params.token);
  if (!link || !UUID_RE.test(req.params.fileId)) return notFound(res);
  const file = await db.getAsync('SELECT * FROM files WHERE id = ? AND is_public = 1', [req.params.fileId]);
  if (!file) return notFound(res);
  sendPublicFile(res, file);
}));

// ── 소유자 미리보기 (로그인 필요: 허용 목록에 없음) ──
router.get('/preview/:id', (req, res) => res.sendFile(R_HTML));

router.get('/api/preview/:id', wrap(async (req, res) => {
  const resume = await db.getAsync('SELECT * FROM resumes WHERE id = ?', [req.params.id]);
  if (!resume) return res.status(404).json({ error: '이력서를 찾을 수 없습니다.' });
  res.json({ ...(await buildView(resume, req.query.phone === '1')), preview: true });
}));

router.get('/api/preview/:id/files/:fileId', wrap(async (req, res) => {
  const file = UUID_RE.test(req.params.fileId) && await db.getAsync('SELECT * FROM files WHERE id = ? AND is_public = 1', [req.params.fileId]);
  if (!file) return res.status(404).json({ error: '파일을 찾을 수 없습니다.' });
  sendPublicFile(res, file);
}));

// ── 공유 링크 관리 ──
const LINK_SELECT = `SELECT l.id, l.token, l.resume_id, l.label, l.show_phone, l.expires_at, l.revoked_at, l.created_at,
  r.title AS resume_title,
  (SELECT COUNT(*) FROM share_views v WHERE v.link_id = l.id) AS view_count,
  (SELECT MAX(viewed_at) FROM share_views v WHERE v.link_id = l.id) AS last_viewed_at,
  CASE WHEN l.revoked_at IS NOT NULL THEN 'revoked'
       WHEN l.expires_at IS NOT NULL AND l.expires_at <= datetime('now','localtime') THEN 'expired'
       ELSE 'active' END AS status
  FROM share_links l LEFT JOIN resumes r ON r.id = l.resume_id`;
const withUrl = req => l => ({ ...l, url: `${req.protocol}://${req.get('host')}/r/${l.token}` });

router.get('/api/share-links', wrap(async (req, res) => {
  res.json((await db.allAsync(`${LINK_SELECT} ORDER BY l.created_at DESC`)).map(withUrl(req)));
}));

router.post('/api/share-links', wrap(async (req, res) => {
  const { resume_id, label, show_phone, days, expires_at } = req.body || {};
  if (!(await db.getAsync('SELECT id FROM resumes WHERE id = ?', [String(resume_id ?? '')])))
    return res.status(400).json({ error: '이력서 버전을 선택하세요.' });
  let expiry = null; // 'YYYY-MM-DD HH:MM:SS' 로컬시각 (DB 기본값과 동일 형식)
  if (days != null && days !== '') {
    const n = Number(days);
    if (!Number.isInteger(n) || n < 1 || n > 3650) fail('만료 기간은 1~3650일이어야 합니다.');
    expiry = (await db.getAsync(`SELECT datetime('now','localtime', ?) AS t`, [`+${n} days`])).t;
  } else if (expires_at) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(expires_at))) fail('만료일 형식은 YYYY-MM-DD여야 합니다.');
    expiry = `${expires_at} 23:59:59`;
  }
  const id = uuidv4();
  await db.runAsync('INSERT INTO share_links (id, token, resume_id, label, show_phone, expires_at) VALUES (?, ?, ?, ?, ?, ?)',
    [id, crypto.randomBytes(32).toString('base64url'), resume_id, str(label, 100), show_phone === true || show_phone === 1 ? 1 : 0, expiry]);
  res.status(201).json(withUrl(req)(await db.getAsync(`${LINK_SELECT} WHERE l.id = ?`, [id])));
}));

router.post('/api/share-links/:id/revoke', wrap(async (req, res) => {
  const r = await db.runAsync(`UPDATE share_links SET revoked_at = COALESCE(revoked_at, datetime('now','localtime')) WHERE id = ?`, [req.params.id]);
  if (!r.changes) return res.status(404).json({ error: '링크를 찾을 수 없습니다.' });
  res.json(withUrl(req)(await db.getAsync(`${LINK_SELECT} WHERE l.id = ?`, [req.params.id])));
}));

router.delete('/api/share-links/:id', wrap(async (req, res) => {
  await db.runAsync('DELETE FROM share_views WHERE link_id = ?', [req.params.id]);
  const r = await db.runAsync('DELETE FROM share_links WHERE id = ?', [req.params.id]);
  if (!r.changes) return res.status(404).json({ error: '링크를 찾을 수 없습니다.' });
  res.json({ message: '삭제되었습니다.' });
}));

router.get('/api/share-links/:id/views', wrap(async (req, res) => {
  res.json(await db.allAsync('SELECT viewed_at, ip, user_agent FROM share_views WHERE link_id = ? ORDER BY id DESC LIMIT 500', [req.params.id]));
}));

module.exports = router;
