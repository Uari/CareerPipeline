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
  el.innerHTML = `<span>${type === 'success' ? '✅' : '❌'}</span> ${esc(msg)}`;
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

function stars(level) {
  return '⭐'.repeat(level) + '☆'.repeat(5 - level);
}

function catLabel(cat) {
  return { lang: '언어', framework: '프레임워크', devops: 'DevOps', soft: '소프트스킬', etc: '기타' }[cat] || cat;
}

function catBadge(cat) {
  const cls = { lang: 'badge-blue', framework: 'badge-purple', devops: 'badge-green', soft: 'badge-yellow', etc: '' }[cat] || '';
  return `<span class="badge ${cls}">${esc(catLabel(cat))}</span>`;
}

function statusBadge(status) {
  const map = { in_progress: ['badge-blue', '진행중'], done: ['badge-green', '완료'], paused: ['badge-yellow', '중단'] };
  const [cls, label] = map[status] || ['', status];
  return `<span class="badge ${cls}">${esc(label)}</span>`;
}

function typeBadge(type) {
  const map = { monthly: ['badge-blue', '월간'], quarterly: ['badge-purple', '분기'], annual: ['badge-red', '연간'] };
  const [cls, label] = map[type] || ['', type];
  return `<span class="badge ${cls}">${esc(label)}</span>`;
}

