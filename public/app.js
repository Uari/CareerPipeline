/* =============================================
   Career Pipeline - Frontend Logic
   ============================================= */

const API = '';  // 같은 서버 기준

// 세션 만료/미인증(401) 시 로그인 페이지로
const _fetch = window.fetch.bind(window);
window.fetch = async (...args) => {
  const r = await _fetch(...args);
  if (r.status === 401) location.href = '/login';
  return r;
};

async function logout() {
  try { await fetch(`${API}/api/auth/logout`, { method: 'POST' }); } finally { location.href = '/login'; }
}

function openPasswordModal() {
  ['pw-current', 'pw-new', 'pw-confirm'].forEach(id => { document.getElementById(id).value = ''; });
  openModal('modal-password');
}

async function changePassword() {
  const currentPassword = document.getElementById('pw-current').value;
  const newPassword = document.getElementById('pw-new').value;
  if (newPassword.length < 8) return toast('새 비밀번호는 8자 이상이어야 합니다.', 'error');
  if (newPassword !== document.getElementById('pw-confirm').value) return toast('새 비밀번호 확인이 일치하지 않습니다.', 'error');
  try {
    const r = await fetch(`${API}/api/auth/password`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ currentPassword, newPassword }) });
    if (!r.ok) { const e = await r.json(); return toast(e.error, 'error'); }
    toast('비밀번호가 변경되었습니다.');
    closeModal('modal-password');
  } catch { toast('변경 실패', 'error'); }
}

