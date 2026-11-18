// 외부 연동(GitHub, 블로그 RSS) — 서버에서만 호출. 결과는 화이트리스트 필드로만 가공해서 메모리 캐시.
// 실패 시 오래된 캐시를 쓰거나(있으면) null → 공개 화면에서 해당 섹션만 빠짐.
const dns = require('dns').promises;
const net = require('net');
const { str } = require('./resume-schema');

const GITHUB_API = process.env.GITHUB_API_URL || 'https://api.github.com'; // 테스트에서만 루프백 스텁으로 교체
const UA = 'careerpipeline';
const TIMEOUT_MS = 8000;
const MAX_FEED_BYTES = 2 * 1024 * 1024;
const GH_TTL = 6 * 60 * 60 * 1000;
const RSS_TTL = 60 * 60 * 1000;
const RETRY_MS = 10 * 60 * 1000; // 실패 후 재시도 간격 (그동안 매 요청이 8초 타임아웃을 기다리지 않게)
const GH_USER_RE = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/;

// ponytail: 프로세스 메모리 캐시, 재시작 시 초기화·동시 첫 요청은 중복 호출됨. 다중 프로세스면 공유 캐시 필요
const cache = new Map(); // key -> { t, v }
async function cached(key, ttl, fn) {
  const e = cache.get(key);
  if (e && Date.now() - e.t < ttl) return e.v;
  try {
    const v = await fn();
    cache.set(key, { t: Date.now(), v });
    return v;
  } catch (err) {
    console.error(`[feeds] ${key.split(':')[0]} 가져오기 실패: ${err.message}`); // URL·토큰은 로그에 안 남김
    cache.set(key, { t: Date.now() - ttl + RETRY_MS, v: e ? e.v : null });
    return e ? e.v : null;
  }
}

const httpsUrl = (u, prefix = 'https://') => {
  try { const x = new URL(u); return x.protocol === 'https:' && x.href.startsWith(prefix) ? x.href : ''; } catch { return ''; }
};
const day = s => { const d = new Date(s); return isNaN(d) ? '' : d.toISOString().slice(0, 10); };

// ── GitHub ──
const REPO_FIELDS = 'name description url stargazerCount forkCount isPrivate primaryLanguage { name color } updatedAt';
const GQL = `query($login: String!) { user(login: $login) {
  name bio url followers { totalCount }
  pinnedItems(first: 6, types: REPOSITORY) { nodes { ... on Repository { ${REPO_FIELDS} } } }
  repositories(first: 6, ownerAffiliations: OWNER, isFork: false, privacy: PUBLIC, orderBy: { field: PUSHED_AT, direction: DESC }) { nodes { ${REPO_FIELDS} } }
  contributionsCollection { contributionCalendar { totalContributions weeks { contributionDays { contributionCount } } } }
} }`;

// 토큰은 api.github.com(테스트: 루프백 스텁)으로만 보냄. 리다이렉트는 따라가지 않음
const ghToken = () => (['api.github.com', '127.0.0.1'].includes(new URL(GITHUB_API).hostname) && process.env.GITHUB_TOKEN) || '';
async function ghFetch(path, init = {}) {
  const headers = { 'User-Agent': UA, Accept: 'application/vnd.github+json', ...init.headers };
  if (ghToken()) headers.Authorization = `bearer ${ghToken()}`;
  const r = await fetch(GITHUB_API + path, { ...init, headers, redirect: 'error', signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

const repo = r => ({
  name: str(r.name, 100),
  description: str(r.description, 300),
  url: httpsUrl(r.url, 'https://github.com/'),
  stars: Number(r.stars) || 0,
  forks: Number(r.forks) || 0,
  language: r.language ? str(r.language, 50) : '',
  color: /^#[0-9a-f]{6}$/i.test(r.color || '') ? r.color : '',
  updated_at: day(r.updated_at),
});

async function loadGithub(login) {
  const out = { url: `https://github.com/${encodeURIComponent(login)}`, login };
  let user, repos, calendar = null;
  if (ghToken()) {
    const j = await ghFetch('/graphql', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: GQL, variables: { login } }) });
    user = j.data && j.data.user;
    if (!user) throw new Error('user not found');
    const pinned = (user.pinnedItems?.nodes || []).filter(n => n && n.name && !n.isPrivate);
    repos = (pinned.length ? pinned : (user.repositories?.nodes || []).filter(n => n && !n.isPrivate)).map(n => ({
      name: n.name, description: n.description, url: n.url, stars: n.stargazerCount, forks: n.forkCount,
      language: n.primaryLanguage?.name, color: n.primaryLanguage?.color, updated_at: n.updatedAt,
    }));
    const cal = user.contributionsCollection?.contributionCalendar;
    if (cal && Array.isArray(cal.weeks)) {
      calendar = {
        total: Number(cal.totalContributions) || 0,
        // 최근 52주 (첫 주는 항상 일요일 시작인 완전한 주, 마지막 주는 오늘까지)
        weeks: cal.weeks.slice(-52).map(w => (w.contributionDays || []).slice(0, 7).map(d => Math.max(0, Number(d.contributionCount) || 0))),
      };
    }
    user = { name: user.name, bio: user.bio, followers: user.followers?.totalCount };
  } else {
    const u = encodeURIComponent(login);
    const [p, list] = await Promise.all([ghFetch(`/users/${u}`), ghFetch(`/users/${u}/repos?sort=pushed&per_page=6&type=owner`)]);
    user = { name: p.name, bio: p.bio, followers: p.followers };
    repos = (Array.isArray(list) ? list : []).filter(r => r && !r.fork && !r.private).map(r => ({
      name: r.name, description: r.description, url: r.html_url, stars: r.stargazers_count, forks: r.forks_count,
      language: r.language, updated_at: r.pushed_at,
    }));
  }
  return {
    ...out,
    name: str(user.name, 100),
    bio: str(user.bio, 300),
    followers: Number(user.followers) || 0,
    repos: repos.slice(0, 6).map(repo).filter(r => r.name && r.url),
    calendar,
  };
}

