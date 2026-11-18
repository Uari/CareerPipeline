// 이력서 항목/프로필 검증 — 필드 화이트리스트. 공개 뷰 빌더도 출력 시 같은 함수로 다시 거른다.

class ValidationError extends Error {}
const fail = msg => { throw new ValidationError(msg); };

const YM_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const ID_RE = /^[0-9a-f-]{36}$/i;

function str(v, max) {
  if (v == null) return '';
  if (typeof v !== 'string' && typeof v !== 'number') fail('입력 형식이 올바르지 않습니다.');
  return String(v).trim().slice(0, max);
}

function url(v) {
  const s = str(v, 500);
  if (!s) return '';
  let u;
  try { u = new URL(s); } catch { fail('링크는 http(s) 주소여야 합니다.'); }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') fail('링크는 http(s) 주소여야 합니다.');
  return u.href;
}

function list(v, max = 20, len = 200) {
  if (v == null) return [];
  if (!Array.isArray(v)) fail('목록 형식이 올바르지 않습니다.');
  return v.map(x => str(x, len)).filter(Boolean).slice(0, max);
}

function links(v) {
  if (v == null) return [];
  if (!Array.isArray(v)) fail('링크 형식이 올바르지 않습니다.');
  return v.slice(0, 10).map(l => ({ label: str(l?.label, 50), url: url(l?.url) })).filter(l => l.url);
}

const ym = v => {
  const s = str(v, 7);
  if (s && !YM_RE.test(s)) fail('날짜 형식은 YYYY-MM이어야 합니다.');
  return s;
};

const FIELD = {
  t:     v => str(v, 200),
  long:  v => str(v, 5000),
  ym,
  bool:  v => v === true || v === 1 || v === '1',
  id:    v => { const s = str(v, 36); return ID_RE.test(s) ? s : ''; },
  list:  v => list(v),
  links,
};

// type → { field: kind }, required: [field, 한글명]
const SCHEMA = {
  experience:    { f: { company: 't', role: 't', employment_type: 't', start: 'ym', end: 'ym', current: 'bool', summary: 'long' }, req: ['company', '회사명'] },
  project:       { f: { title: 't', experience_id: 'id', start: 'ym', end: 'ym', role: 't', problem: 'long', action: 'long', result: 'long', metrics: 'list', stack: 'list', links: 'links' }, req: ['title', '프로젝트명'] },
  education:     { f: { school: 't', major: 't', degree: 't', start: 'ym', end: 'ym', status: 't' }, req: ['school', '학교명'] },
  certification: { f: { name: 't', issuer: 't', date: 'ym' }, req: ['name', '자격증명'] },
  language:      { f: { test: 't', score: 't', date: 'ym' }, req: ['test', '시험명'] },
  award:         { f: { name: 't', issuer: 't', date: 'ym' }, req: ['name', '수상명'] },
  activity:      { f: { name: 't', org: 't', start: 'ym', end: 'ym', description: 'long' }, req: ['name', '활동명'] },
};

function cleanItem(type, data) {
  const s = typeof type === 'string' && Object.hasOwn(SCHEMA, type) ? SCHEMA[type] : null;
  if (!s) fail('알 수 없는 항목 유형입니다.');
  if (!data || typeof data !== 'object' || Array.isArray(data)) fail('입력 형식이 올바르지 않습니다.');
  const out = {};
  for (const [k, kind] of Object.entries(s.f)) out[k] = FIELD[kind](data[k]);
  if (!out[s.req[0]]) fail(`${s.req[1]}은(는) 필수입니다.`);
  return out;
}

const PROFILE = {
  name: v => str(v, 100),
  headline: v => str(v, 200),
  intro: v => str(v, 5000),
  email: v => { const s = str(v, 200); if (s && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) fail('이메일 형식이 올바르지 않습니다.'); return s; },
  phone: v => str(v, 50),
  address: v => str(v, 300),
  birth_date: v => { const s = str(v, 10); if (s && !/^\d{4}-\d{2}-\d{2}$/.test(s)) fail('생년월일 형식은 YYYY-MM-DD여야 합니다.'); return s; },
  links,
  github_username: v => { const s = str(v, 100); if (s && !/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/.test(s)) fail('GitHub 사용자명 형식이 올바르지 않습니다.'); return s; },
  blog_rss_url: v => { const s = url(v); if (s && !s.startsWith('https:')) fail('블로그 RSS URL은 https 주소여야 합니다.'); return s; },
};

// 요청에 있는 키만 검증해서 반환 (부분 수정)
function cleanProfile(body) {
  const out = {};
  for (const [k, fn] of Object.entries(PROFILE)) if (body && k in body) out[k] = fn(body[k]);
  return out;
}

function parseJSON(s, fallback) {
  try { return s == null ? fallback : JSON.parse(s); } catch { return fallback; }
}

// 라우트 래퍼: 검증 오류 → 400(한글 메시지), 그 외 → 일반 500
const wrap = fn => async (req, res) => {
  try { await fn(req, res); } catch (e) {
    if (e instanceof ValidationError) return res.status(400).json({ error: e.message });
    console.error(e);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
};

module.exports = { ValidationError, SCHEMA, cleanItem, cleanProfile, links, str, ym, parseJSON, wrap, fail };