// innerHTML에 넣는 모든 데이터는 esc() 필수. onclick 인자는 jsArg() 사용.
function esc(v) {
  return String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function jsArg(v) { return esc(JSON.stringify(String(v ?? ''))); }

// ── 아이콘 (Lucide 기반 inline SVG, 정적 문자열만) ──
const ICONS = {
  skills:  '<path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z"/><path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65"/><path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65"/>',
  resume:  '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M16 13H8"/><path d="M16 17H8"/><path d="M10 9H8"/>',
  goals:   '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
  files:   '<path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/>',
  edit:    '<path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/><path d="m15 5 4 4"/>',
  trash:   '<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>',
  history: '<path d="M22 7 13.5 15.5 8.5 10.5 2 17"/><path d="M16 7h6v6"/>',
  download:'<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/>',
  check:   '<path d="M20 6 9 17l-5-5"/>',
  ok:      '<circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>',
  alert:   '<circle cx="12" cy="12" r="10"/><path d="M12 8v4"/><path d="M12 16h.01"/>',
  log:     '<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>',
  plus:    '<path d="M5 12h14"/><path d="M12 5v14"/>',
  lock:    '<rect width="18" height="11" x="3" y="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  up:      '<path d="m18 15-6-6-6 6"/>',
  down:    '<path d="m6 9 6 6 6-6"/>',
  copy:    '<rect width="14" height="14" x="8" y="8" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',
  eye:     '<path d="M2.06 12.35a1 1 0 0 1 0-.7 10.75 10.75 0 0 1 19.88 0 1 1 0 0 1 0 .7 10.75 10.75 0 0 1-19.88 0"/><circle cx="12" cy="12" r="3"/>',
  share:   '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
  ban:     '<circle cx="12" cy="12" r="10"/><path d="m4.9 4.9 14.2 14.2"/>',
  globe:   '<circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/>',
};
function icon(name) {
  return `<svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">${ICONS[name]}</svg>`;
}

// ── 상태 ──────────────────────────────────────
let allSkills = [];
let currentSkillId = null;
let currentResumeId = null;
let currentGoalId = null;
let skillFilter = 'all';

// ── 라우팅 ────────────────────────────────────
function navigate(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.add('hidden'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById(`page-${page}`).classList.remove('hidden');
  document.querySelector(`[data-page="${page}"]`).classList.add('active');

  const loaders = {
    dashboard: loadDashboard,
    skills:    loadSkills,
    resume:    loadResumes,
    goals:     loadGoals,
    files:     loadFiles,
  };
  if (loaders[page]) loaders[page]();
  loadStorageInfo();
  closeSidebar(); // 모바일: 메뉴 선택 시 사이드바 닫기
}

// ── Toast ──────────────────────────────────────
function toast(msg, type = 'success') {
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.setAttribute('role', type === 'error' ? 'alert' : 'status');
  el.innerHTML = `${icon(type === 'success' ? 'ok' : 'alert')}<span>${esc(msg)}</span>`;
  document.getElementById('toast-container').appendChild(el);
  setTimeout(() => el.remove(), 3000);
}

// ── Modal ──────────────────────────────────────
function openModal(id) { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }

// ── 유틸 ──────────────────────────────────────
function fmtSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  if (bytes < 1024 * 1024 * 1024) return (bytes / 1024 / 1024).toFixed(1) + ' MB';
  return (bytes / 1024 / 1024 / 1024).toFixed(2) + ' GB';
}

// 5칸 레벨 바. level은 0~5 정수로 강제하므로 마크업에 원본 값이 들어가지 않음
function levelBar(level) {
  const n = Math.max(0, Math.min(5, parseInt(level, 10) || 0));
  const segs = [1, 2, 3, 4, 5].map(i => `<i${i <= n ? ' class="on"' : ''}></i>`).join('');
  return `<span class="level" title="레벨 ${n}/5" aria-label="레벨 ${n}/5"><span class="level-bar">${segs}</span><span class="level-num">Lv.${n}</span></span>`;
}

function catLabel(cat) {
  return { lang: '언어', framework: '프레임워크', devops: 'DevOps', soft: '소프트스킬', etc: '기타' }[cat] || cat;
}

function catBadge(cat) {
  return `<span class="badge">${esc(catLabel(cat))}</span>`;
}

function statusBadge(status) {
  const map = { in_progress: ['badge-accent', '진행중'], done: ['badge-success', '완료'], paused: ['', '중단'] };
  const [cls, label] = map[status] || ['', status];
  return `<span class="badge ${cls}">${esc(label)}</span>`;
}

function typeBadge(type) {
  const label = { monthly: '월간', quarterly: '분기', annual: '연간' }[type] || type;
  return `<span class="badge">${esc(label)}</span>`;
}

function dday(dateStr) {
  if (!dateStr) return '';
  const diff = Math.ceil((new Date(dateStr) - new Date()) / (1000 * 60 * 60 * 24));
  if (diff < 0) return `<span class="badge badge-danger">D+${Math.abs(diff)}</span>`;
  if (diff === 0) return `<span class="badge badge-warn">D-Day</span>`;
  return `<span class="badge">D-${diff}</span>`;
}

// ── Storage Info ───────────────────────────────
async function loadStorageInfo() {
  try {
    const r = await fetch(`${API}/api/files/storage`);
    const data = await r.json();
    document.getElementById('storage-bar-fill').style.width = `${data.percent}%`;
    document.getElementById('storage-text').textContent = `${data.usedGB} GB / ${data.maxGB} GB`;
  } catch {}
}

// ═══════════════════════════════════════════════
// DASHBOARD
// ═══════════════════════════════════════════════
async function loadDashboard() {
  try {
    const [skillsR, resumesR, goalsR, filesR] = await Promise.all([
      fetch(`${API}/api/skills`),
      fetch(`${API}/api/resume`),
      fetch(`${API}/api/goals`),
      fetch(`${API}/api/files`),
    ]);
    const skills  = await skillsR.json();
    const resumes = await resumesR.json();
    const goals   = await goalsR.json();
    const filesData = await filesR.json();

    const inProgress = goals.filter(g => g.status === 'in_progress');
    const totalLogs  = goals.reduce((s, g) => s + (g.logs?.length || 0), 0);

    const stat = (ic, label, value) => `
      <div class="stat-card">
        <div class="stat-head"><span class="stat-label">${label}</span>${icon(ic)}</div>
        <div class="stat-value">${esc(value)}</div>
      </div>`;
    document.getElementById('dash-stats').innerHTML =
      stat('skills', '등록된 스킬', skills.length) +
      stat('resume', '이력서 버전', resumes.length) +
      stat('goals', '진행중 목표', inProgress.length) +
      stat('files', '업로드 파일', filesData.files?.length || 0);

    // 최근 스킬 5개
    const recentSkills = [...skills].sort((a,b) => b.updated_at?.localeCompare(a.updated_at)).slice(0, 5);
    document.getElementById('dash-skills').innerHTML = recentSkills.length
      ? recentSkills.map(s => `
        <div class="list-row">
          <div class="flex items-center gap-2" style="min-width:0">
            <span class="list-name">${esc(s.name)}</span>
            <span class="text-sm text-muted">${esc(catLabel(s.category))}</span>
          </div>
          ${levelBar(s.level)}
        </div>`).join('')
      : '<p class="empty">등록된 스킬이 없습니다.</p>';

    // 진행중 목표
    document.getElementById('dash-goals').innerHTML = inProgress.length
      ? inProgress.slice(0, 5).map(g => `
        <div class="list-row stack">
          <div class="flex items-center justify-between gap-2 mb-2">
            <span class="list-name">${esc(g.title)}</span>
            ${dday(g.target_date)}
          </div>
          <div class="progress-wrap"><div class="progress-fill" style="width:${esc(g.progress)}%"></div></div>
          <div class="text-sm text-muted mt-2 num">${esc(g.progress)}% 완료 · 로그 ${g.logs?.length || 0}개</div>
        </div>`).join('')
      : '<p class="empty">진행중인 목표가 없습니다.</p>';

  } catch (e) {
    console.error(e);
    toast('대시보드 로딩 실패', 'error');
  }
}

// ═══════════════════════════════════════════════
// SKILLS
// ═══════════════════════════════════════════════
async function loadSkills() {
  try {
    const r = await fetch(`${API}/api/skills`);
    allSkills = await r.json();
    document.getElementById('skills-count').textContent = `(${allSkills.length}개)`;
    renderSkills();
  } catch (e) {
    toast('스킬 로딩 실패', 'error');
  }
}

function filterSkills(cat) {
  skillFilter = cat;
  document.querySelectorAll('#skill-filters .btn').forEach(b => b.classList.remove('active-filter'));
  document.querySelector(`[data-cat="${cat}"]`).classList.add('active-filter');
  renderSkills();
}

function renderSkills() {
  const filtered = skillFilter === 'all' ? allSkills : allSkills.filter(s => s.category === skillFilter);
  const el = document.getElementById('skills-list');
  el.innerHTML = filtered.length ? filtered.map(s => `
    <div class="card skill-card">
      <div class="skill-top">
        ${catBadge(s.category)}
        <div class="actions">
          <button class="btn btn-ghost btn-sm btn-icon" onclick="viewSkillHistory(${jsArg(s.id)})" title="성장 이력" aria-label="성장 이력">${icon('history')}</button>
          <button class="btn btn-ghost btn-sm btn-icon" onclick="openSkillModal(${jsArg(s.id)})" title="편집" aria-label="편집">${icon('edit')}</button>
          <button class="btn btn-danger btn-sm btn-icon" onclick="deleteSkill(${jsArg(s.id)})" title="삭제" aria-label="삭제">${icon('trash')}</button>
        </div>
      </div>
      <div class="skill-name">${esc(s.name)}</div>
      ${levelBar(s.level)}
      ${s.note ? `<div class="skill-note">${esc(s.note)}</div>` : ''}
      <div class="skill-foot">수정 ${esc(s.updated_at?.slice(0,10) || '-')}</div>
    </div>
  `).join('') : '<p class="empty">해당 카테고리의 스킬이 없습니다.</p>';
}

function openSkillModal(id = null) {
  currentSkillId = id;
  document.getElementById('skill-modal-title').textContent = id ? '스킬 수정' : '스킬 추가';
  if (id) {
    const s = allSkills.find(x => x.id === id);
    document.getElementById('skill-name').value = s.name;
    document.getElementById('skill-category').value = s.category;
    document.getElementById('skill-level').value = s.level;
    document.getElementById('skill-note').value = s.note || '';
  } else {
    document.getElementById('skill-name').value = '';
    document.getElementById('skill-category').value = 'lang';
    document.getElementById('skill-level').value = '1';
    document.getElementById('skill-note').value = '';
  }
  openModal('modal-skill');
}

async function saveSkill() {
  const payload = {
    name:     document.getElementById('skill-name').value.trim(),
    category: document.getElementById('skill-category').value,
    level:    parseInt(document.getElementById('skill-level').value),
    note:     document.getElementById('skill-note').value,
  };
  if (!payload.name) return toast('스킬명을 입력하세요.', 'error');

  try {
    const url = currentSkillId ? `${API}/api/skills/${currentSkillId}` : `${API}/api/skills`;
    const method = currentSkillId ? 'PUT' : 'POST';
    const r = await fetch(url, { method, headers: {'Content-Type':'application/json'}, body: JSON.stringify(payload) });
    if (!r.ok) { const e = await r.json(); return toast(e.error, 'error'); }
    toast(currentSkillId ? '스킬이 수정되었습니다.' : '스킬이 추가되었습니다.');
    closeModal('modal-skill');
    loadSkills();
  } catch (e) {
    toast('저장 실패', 'error');
  }
}

async function deleteSkill(id) {
  if (!confirm('스킬을 삭제할까요?')) return;
  try {
    await fetch(`${API}/api/skills/${id}`, { method: 'DELETE' });
    toast('삭제되었습니다.');
    loadSkills();
  } catch { toast('삭제 실패', 'error'); }
}

async function viewSkillHistory(id) {
  const skill = allSkills.find(s => s.id === id);
  const r = await fetch(`${API}/api/skills/${id}`);
  const data = await r.json();
  const histories = data.histories || [];
  document.getElementById('skill-history-content').innerHTML = `
    <div class="flex items-center justify-between gap-3 mb-4">
      <strong>${esc(skill.name)}</strong>
      ${levelBar(skill.level)}
    </div>
    ${histories.length ? `
      <div class="timeline">
        ${histories.map(h => `
          <div class="timeline-item">
            <div class="timeline-date">${esc(h.created_at?.slice(0,16) || '-')}</div>
            <div class="timeline-content">${esc(h.note || `레벨 ${h.from_level} → ${h.to_level}`)}</div>
          </div>
        `).join('')}
      </div>
    ` : '<p class="text-muted text-sm">레벨 변경 이력이 없습니다.</p>'}
  `;
  openModal('modal-skill-history');
}

// ═══════════════════════════════════════════════
// RESUME (프로필 · 항목 · 버전 · 공유 링크)
// ═══════════════════════════════════════════════
let allResumes = [];
let profile = {};
let allItems = [];
let shareLinks = [];
let resumeTab = 'profile';
let currentItem = null; // { type, id|null }

// 필드 종류: text, wide(한 줄 전체 text), month, check, textarea, lines(한 줄에 하나), csv(쉼표), links("라벨 | URL"), exp(소속 경력)
const ITEM_TYPES = {
  experience: { label: '경력', title: 'company', fields: [
    ['company', '회사명 *', 'text'], ['role', '직무 / 직책', 'text'], ['employment_type', '고용 형태', 'text', '예: 정규직'],
    ['start', '시작', 'month'], ['end', '종료', 'month'], ['current', '재직 중', 'check'], ['summary', '주요 업무', 'textarea'],
  ] },
  project: { label: '프로젝트', title: 'title', fields: [
    ['title', '프로젝트명 *', 'text'], ['experience_id', '소속 경력 (선택하면 경력 아래에 표시)', 'exp'], ['role', '역할', 'wide'],
    ['start', '시작', 'month'], ['end', '종료', 'month'],
    ['problem', '문제', 'textarea'], ['action', '해결', 'textarea'], ['result', '성과', 'textarea'],
    ['metrics', '핵심 지표 (한 줄에 하나)', 'lines', '예: 결제 API p99 지연 40% 감소'], ['stack', '기술 스택 (쉼표 구분)', 'csv', '예: Node.js, MySQL, Redis'],
    ['links', '링크 (한 줄에 "라벨 | URL")', 'links', 'GitHub | https://github.com/...'],
  ] },
  education: { label: '학력', title: 'school', fields: [
    ['school', '학교명 *', 'text'], ['major', '전공', 'text'], ['degree', '학위', 'text', '예: 학사'],
    ['start', '입학', 'month'], ['end', '졸업', 'month'], ['status', '상태', 'text', '예: 졸업'],
  ] },
  certification: { label: '자격증', title: 'name', fields: [['name', '자격증명 *', 'text'], ['issuer', '발급 기관', 'text'], ['date', '취득일', 'month']] },
  language: { label: '어학', title: 'test', fields: [['test', '시험명 *', 'text', '예: TOEIC'], ['score', '점수 / 등급', 'text'], ['date', '응시일', 'month']] },
  award: { label: '수상', title: 'name', fields: [['name', '수상명 *', 'text'], ['issuer', '수여 기관', 'text'], ['date', '수상일', 'month']] },
  activity: { label: '활동', title: 'name', fields: [
    ['name', '활동명 *', 'text'], ['org', '기관 / 단체', 'wide'], ['start', '시작', 'month'], ['end', '종료', 'month'], ['description', '내용', 'textarea'],
  ] },
};
const TAB_TYPES = { career: ['experience', 'project'], other: ['education', 'certification', 'language', 'award', 'activity'] };

const ym = s => (s || '').replace('-', '.');
const period = (s, e, cur) => s ? `${ym(s)} – ${cur ? '현재' : ym(e)}` : ym(e);
const joinDot = (...a) => a.filter(Boolean).join(' · ');
const itemsOf = type => allItems.filter(i => i.type === type);

function itemMeta(type, d) {
  switch (type) {
    case 'experience': return joinDot(d.role, d.employment_type, period(d.start, d.end, d.current));
    case 'project': return joinDot(allItems.find(i => i.id === d.experience_id)?.data.company, d.role, period(d.start, d.end));
    case 'education': return joinDot(d.major, d.degree, d.status, period(d.start, d.end));
    case 'certification': case 'award': return joinDot(d.issuer, ym(d.date));
    case 'language': return joinDot(d.score, ym(d.date));
    case 'activity': return joinDot(d.org, period(d.start, d.end));
  }
  return '';
}

// 사람인/잡코리아 붙여넣기용 평문
function itemText(type, d) {
  const lines = [joinDot(d[ITEM_TYPES[type].title], itemMeta(type, d))];
  const block = (label, v) => { if (v) lines.push('', `[${label}]`, v); };
  if (type === 'experience') block('주요 업무', d.summary);
  if (type === 'activity') block('내용', d.description);
  if (type === 'project') {
    block('문제', d.problem); block('해결', d.action); block('성과', d.result);
    if (d.metrics.length) lines.push('', ...d.metrics.map(m => `- ${m}`));
    if (d.stack.length) lines.push('', `기술 스택: ${d.stack.join(', ')}`);
    if (d.links.length) lines.push(...d.links.map(l => `${l.label || '링크'}: ${l.url}`));
  }
  return lines.join('\n');
}

async function copyText(text, msg = '복사되었습니다.') {
  try { await navigator.clipboard.writeText(text); toast(msg); }
  catch { prompt('복사할 수 없어 아래 내용을 직접 복사하세요.', text); }
}

async function api(method, url, body) {
  const r = await fetch(API + url, { method, headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || '요청 실패');
  return data;
}

async function loadResumes() {
  try {
    [profile, allItems, allResumes, shareLinks] = await Promise.all(
      ['/api/profile', '/api/resume-items', '/api/resume', '/api/share-links'].map(u => api('GET', u)));
    renderResumeTab();
  } catch { toast('이력서 로딩 실패', 'error'); }
}

function setResumeTab(tab) {
  resumeTab = tab;
  document.querySelectorAll('#resume-tabs .btn').forEach(b => b.classList.toggle('active-filter', b.dataset.tab === tab));
  renderResumeTab();
}

function renderResumeTab() {
  const el = document.getElementById('resume-tab-body');
  if (resumeTab === 'profile') el.innerHTML = renderProfile();
  else if (TAB_TYPES[resumeTab]) el.innerHTML = TAB_TYPES[resumeTab].map(renderItemSection).join('');
  else if (resumeTab === 'variants') el.innerHTML = renderVariants();
  else el.innerHTML = renderShareLinks();
}

// ── 프로필 ──
function renderProfile() {
  const p = profile;
  const field = (id, label, value, attrs = '') => `<div class="form-group"><label class="form-label" for="pf-${id}">${label}</label><input class="form-input" id="pf-${id}" value="${esc(value)}" ${attrs} /></div>`;
  return `
    <div class="card mb-3">
      <div class="card-head mb-3"><h3 class="card-title">공개 정보</h3><span class="text-sm text-muted">공유 링크에 표시</span></div>
      <div class="form-grid">${field('name', '이름', p.name, 'maxlength="100"')}${field('email', '이메일', p.email, 'type="email" maxlength="200"')}</div>
      ${field('headline', '한 줄 소개', p.headline, 'maxlength="200" placeholder="예: 결제 도메인 백엔드 개발자"')}
      <div class="form-group"><label class="form-label" for="pf-intro">자기소개</label><textarea class="form-textarea" id="pf-intro" maxlength="5000" style="min-height:140px">${esc(p.intro)}</textarea></div>
      <div class="form-group mb-0"><label class="form-label" for="pf-links">링크 (한 줄에 "라벨 | URL")</label><textarea class="form-textarea" id="pf-links" style="min-height:76px" placeholder="GitHub | https://github.com/...">${esc((p.links || []).map(l => `${l.label} | ${l.url}`).join('\n'))}</textarea></div>
    </div>
    <div class="card mb-3">
      <div class="card-head mb-3"><h3 class="card-title flex items-center gap-2">${icon('lock')}비공개 정보</h3><span class="text-sm text-muted">채용 사이트 입력용 · 공유 화면에 표시 안 됨</span></div>
      <div class="form-grid">${field('phone', '전화번호 (링크별로 공개 선택)', p.phone, 'maxlength="50"')}${field('birth_date', '생년월일', p.birth_date, 'type="date"')}</div>
      ${field('address', '주소', p.address, 'maxlength="300"')}
    </div>
    <div class="card mb-3">
      <div class="card-head mb-3"><h3 class="card-title">연동</h3><span class="text-sm text-muted">다음 단계에서 사용</span></div>
      <div class="form-grid">${field('github_username', 'GitHub 사용자명', p.github_username, 'maxlength="39"')}${field('blog_rss_url', '블로그 RSS URL', p.blog_rss_url, 'type="url" maxlength="500"')}</div>
    </div>
    <div class="flex justify-end"><button class="btn btn-primary" onclick="saveProfile()">${icon('check')}프로필 저장</button></div>`;
}

const parseLinks = text => text.split('\n').map(l => l.trim()).filter(Boolean).map(l => {
  const i = l.lastIndexOf('|');
  return i < 0 ? { label: '', url: l } : { label: l.slice(0, i).trim(), url: l.slice(i + 1).trim() };
});

async function saveProfile() {
  const v = id => document.getElementById(`pf-${id}`).value;
  const body = { links: parseLinks(v('links')) };
  ['name', 'email', 'headline', 'intro', 'phone', 'birth_date', 'address', 'github_username', 'blog_rss_url'].forEach(k => { body[k] = v(k); });
  try { profile = await api('PUT', '/api/profile', body); toast('프로필이 저장되었습니다.'); renderResumeTab(); }
  catch (e) { toast(e.message, 'error'); }
}

// ── 항목 ──
function renderItemSection(type) {
  const t = ITEM_TYPES[type];
  const items = itemsOf(type);
  return `<div class="item-section">
    <div class="card-head mb-3"><h3 class="card-title">${esc(t.label)} <span class="text-muted num">${items.length}</span></h3>
      <button class="btn btn-secondary btn-sm" onclick="openItemModal(${jsArg(type)})">${icon('plus')}${esc(t.label)} 추가</button></div>
    ${items.length ? `<div class="flex flex-col gap-2">${items.map((it, i) => {
      const d = it.data;
      const body = d.summary || d.problem || d.description || '';
      return `<div class="card item-card">
        <div class="item-head">
          <div style="min-width:0">
            <div class="item-title">${esc(d[t.title])}</div>
            ${itemMeta(type, d) ? `<div class="text-sm text-muted num mt-1">${esc(itemMeta(type, d))}</div>` : ''}
          </div>
          <div class="actions">
            <button class="btn btn-ghost btn-sm btn-icon" onclick="moveItem(${jsArg(it.id)},'up')" ${i === 0 ? 'disabled' : ''} title="위로" aria-label="위로">${icon('up')}</button>
            <button class="btn btn-ghost btn-sm btn-icon" onclick="moveItem(${jsArg(it.id)},'down')" ${i === items.length - 1 ? 'disabled' : ''} title="아래로" aria-label="아래로">${icon('down')}</button>
            <button class="btn btn-ghost btn-sm btn-icon" onclick="copyItem(${jsArg(it.id)})" title="텍스트 복사" aria-label="텍스트 복사">${icon('copy')}</button>
            <button class="btn btn-ghost btn-sm btn-icon" onclick="openItemModal(${jsArg(type)},${jsArg(it.id)})" title="편집" aria-label="편집">${icon('edit')}</button>
            <button class="btn btn-danger btn-sm btn-icon" onclick="deleteItem(${jsArg(it.id)})" title="삭제" aria-label="삭제">${icon('trash')}</button>
          </div>
        </div>
        ${body ? `<div class="item-body">${esc(body)}</div>` : ''}
        ${type === 'project' && d.stack.length ? `<div class="badges mt-2">${d.stack.map(s => `<span class="badge">${esc(s)}</span>`).join('')}</div>` : ''}
      </div>`;
    }).join('')}</div>` : `<p class="empty">등록된 ${esc(t.label)} 항목이 없습니다.</p>`}
  </div>`;
}

function openItemModal(type, id = null) {
  const t = ITEM_TYPES[type];
  currentItem = { type, id };
  const d = id ? allItems.find(i => i.id === id).data : {};
  document.getElementById('item-modal-title').textContent = `${t.label} ${id ? '수정' : '추가'}`;
  document.getElementById('item-form').innerHTML = t.fields.map(([k, label, kind, ph = '']) => {
    const v = d[k];
    const fid = `it-${k}`;
    const full = ['wide', 'check', 'textarea', 'lines', 'links', 'csv', 'exp'].includes(kind) || k === t.title;
    const wrap = inner => `<div class="form-group${full ? ' span-2' : ''}">${inner}</div>`;
    const lab = `<label class="form-label" for="${fid}">${esc(label)}</label>`;
    if (kind === 'check') return wrap(`<label class="check"><input type="checkbox" id="${fid}" ${v ? 'checked' : ''} /> ${esc(label)}</label>`);
    if (kind === 'exp') return wrap(`${lab}<select class="form-select" id="${fid}"><option value="">(없음 · 독립 프로젝트)</option>${itemsOf('experience').map(e => `<option value="${esc(e.id)}" ${e.id === v ? 'selected' : ''}>${esc(e.data.company)}</option>`).join('')}</select>`);
    const text = kind === 'lines' ? (v || []).join('\n') : kind === 'csv' ? (v || []).join(', ') : kind === 'links' ? (v || []).map(l => `${l.label} | ${l.url}`).join('\n') : (v ?? '');
    if (['textarea', 'lines', 'links'].includes(kind)) return wrap(`${lab}<textarea class="form-textarea" id="${fid}" placeholder="${esc(ph)}" style="min-height:${kind === 'textarea' ? 96 : 72}px">${esc(text)}</textarea>`);
    return wrap(`${lab}<input class="form-input" id="${fid}" type="${kind === 'month' ? 'month' : 'text'}" placeholder="${esc(ph || (kind === 'month' ? 'YYYY-MM' : ''))}" value="${esc(text)}" />`);
  }).join('');
  openModal('modal-item');
}

async function saveItem() {
  const { type, id } = currentItem;
  const data = {};
  for (const [k, , kind] of ITEM_TYPES[type].fields) {
    const el = document.getElementById(`it-${k}`);
    data[k] = kind === 'check' ? el.checked
      : kind === 'lines' ? el.value.split('\n').map(s => s.trim()).filter(Boolean)
      : kind === 'csv' ? el.value.split(/[,\n]/).map(s => s.trim()).filter(Boolean)
      : kind === 'links' ? parseLinks(el.value)
      : el.value.trim();
  }
  try {
    await api(id ? 'PUT' : 'POST', id ? `/api/resume-items/${encodeURIComponent(id)}` : '/api/resume-items', id ? { data } : { type, data });
    toast('저장되었습니다.');
    closeModal('modal-item');
    loadResumes();
  } catch (e) { toast(e.message, 'error'); }
}

async function moveItem(id, dir) {
  try { await api('POST', `/api/resume-items/${encodeURIComponent(id)}/move`, { dir }); loadResumes(); }
  catch (e) { toast(e.message, 'error'); }
}

function copyItem(id) {
  const it = allItems.find(i => i.id === id);
  copyText(itemText(it.type, it.data), '텍스트로 복사되었습니다.');
}

async function deleteItem(id) {
  if (!confirm('항목을 삭제할까요?')) return;
  try { await api('DELETE', `/api/resume-items/${encodeURIComponent(id)}`); toast('삭제되었습니다.'); loadResumes(); }
  catch (e) { toast(e.message, 'error'); }
}

// ── 이력서 버전 ──
const includeOf = r => { try { return r.include ? JSON.parse(r.include) : null; } catch { return null; } };

function renderVariants() {
  return `<div class="card-head mb-3"><h3 class="card-title">이력서 버전 <span class="text-muted num">${allResumes.length}</span></h3>
      <button class="btn btn-primary btn-sm" onclick="openResumeModal()">${icon('plus')}새 버전</button></div>
    ${allResumes.length ? `<div class="flex flex-col gap-3">${allResumes.map(r => {
      const inc = includeOf(r);
      const links = shareLinks.filter(l => l.resume_id === r.id && l.status === 'active').length;
      return `<div class="card resume-card">
        <div class="resume-head">
          <div style="min-width:0">
            <div class="resume-title-row">
              <span class="resume-title">${esc(r.title)}</span>
              <span class="badge">v${esc(r.version)}</span>
              ${r.is_active ? `<span class="badge badge-success">${icon('check')}활성</span>` : ''}
            </div>
            ${r.headline ? `<div class="text-sm mt-1">${esc(r.headline)}</div>` : ''}
            <div class="text-sm text-muted mt-1 num">${esc(joinDot(inc ? `항목 ${inc.item_ids.length}개 선택` : '전체 항목 포함', links ? `활성 링크 ${links}개` : '', `수정 ${r.updated_at?.slice(0, 16) || '-'}`))}</div>
          </div>
          <div class="actions">
            <a class="btn btn-secondary btn-sm" href="/preview/${esc(encodeURIComponent(r.id))}" target="_blank" rel="noopener">${icon('eye')}미리보기</a>
            <button class="btn btn-secondary btn-sm" onclick="openShareModal(${jsArg(r.id)})">${icon('share')}공유</button>
            ${r.is_active ? '' : `<button class="btn btn-ghost btn-sm" onclick="setActiveResume(${jsArg(r.id)})">활성화</button>`}
            <button class="btn btn-ghost btn-sm btn-icon" onclick="openResumeModal(${jsArg(r.id)})" title="편집" aria-label="편집">${icon('edit')}</button>
            <button class="btn btn-danger btn-sm btn-icon" onclick="deleteResume(${jsArg(r.id)})" title="삭제" aria-label="삭제">${icon('trash')}</button>
          </div>
        </div>
        ${r.tags ? `<div class="badges mt-2">${r.tags.split(',').map(t => `<span class="badge">${esc(t.trim())}</span>`).join('')}</div>` : ''}
      </div>`;
    }).join('')}</div>` : '<p class="empty">등록된 이력서 버전이 없습니다.</p>'}`;
}

function openResumeModal(id = null) {
  currentResumeId = id;
  const r = id ? allResumes.find(x => x.id === id) : {};
  const inc = id ? includeOf(r) : null;
  document.getElementById('resume-modal-title').textContent = id ? '이력서 버전 수정' : '새 이력서 버전';
  document.getElementById('resume-title').value = r.title || '';
  document.getElementById('resume-version').value = r.version || '1.0';
  document.getElementById('resume-tags').value = r.tags || '';
  document.getElementById('resume-headline').value = r.headline || '';
  document.getElementById('resume-intro').value = r.intro || '';
  document.getElementById('resume-content').value = r.content || '';
  document.getElementById('resume-inc-all').checked = !inc;
  const chosen = new Set(inc ? inc.item_ids : allItems.map(i => i.id));
  document.getElementById('resume-include').innerHTML = Object.keys(ITEM_TYPES).filter(t => itemsOf(t).length).map(t => `
    <div class="include-group"><div class="include-label">${esc(ITEM_TYPES[t].label)}</div>
      ${itemsOf(t).map(it => `<label class="check"><input type="checkbox" value="${esc(it.id)}" ${chosen.has(it.id) ? 'checked' : ''} /> ${esc(it.data[ITEM_TYPES[t].title])}</label>`).join('')}
    </div>`).join('') || '<p class="text-sm text-muted">등록된 항목이 없습니다.</p>';
  toggleIncludeAll();
  openModal('modal-resume');
}

function toggleIncludeAll() {
  const all = document.getElementById('resume-inc-all').checked;
  document.querySelectorAll('#resume-include input').forEach(c => { c.disabled = all; });
  document.getElementById('resume-include').classList.toggle('disabled', all);
}

async function saveResume() {
  const payload = {
    title:    document.getElementById('resume-title').value.trim(),
    version:  document.getElementById('resume-version').value.trim() || '1.0',
    tags:     document.getElementById('resume-tags').value.trim(),
    headline: document.getElementById('resume-headline').value.trim(),
    intro:    document.getElementById('resume-intro').value.trim(),
    content:  document.getElementById('resume-content').value,
    include:  document.getElementById('resume-inc-all').checked ? null
      : { item_ids: [...document.querySelectorAll('#resume-include input:checked')].map(c => c.value) },
  };
  if (!payload.title) return toast('제목을 입력하세요.', 'error');
  try {
    await api(currentResumeId ? 'PUT' : 'POST', currentResumeId ? `/api/resume/${encodeURIComponent(currentResumeId)}` : '/api/resume', payload);
    toast('저장되었습니다.');
    closeModal('modal-resume');
    loadResumes();
  } catch (e) { toast(e.message, 'error'); }
}

async function setActiveResume(id) {
  await fetch(`${API}/api/resume/${id}`, { method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ is_active: 1 }) });
  toast('활성 이력서로 설정되었습니다.');
  loadResumes();
}