function dday(dateStr) {
  if (!dateStr) return '';
  const diff = Math.ceil((new Date(dateStr) - new Date()) / (1000 * 60 * 60 * 24));
  if (diff < 0) return `<span class="badge badge-red">D+${Math.abs(diff)}</span>`;
  if (diff === 0) return `<span class="badge badge-yellow">D-Day!</span>`;
  return `<span class="badge badge-blue">D-${diff}</span>`;
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

    document.getElementById('dash-stats').innerHTML = `
      <div class="stat-card">
        <div class="stat-icon">🧠</div>
        <div class="stat-value" style="color:var(--accent)">${skills.length}</div>
        <div class="stat-label">등록된 스킬</div>
      </div>
      <div class="stat-card">
        <div class="stat-icon">📄</div>
        <div class="stat-value" style="color:var(--accent-2)">${resumes.length}</div>
        <div class="stat-label">이력서 버전</div>
      </div>
      <div class="stat-card">
        <div class="stat-icon">🎯</div>
        <div class="stat-value" style="color:var(--accent-3)">${inProgress.length}</div>
        <div class="stat-label">진행중 목표</div>
      </div>
      <div class="stat-card">
        <div class="stat-icon">📁</div>
        <div class="stat-value" style="color:var(--accent-warn)">${filesData.files?.length || 0}</div>
        <div class="stat-label">업로드 파일</div>
      </div>
    `;

    // 최근 스킬 5개
    const recentSkills = [...skills].sort((a,b) => b.updated_at?.localeCompare(a.updated_at)).slice(0, 5);
    document.getElementById('dash-skills').innerHTML = recentSkills.length
      ? recentSkills.map(s => `
        <div class="flex items-center justify-between" style="padding:8px 0;border-bottom:1px solid var(--border);">
          <div>
            <span style="font-weight:600">${esc(s.name)}</span>
            <span class="text-sm text-muted ml-1">${esc(catLabel(s.category))}</span>
          </div>
          <div class="level-stars">${esc(stars(s.level))}</div>
        </div>`).join('')
      : '<p class="text-muted text-sm">등록된 스킬이 없습니다.</p>';

    // 진행중 목표
    document.getElementById('dash-goals').innerHTML = inProgress.length
      ? inProgress.slice(0, 5).map(g => `
        <div style="padding:8px 0;border-bottom:1px solid var(--border);">
          <div class="flex items-center justify-between mb-2">
            <span style="font-weight:600;font-size:13px">${esc(g.title)}</span>
            ${dday(g.target_date)}
          </div>
          <div class="progress-wrap"><div class="progress-fill" style="width:${esc(g.progress)}%"></div></div>
          <div class="text-sm text-muted mt-2">${esc(g.progress)}% 완료 · 로그 ${g.logs?.length || 0}개</div>
        </div>`).join('')
      : '<p class="text-muted text-sm">진행중인 목표가 없습니다.</p>';

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
    <div class="card skill-card cat-${esc(s.category)}" style="--cat-color:${catColor(s.category)}">
      <div class="flex items-center justify-between mb-2">
        ${catBadge(s.category)}
        <div class="flex gap-2">
          <button class="btn btn-secondary btn-sm btn-icon" onclick="viewSkillHistory(${jsArg(s.id)})" title="성장 이력">📈</button>
          <button class="btn btn-secondary btn-sm btn-icon" onclick="openSkillModal(${jsArg(s.id)})" title="편집">✏️</button>
          <button class="btn btn-danger btn-sm btn-icon" onclick="deleteSkill(${jsArg(s.id)})" title="삭제">🗑</button>
        </div>
      </div>
      <div style="font-size:17px;font-weight:700;margin:6px 0 4px">${esc(s.name)}</div>
      <div class="level-stars">${esc(stars(s.level))}</div>
      ${s.note ? `<div class="text-sm text-muted mt-2">${esc(s.note)}</div>` : ''}
      <div class="text-sm text-muted mt-2" style="font-size:11px">수정: ${esc(s.updated_at?.slice(0,10) || '-')}</div>
    </div>
  `).join('') : '<p class="text-muted">해당 카테고리의 스킬이 없습니다.</p>';
}

function catColor(cat) {
  return { lang: '#6c8ef5', framework: '#a78bfa', devops: '#34d399', soft: '#f59e0b', etc: '#94a3b8' }[cat] || '#6c8ef5';
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
    <div class="mb-4">
      <strong>${esc(skill.name)}</strong>
      <span class="text-muted"> 현재 레벨: </span>
      <span class="level-stars">${esc(stars(skill.level))}</span>
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
// RESUME
// ═══════════════════════════════════════════════
let allResumes = [];

async function loadResumes() {
  try {
    const r = await fetch(`${API}/api/resume`);
    allResumes = await r.json();
    renderResumes();
  } catch { toast('이력서 로딩 실패', 'error'); }
}

function renderResumes() {
  document.getElementById('resume-list').innerHTML = allResumes.length
    ? allResumes.map(r => `
      <div class="card">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <div>
              <div class="flex items-center gap-2">
                <span style="font-size:16px;font-weight:700">${esc(r.title)}</span>
                <span class="badge badge-blue">v${esc(r.version)}</span>
                ${r.is_active ? '<span class="badge badge-green">✓ 활성</span>' : ''}
              </div>
              <div class="text-sm text-muted mt-1">
                ${r.tags ? r.tags.split(',').map(t => `<span class="badge" style="margin-right:4px">${esc(t.trim())}</span>`).join('') : ''}
              </div>
            </div>
          </div>
          <div class="flex gap-2">
            <button class="btn btn-secondary btn-sm" onclick="setActiveResume(${jsArg(r.id)})">활성화</button>
            <button class="btn btn-secondary btn-sm btn-icon" onclick="openResumeModal(${jsArg(r.id)})">✏️</button>
            <button class="btn btn-danger btn-sm btn-icon" onclick="deleteResume(${jsArg(r.id)})">🗑</button>
          </div>
        </div>
        ${r.content ? `
          <div style="margin-top:14px;padding:14px;background:var(--bg-base);border-radius:var(--radius-sm);border:1px solid var(--border);">
            <pre style="font-family:'JetBrains Mono',monospace;font-size:12px;color:var(--text-2);white-space:pre-wrap;margin:0;max-height:150px;overflow:hidden;">${esc(r.content.slice(0, 400))}${r.content.length > 400 ? '\n...' : ''}</pre>
          </div>
        ` : ''}
        <div class="text-sm text-muted mt-2">수정: ${esc(r.updated_at?.slice(0,16) || '-')}</div>
      </div>
    `).join('')
    : '<p class="text-muted">등록된 이력서가 없습니다.</p>';
}

function openResumeModal(id = null) {
  currentResumeId = id;
  document.getElementById('resume-modal-title').textContent = id ? '이력서 수정' : '새 이력서';
  if (id) {
    const r = allResumes.find(x => x.id === id);
    document.getElementById('resume-title').value = r.title;
    document.getElementById('resume-version').value = r.version;
    document.getElementById('resume-tags').value = r.tags || '';
    document.getElementById('resume-content').value = r.content || '';
  } else {
    document.getElementById('resume-title').value = '';
    document.getElementById('resume-version').value = '1.0';
    document.getElementById('resume-tags').value = '';
    document.getElementById('resume-content').value = '';
  }
  openModal('modal-resume');
}

async function saveResume() {
  const payload = {
    title:   document.getElementById('resume-title').value.trim(),
    version: document.getElementById('resume-version').value.trim() || '1.0',
    tags:    document.getElementById('resume-tags').value.trim(),
    content: document.getElementById('resume-content').value,
  };
  if (!payload.title) return toast('제목을 입력하세요.', 'error');
  try {
    const url = currentResumeId ? `${API}/api/resume/${currentResumeId}` : `${API}/api/resume`;
    const method = currentResumeId ? 'PUT' : 'POST';
    const r = await fetch(url, { method, headers: {'Content-Type':'application/json'}, body: JSON.stringify(payload) });
    if (!r.ok) { const e = await r.json(); return toast(e.error, 'error'); }
    toast('저장되었습니다.');
    closeModal('modal-resume');
    loadResumes();
  } catch { toast('저장 실패', 'error'); }
}

async function setActiveResume(id) {
  await fetch(`${API}/api/resume/${id}`, { method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ is_active: 1 }) });
  toast('활성 이력서로 설정되었습니다.');
  loadResumes();
}

async function deleteResume(id) {
  if (!confirm('이력서를 삭제할까요?')) return;
  await fetch(`${API}/api/resume/${id}`, { method:'DELETE' });
  toast('삭제되었습니다.');
  loadResumes();
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
          <div>
            <div class="goal-title">${esc(g.title)}</div>
            <div class="flex gap-2 mt-2">
              ${typeBadge(g.type)} ${statusBadge(g.status)}
              ${g.period ? `<span class="badge">${esc(g.period)}</span>` : ''}
              ${dday(g.target_date)}
            </div>
          </div>
          <div class="flex gap-2">
            <button class="btn btn-secondary btn-sm btn-icon" onclick="openSkillModal()" style="display:none">x</button>
            <button class="btn btn-secondary btn-sm btn-icon" onclick="openGoalModal(${jsArg(g.id)})" title="편집">✏️</button>
            <button class="btn btn-danger btn-sm btn-icon" onclick="deleteGoal(${jsArg(g.id)})" title="삭제">🗑</button>
          </div>
        </div>
        ${g.description ? `<div class="text-sm text-muted mb-3">${esc(g.description)}</div>` : ''}
        <div class="goal-progress-label">
          <span>진행률</span><span>${esc(g.progress)}%</span>
        </div>
        <div class="progress-wrap mb-3">
          <div class="progress-fill" style="width:${esc(g.progress)}%"></div>
        </div>
        <div class="flex items-center justify-between">
          <span class="text-sm text-muted">📝 학습 로그 ${g.logs?.length || 0}개</span>
          <div class="flex gap-2">
            <button class="btn btn-secondary btn-sm" onclick="openLogModal(${jsArg(g.id)})">+ 로그</button>
            <button class="btn btn-secondary btn-sm" onclick="viewGoalDetail(${jsArg(g.id)})">상세보기</button>
          </div>
        </div>
      </div>
    `).join('')
    : '<p class="text-muted">등록된 목표가 없습니다.</p>';
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
          <div class="timeline-item">
            <div class="timeline-date">${esc(l.date)} ${l.duration ? `· ${esc(l.duration)}분` : ''}</div>
            <div class="timeline-content">${esc(l.content)}</div>
            <button class="btn btn-danger btn-sm" style="margin-top:4px" onclick="deleteLog(${jsArg(id)},${jsArg(l.id)})">삭제</button>
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
          <div style="font-weight:600">${esc(f.original_name)}</div>
          ${f.note ? `<div class="text-sm text-muted">${esc(f.note)}</div>` : ''}
        </td>
        <td class="mono">${esc(fmtSize(f.size))}</td>
        <td class="text-muted">${esc(f.created_at?.slice(0,16) || '-')}</td>
        <td class="text-muted">${esc(f.category || '-')}</td>
        <td>
          <div class="flex gap-2">
            <a href="${API}/api/files/download/${esc(encodeURIComponent(f.id))}" class="btn btn-secondary btn-sm">⬇ 다운로드</a>
            <button class="btn btn-danger btn-sm btn-icon" onclick="deleteFile(${jsArg(f.id)})">🗑</button>
          </div>
        </td>
      </tr>
    `).join('')
    : '<tr><td colspan="5" style="text-align:center;color:var(--text-3);padding:30px">업로드된 파일이 없습니다.</td></tr>';
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
      toast(`✅ ${file.name} 업로드 완료`);
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