const github = login => (login && GH_USER_RE.test(login) ? cached(`github:${login.toLowerCase()}`, GH_TTL, () => loadGithub(login)) : Promise.resolve(null));

// ── 블로그 RSS ──
// SSRF 방어: 사설/루프백/링크로컬/CGNAT/메타데이터 대역 차단 (IPv4-mapped IPv6도 BlockList가 처리)
const blocked = new net.BlockList();
for (const [a, p] of [['10.0.0.0', 8], ['172.16.0.0', 12], ['192.168.0.0', 16], ['127.0.0.0', 8], ['169.254.0.0', 16], ['100.64.0.0', 10], ['0.0.0.0', 8]])
  blocked.addSubnet(a, p, 'ipv4');
for (const [a, p] of [['::1', 128], ['::', 128], ['fc00::', 7], ['fe80::', 10]]) blocked.addSubnet(a, p, 'ipv6');

async function assertPublicUrl(href) {
  const u = new URL(href);
  if (u.protocol !== 'https:') throw new Error('https만 허용');
  const host = u.hostname.replace(/^\[|\]$/g, '');
  const addrs = net.isIP(host) ? [{ address: host, family: net.isIP(host) }] : await dns.lookup(host, { all: true, verbatim: true });
  if (!addrs.length || addrs.some(a => blocked.check(a.address, a.family === 6 ? 'ipv6' : 'ipv4'))) throw new Error('허용되지 않은 주소');
  return u;
}

// ponytail: 검증 후 fetch가 DNS를 다시 조회 → DNS rebinding 창이 남음. 막으려면 검증한 IP로 고정 연결(커스텀 lookup) 필요
async function fetchFeed(href) {
  const signal = AbortSignal.timeout(TIMEOUT_MS);
  let u = href;
  for (let hop = 0; hop <= 3; hop++) {
    await assertPublicUrl(u);
    const r = await fetch(u, { redirect: 'manual', signal, headers: { 'User-Agent': UA, Accept: 'application/rss+xml, application/atom+xml, application/xml;q=0.9, */*;q=0.5' } });
    const loc = r.status >= 300 && r.status < 400 && r.headers.get('location');
    if (loc) { await r.body?.cancel(); u = new URL(loc, u).href; continue; }
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    if (Number(r.headers.get('content-length')) > MAX_FEED_BYTES) throw new Error('너무 큼');
    const chunks = [];
    let n = 0;
    for await (const c of r.body) {
      if ((n += c.length) > MAX_FEED_BYTES) throw new Error('너무 큼');
      chunks.push(c);
    }
    return Buffer.concat(chunks).toString('utf8'); // ponytail: UTF-8 피드만 가정 (velog/티스토리/Medium 모두 UTF-8)
  }
  throw new Error('리다이렉트가 너무 많음');
}

const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
const decodeEntities = s => s.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (m, e) => {
  if (e[0] !== '#') return ENT[e.toLowerCase()];
  const cp = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
  return cp > 0 && cp <= 0x10ffff ? String.fromCodePoint(cp) : '';
});
// CDATA는 그대로, 나머지는 엔티티 디코드 → 태그 제거 → 공백 정리
const text = s => s.split(/(<!\[CDATA\[[\s\S]*?\]\]>)/).map(p => (p.startsWith('<![CDATA[') ? p.slice(9, -3) : decodeEntities(p))).join('')
  .replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();

function parseFeed(xml) {
  const blocks = xml.match(/<item[\s>][\s\S]*?<\/item>/gi) || xml.match(/<entry[\s>][\s\S]*?<\/entry>/gi) || [];
  const posts = blocks.map(b => {
    const tag = n => (b.match(new RegExp(`<${n}(?:\\s[^>]*)?>([\\s\\S]*?)</${n}>`, 'i')) || [])[1] || '';
    let link = text(tag('link')); // RSS 2.0
    if (!link) { // Atom: <link href> 중 rel 없거나 alternate
      const l = (b.match(/<link\b[^>]*>/gi) || []).find(x => !/\brel\s*=/.test(x) || /\brel\s*=\s*["']alternate["']/.test(x));
      link = l ? decodeEntities((l.match(/\bhref\s*=\s*(["'])(.*?)\1/) || [])[2] || '') : '';
    }
    let url = '';
    try { const x = new URL(link.trim()); if (/^https?:$/.test(x.protocol)) url = x.href; } catch {}
    return { title: text(tag('title')).slice(0, 300), url, date: day(text(tag('pubDate') || tag('published') || tag('updated') || tag('dc:date'))) };
  }).filter(p => p.title && p.url);
  return posts.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);
}

const blog = rssUrl => (httpsUrl(rssUrl) ? cached(`blog:${rssUrl}`, RSS_TTL, async () => ({ posts: parseFeed(await fetchFeed(rssUrl)) })) : Promise.resolve(null));

module.exports = { github, blog, parseFeed, assertPublicUrl, GH_USER_RE };