async function deleteResume(id) {
  if (!confirm('이력서 버전을 삭제할까요? 이 버전의 공유 링크도 함께 삭제됩니다.')) return;
  await fetch(`${API}/api/resume/${id}`, { method:'DELETE' });
  toast('삭제되었습니다.');
  loadResumes();
}

// ── 공유 링크 ──
function shareStatus(s) {
  const [cls, label] = { active: ['badge-success', '활성'], expired: ['', '만료'], revoked: ['badge-danger', '폐기'] }[s] || ['', s];
  return `<span class="badge ${cls}">${esc(label)}</span>`;
}

function renderShareLinks() {
  return `<div class="card-head mb-3"><h3 class="card-title">공유 링크 <span class="text-muted num">${shareLinks.length}</span></h3>
      <button class="btn btn-primary btn-sm" onclick="openShareModal()">${icon('plus')}링크 만들기</button></div>
    <div class="card table-card"><div class="table-wrap"><table id="share-table">
      <thead><tr><th>받는 사람</th><th>이력서 버전</th><th>상태</th><th>조회</th><th>마지막 조회</th><th>만료</th><th aria-label="작업"></th></tr></thead>
      <tbody>${shareLinks.length ? shareLinks.map(l => `<tr class="${l.status === 'active' ? '' : 'row-muted'}">
        <td><div class="file-name">${esc(l.label || '(이름 없음)')}</div><div class="text-sm text-muted num">${esc(joinDot(`생성 ${l.created_at?.slice(0, 10)}`, l.show_phone ? '전화번호 공개' : ''))}</div></td>
        <td>${esc(l.resume_title || '-')}</td>
        <td>${shareStatus(l.status)}</td>
        <td class="num">${esc(l.view_count)}</td>
        <td class="num text-muted" style="white-space:nowrap">${esc(l.last_viewed_at?.slice(0, 16) || '-')}</td>
        <td class="num text-muted" style="white-space:nowrap">${esc(l.expires_at?.slice(0, 10) || '무기한')}</td>
        <td><div class="actions">
          ${l.status === 'active' ? `<button class="btn btn-ghost btn-sm btn-icon" onclick="copyText(${jsArg(l.url)}, 'URL이 복사되었습니다.')" title="URL 복사" aria-label="URL 복사">${icon('copy')}</button>` : ''}
          <button class="btn btn-ghost btn-sm btn-icon" onclick="viewShareLog(${jsArg(l.id)})" title="열람 기록" aria-label="열람 기록">${icon('log')}</button>
          ${l.status === 'active' ? `<button class="btn btn-ghost btn-sm btn-icon" onclick="revokeShareLink(${jsArg(l.id)})" title="폐기" aria-label="폐기">${icon('ban')}</button>` : ''}
          <button class="btn btn-danger btn-sm btn-icon" onclick="deleteShareLink(${jsArg(l.id)})" title="삭제" aria-label="삭제">${icon('trash')}</button>
        </div></td>
      </tr>`).join('') : '<tr><td colspan="7" class="empty" style="text-align:center;padding:32px">만든 공유 링크가 없습니다.</td></tr>'}</tbody>
    </table></div></div>`;
}

function openShareModal(resumeId = null) {
  if (!allResumes.length) return toast('먼저 이력서 버전을 만드세요.', 'error');
  document.getElementById('share-resume').innerHTML = allResumes.map(r => `<option value="${esc(r.id)}">${esc(r.title)} (v${esc(r.version)})</option>`).join('');
  document.getElementById('share-resume').value = resumeId || (allResumes.find(r => r.is_active) || allResumes[0]).id;
  document.getElementById('share-label').value = '';
  document.getElementById('share-days').value = '30';
  document.getElementById('share-phone').checked = false;
  openModal('modal-share');
}

async function createShareLink() {
  const days = document.getElementById('share-days').value;
  try {
    const link = await api('POST', '/api/share-links', {
      resume_id: document.getElementById('share-resume').value,
      label: document.getElementById('share-label').value.trim(),
      days: days ? Number(days) : null,
      show_phone: document.getElementById('share-phone').checked,
    });
    closeModal('modal-share');
    await copyText(link.url, '링크를 만들고 URL을 복사했습니다.');
    setResumeTab('links');
    loadResumes();
  } catch (e) { toast(e.message, 'error'); }
}

async function revokeShareLink(id) {
  if (!confirm('이 링크를 폐기할까요? 받는 사람은 더 이상 열람할 수 없습니다.')) return;
  try { await api('POST', `/api/share-links/${encodeURIComponent(id)}/revoke`); toast('링크가 폐기되었습니다.'); loadResumes(); }
  catch (e) { toast(e.message, 'error'); }
}

async function deleteShareLink(id) {
  if (!confirm('링크와 열람 기록을 삭제할까요?')) return;
  try { await api('DELETE', `/api/share-links/${encodeURIComponent(id)}`); toast('삭제되었습니다.'); loadResumes(); }
  catch (e) { toast(e.message, 'error'); }
}

async function viewShareLog(id) {
  const l = shareLinks.find(x => x.id === id);
  document.getElementById('views-title').textContent = `열람 기록 · ${l.label || l.resume_title || ''}`;
  try {
    const views = await api('GET', `/api/share-links/${encodeURIComponent(id)}/views`);
    document.getElementById('views-body').innerHTML = views.length
      ? `<div class="card table-card"><div class="table-wrap"><table><thead><tr><th>시각</th><th>브라우저</th><th>IP</th></tr></thead><tbody>
          ${views.map(v => `<tr><td class="num" style="white-space:nowrap">${esc(v.viewed_at)}</td><td class="text-sm text-muted ua">${esc(v.user_agent)}</td><td class="mono">${esc(v.ip)}</td></tr>`).join('')}
        </tbody></table></div></div>`
      : '<p class="empty">아직 열람 기록이 없습니다.</p>';
    openModal('modal-views');
  } catch (e) { toast(e.message, 'error'); }
}

// ═══════════════════════════════════════════════
// GOALS
// ═══════════════════════════════════════════════
let allGoals = [];

async function loadGoals() {
  try {
    const r = await fetch(`${API}/api/goals`);
    allGoals = await r.json();
    renderGoals();
  } catch { toast('목표 로딩 실패', 'error'); }
}

function renderGoals() {
  document.getElementById('goals-list').innerHTML = allGoals.length
    ? allGoals.map(g => `
      <div class="card goal-card">
        <div class="goal-header">
          <div style="min-width:0">
            <div class="goal-title">${esc(g.title)}</div>
            <div class="badges mt-2">
              ${typeBadge(g.type)} ${statusBadge(g.status)}
              ${g.period ? `<span class="badge">${esc(g.period)}</span>` : ''}
              ${dday(g.target_date)}
            </div>
          </div>
          <div class="actions" style="margin:-4px -6px 0 0">
            <button class="btn btn-ghost btn-sm btn-icon" onclick="openGoalModal(${jsArg(g.id)})" title="편집" aria-label="편집">${icon('edit')}</button>
            <button class="btn btn-danger btn-sm btn-icon" onclick="deleteGoal(${jsArg(g.id)})" title="삭제" aria-label="삭제">${icon('trash')}</button>
          </div>
        </div>
        ${g.description ? `<div class="goal-desc">${esc(g.description)}</div>` : ''}
        <div class="goal-progress-label">
          <span>진행률</span><span>${esc(g.progress)}%</span>
        </div>
        <div class="progress-wrap">
          <div class="progress-fill" style="width:${esc(g.progress)}%"></div>
        </div>
        <div class="goal-foot">
          <span class="goal-meta">${icon('log')}학습 로그 ${g.logs?.length || 0}개</span>
          <div class="actions" style="gap:6px">
            <button class="btn btn-secondary btn-sm" onclick="openLogModal(${jsArg(g.id)})">${icon('plus')}로그</button>
            <button class="btn btn-secondary btn-sm" onclick="viewGoalDetail(${jsArg(g.id)})">상세보기</button>
          </div>
        </div>
      </div>
    `).join('')
    : '<p class="empty">등록된 목표가 없습니다.</p>';
}

function openGoalModal(id = null) {
  currentGoalId = id;
  document.getElementById('goal-modal-title').textContent = id ? '목표 수정' : '목표 추가';
  if (id) {
    const g = allGoals.find(x => x.id === id);
    document.getElementById('goal-title').value = g.title;
    document.getElementById('goal-type').value = g.type;
    document.getElementById('goal-period').value = g.period || '';
    document.getElementById('goal-target-date').value = g.target_date || '';
    document.getElementById('goal-progress').value = g.progress;
    document.getElementById('goal-description').value = g.description || '';
  } else {
    document.getElementById('goal-title').value = '';
    document.getElementById('goal-type').value = 'monthly';
    document.getElementById('goal-period').value = '';
    document.getElementById('goal-target-date').value = '';
    document.getElementById('goal-progress').value = '0';
    document.getElementById('goal-description').value = '';
  }
  openModal('modal-goal');
}

async function saveGoal() {
  const payload = {
    title:       document.getElementById('goal-title').value.trim(),
    type:        document.getElementById('goal-type').value,
    period:      document.getElementById('goal-period').value.trim(),
    target_date: document.getElementById('goal-target-date').value || null,
    progress:    parseInt(document.getElementById('goal-progress').value) || 0,
    description: document.getElementById('goal-description').value,
  };
  if (!payload.title) return toast('목표 제목을 입력하세요.', 'error');
  try {
    const url = currentGoalId ? `${API}/api/goals/${currentGoalId}` : `${API}/api/goals`;
    const method = currentGoalId ? 'PUT' : 'POST';
    const r = await fetch(url, { method, headers: {'Content-Type':'application/json'}, body: JSON.stringify(payload) });
    if (!r.ok) { const e = await r.json(); return toast(e.error, 'error'); }
    toast('저장되었습니다.');
    closeModal('modal-goal');
    loadGoals();
  } catch { toast('저장 실패', 'error'); }
}

async function deleteGoal(id) {
  if (!confirm('목표를 삭제할까요?')) return;
  await fetch(`${API}/api/goals/${id}`, { method:'DELETE' });
  toast('삭제되었습니다.');
  loadGoals();
}

function openLogModal(goalId) {
  currentGoalId = goalId;
  document.getElementById('log-goal-id').value = goalId;
  document.getElementById('log-date').value = new Date().toISOString().split('T')[0];
  document.getElementById('log-duration').value = '';
  document.getElementById('log-content').value = '';
  closeModal('modal-goal-detail');
  openModal('modal-log');
}

async function saveLog() {
  const goalId = document.getElementById('log-goal-id').value;
  const payload = {
    date:     document.getElementById('log-date').value,
    content:  document.getElementById('log-content').value.trim(),
    duration: parseInt(document.getElementById('log-duration').value) || 0,
  };
  if (!payload.content) return toast('내용을 입력하세요.', 'error');
  try {
    const r = await fetch(`${API}/api/goals/${goalId}/logs`, { method:'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(payload) });
    if (!r.ok) { const e = await r.json(); return toast(e.error, 'error'); }
    toast('학습 로그가 추가되었습니다.');
    closeModal('modal-log');
    loadGoals();
  } catch { toast('저장 실패', 'error'); }
}

async function viewGoalDetail(id) {
  currentGoalId = id;
  const r = await fetch(`${API}/api/goals/${id}`);
  const goal = await r.json();
  document.getElementById('goal-detail-title').textContent = goal.title;
  document.getElementById('goal-detail-logs').innerHTML = goal.logs?.length
    ? `<div class="timeline">
        ${goal.logs.map(l => `
          <div class="timeline-item with-action">
            <div style="min-width:0">
              <div class="timeline-date">${esc(l.date)} ${l.duration ? `· ${esc(l.duration)}분` : ''}</div>
              <div class="timeline-content">${esc(l.content)}</div>
            </div>
            <button class="btn btn-danger btn-sm btn-icon" onclick="deleteLog(${jsArg(id)},${jsArg(l.id)})" title="로그 삭제" aria-label="로그 삭제">${icon('trash')}</button>
          </div>
        `).join('')}
      </div>`
    : '<p class="text-muted text-sm">학습 로그가 없습니다.</p>';
  openModal('modal-goal-detail');
}

async function deleteLog(goalId, logId) {
  await fetch(`${API}/api/goals/${goalId}/logs/${logId}`, { method:'DELETE' });
  toast('로그가 삭제되었습니다.');
  viewGoalDetail(goalId);
  loadGoals();
}

// ═══════════════════════════════════════════════
// FILES
// ═══════════════════════════════════════════════
async function loadFiles() {
  try {
    const r = await fetch(`${API}/api/files`);
    const data = await r.json();
    renderFiles(data.files || []);
    // 스토리지 바 갱신
    if (data.storage) {
      document.getElementById('storage-bar-fill').style.width = `${data.storage.percent}%`;
      document.getElementById('storage-text').textContent = `${data.storage.usedGB} GB / ${data.storage.maxGB} GB`;
    }
  } catch { toast('파일 로딩 실패', 'error'); }
}

function renderFiles(files) {
  document.getElementById('files-tbody').innerHTML = files.length
    ? files.map(f => `
      <tr>
        <td>
          <div class="file-name">${f.is_public ? `<span class="badge badge-accent" title="공유 링크의 포트폴리오에 표시됨">${icon('globe')}공개</span> ` : ''}${esc(f.original_name)}</div>
          ${f.title ? `<div class="text-sm">${esc(f.title)}</div>` : ''}
          ${f.note ? `<div class="text-sm text-muted">${esc(f.note)}</div>` : ''}
        </td>
        <td class="num text-muted" style="white-space:nowrap">${esc(fmtSize(f.size))}</td>
        <td class="num text-muted" style="white-space:nowrap">${esc(f.created_at?.slice(0,16) || '-')}</td>
        <td class="text-muted">${esc(f.category || '-')}</td>
        <td style="white-space:nowrap">
          <label class="check"><input type="checkbox" ${f.is_public ? 'checked' : ''} onchange="setFilePublic(${jsArg(f.id)}, this.checked)" /> 공개</label>
        </td>
        <td>
          <div class="actions">
            <button class="btn btn-ghost btn-sm btn-icon" onclick="editFileTitle(${jsArg(f.id)}, ${jsArg(f.title || '')})" title="포트폴리오 제목" aria-label="포트폴리오 제목">${icon('edit')}</button>
            <a href="${API}/api/files/download/${esc(encodeURIComponent(f.id))}" class="btn btn-ghost btn-sm btn-icon" title="다운로드" aria-label="다운로드">${icon('download')}</a>
            <button class="btn btn-danger btn-sm btn-icon" onclick="deleteFile(${jsArg(f.id)})" title="삭제" aria-label="삭제">${icon('trash')}</button>
          </div>
        </td>
      </tr>
    `).join('')
    : '<tr><td colspan="6" class="empty" style="text-align:center;padding:32px">업로드된 파일이 없습니다.</td></tr>';
}

// 파일은 기본 비공개. 공개로 켠 파일만 공유 링크의 포트폴리오에 나타남
async function setFilePublic(id, isPublic) {
  if (isPublic && !confirm('이 파일을 공유 링크의 포트폴리오에 공개할까요?\n활성 공유 링크를 가진 누구나 열람할 수 있습니다.')) return loadFiles();
  try {
    await api('PUT', `/api/files/${encodeURIComponent(id)}`, { is_public: isPublic });
    toast(isPublic ? '포트폴리오에 공개했습니다.' : '비공개로 전환했습니다.');
  } catch (e) { toast(e.message, 'error'); }
  loadFiles();
}

async function editFileTitle(id, current) {
  const title = prompt('포트폴리오에 표시할 제목 (비우면 파일명)', current);
  if (title === null) return;
  try { await api('PUT', `/api/files/${encodeURIComponent(id)}`, { title }); loadFiles(); }
  catch (e) { toast(e.message, 'error'); }
}

// 드래그앤드롭
function onDragOver(e) { e.preventDefault(); document.getElementById('dropzone').classList.add('drag-over'); }
function onDragLeave(e) { document.getElementById('dropzone').classList.remove('drag-over'); }
function onDrop(e) {
  e.preventDefault();
  document.getElementById('dropzone').classList.remove('drag-over');
  uploadFiles(e.dataTransfer.files);
}

async function uploadFiles(fileList) {
  if (!fileList || fileList.length === 0) return;
  for (const file of fileList) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('category', 'general');
    try {
      const r = await fetch(`${API}/api/files/upload`, { method:'POST', body: formData });
      const data = await r.json();
      if (!r.ok) { toast(`${file.name}: ${data.error}`, 'error'); continue; }
      toast(`${file.name} 업로드 완료`);
    } catch { toast(`${file.name} 업로드 실패`, 'error'); }
  }
  document.getElementById('file-input').value = '';
  loadFiles();
  loadStorageInfo();
}

async function deleteFile(id) {
  if (!confirm('파일을 삭제할까요?')) return;
  await fetch(`${API}/api/files/${id}`, { method:'DELETE' });
  toast('파일이 삭제되었습니다.');
  loadFiles();
  loadStorageInfo();
}

// ── Mobile Sidebar ──────────────────────────────
function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  if (sidebar.classList.contains('mobile-open')) {
    closeSidebar();
  } else {
    sidebar.classList.add('mobile-open');
    document.getElementById('sidebar-overlay').classList.add('visible');
    document.body.style.overflow = 'hidden';
  }
}

function closeSidebar() {
  document.getElementById('sidebar').classList.remove('mobile-open');
  document.getElementById('sidebar-overlay').classList.remove('visible');
  document.body.style.overflow = '';
}

// ── 초기화 ────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  navigate('dashboard');
});

// 모달 배경 클릭 시 닫기
document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
  backdrop.addEventListener('click', e => {
    if (e.target === backdrop) backdrop.classList.remove('open');
  });
});
