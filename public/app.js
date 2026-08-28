const ACCIDENT_TYPES = ['교통사고', '시설물파손', '기기이상', '부상자 발생', '기타'];
const API_BASE_URL = 'https://tkrhqhrh.onrender.com/api';
const WEEKLY_CHECKLIST_ITEMS = [
  '차량 외관 및 타이어 상태',
  '제동장치(브레이크) 점검',
  '등화장치(전조등·후미등·방향지시등) 점검',
  '안전벨트 및 안전운행수칙 준수',
  '화물 적재상태 및 결속상태',
  '소화기 등 소방시설 비치·점검',
  '작업장 정리정돈 및 통로 확보',
  '개인보호구(안전화 등) 착용상태',
];
const INSPECTION_RESULTS = ['양호', '미흡', '해당없음'];
const ICON_PLUS = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>';
const ICON_LINK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 5h5v5"/><path d="M19 5 10 14"/><path d="M18 13v5a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/></svg>';
const ICON_STAT_TOTAL = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 3.5h10a1 1 0 0 1 1 1V19a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1Z"/><line x1="8.5" y1="8" x2="15.5" y2="8"/><line x1="8.5" y1="12" x2="15.5" y2="12"/><line x1="8.5" y1="16" x2="12.5" y2="16"/></svg>';
const ICON_STAT_INBOX = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 13 6.5 5h11L20 13"/><path d="M4 13v5a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-5"/><path d="M4 13h4.5l1 2h5l1-2H20"/></svg>';
const ICON_STAT_SEARCH = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="10.5" cy="10.5" r="6"/><line x1="15" y1="15" x2="20" y2="20"/></svg>';
const ICON_STAT_CHECK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M8 12.5 10.5 15 16 9"/></svg>';
const ICON_STAT_PIE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3.5v8.5h8.5"/><path d="M12 12A8.5 8.5 0 1 1 3.7 7.2"/></svg>';

const state = {
  accidents: [],
  branches: [],
  inspections: [],
  route: 'dashboard',
  routeParam: null,
  charts: {},
  calendar: null,
};

const $content = document.getElementById('content');
const $breadcrumb = document.getElementById('breadcrumb');
const $navBadge = document.getElementById('navBadge');
const $navBadgeMobile = document.getElementById('navBadgeMobile');

// ---------- utils ----------
function esc(s) {
  if (s === undefined || s === null) return '';
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function toast(msg, isError) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.style.background = isError ? '#eb2333' : '#0b1f4d';
  el.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.remove('show'), 2500);
}
async function api(path, opts) {
  let res;
  try {
    res = await fetch(API_BASE_URL + path, { credentials: 'include', ...(opts || {}) });
  } catch (e) {
    throw new Error('서버에 연결할 수 없습니다. 네트워크 연결을 확인해주세요.');
  }
  if (!res.ok) {
    let msg = `요청 처리 중 오류가 발생했습니다. (${res.status})`;
    try { const j = await res.json(); msg = j.error || msg; } catch (e) {}
    if (res.status === 413) msg = '사진 용량이 너무 큽니다. 사진 1장당 10MB 이하인지 확인해주세요.';
    throw new Error(msg);
  }
  if (res.status === 204) return null;
  return res.json();
}

const $authScreen = document.getElementById('authScreen');
const $loginForm = document.getElementById('loginForm');
const $loginError = document.getElementById('loginError');
const $loginButton = document.getElementById('loginButton');
const $authToggle = document.getElementById('authToggle');
const $signupScreen = document.getElementById('signupScreen');
const $signupForm = document.getElementById('signupForm');
const $signupError = document.getElementById('signupError');
const $signupButton = document.getElementById('signupButton');
const $approvalPanel = document.getElementById('approvalPanel');
const $approvalList = document.getElementById('approvalList');
const $approvalButton = document.getElementById('approvalButton');
const $approvalCount = document.getElementById('approvalCount');
const $notificationButton = document.getElementById('enableNotifications');
const $signupOfficeField = document.getElementById('signupOfficeField');
const $signupOffice = document.getElementById('loginSignupOffice');
let authMode = 'login';

function showLogin() {
  $authScreen.classList.add('open');
  document.querySelector('.app').classList.add('auth-locked');
  document.getElementById('loginUsername').focus();
}

function hideLogin() {
  $authScreen.classList.remove('open');
  document.querySelector('.app').classList.remove('auth-locked');
}

function updateNotificationButton() {
  if (!$notificationButton || !('Notification' in window)) return;
  $notificationButton.textContent = Notification.permission === 'granted' ? '알림 켜짐' : '알림 켜기';
  $notificationButton.disabled = Notification.permission === 'granted';
}

async function enableNotifications() {
  if (!('Notification' in window)) {
    toast('이 브라우저는 알림을 지원하지 않습니다.', true);
    return;
  }
  const permission = await Notification.requestPermission();
  updateNotificationButton();
  if (permission === 'granted') toast('알림을 켰습니다.');
  else toast('브라우저 설정에서 알림 권한을 허용해주세요.', true);
}

async function notifyNewAccident(accident) {
  if (!accident || !('Notification' in window) || Notification.permission !== 'granted') return;
  const title = '새 사고가 등록되었습니다';
  const body = `${accident.location || '-'} · ${accident.accident_type || '기타'}`;
  if ('serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.ready;
      await registration.showNotification(title, { body, tag: `accident-${accident.id}`, data: { url: `#/accidents/${accident.id}` } });
      return;
    } catch (e) {}
  }
  const notification = new Notification(title, { body, tag: `accident-${accident.id}` });
  notification.onclick = () => { window.focus(); location.hash = `#/accidents/${accident.id}`; notification.close(); };
}

if ($notificationButton) $notificationButton.addEventListener('click', enableNotifications);
updateNotificationButton();

async function loadApprovalRequests() {
  try {
    const users = await api('/auth/pending-users');
    $approvalButton.hidden = false;
    $approvalCount.textContent = users.length;
    $approvalCount.hidden = !users.length;
    if (!users.length) {
      $approvalList.innerHTML = '<div class="approval-empty">현재 가입 승인 대기자가 없습니다.</div>';
      return;
    }
    $approvalList.innerHTML = users.map(user => `
      <div class="approval-row">
        <div><strong>${esc(user.username)}</strong><span>${esc(user.office_name)} · 신청 ${esc(user.created_at)}</span></div>
        <div class="approval-actions">
          <button type="button" class="approve" data-user-id="${user.id}" data-status="approved">승인</button>
          <button type="button" class="reject" data-user-id="${user.id}" data-status="rejected">거절</button>
        </div>
      </div>`).join('');
    $approvalPanel.classList.add('open');
    $approvalList.querySelectorAll('[data-user-id]').forEach(button => {
      button.addEventListener('click', async () => {
        button.disabled = true;
        try {
          await api(`/auth/users/${button.dataset.userId}/status`, {
            method: 'PATCH', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: button.dataset.status }),
          });
          toast(button.dataset.status === 'approved' ? '가입을 승인했습니다.' : '가입을 거절했습니다.');
          loadApprovalRequests();
        } catch (e) { toast(e.message, true); button.disabled = false; }
      });
    });
  } catch (e) {
    $approvalButton.hidden = true;
    $approvalPanel.classList.remove('open');
  }
}

document.getElementById('closeApprovalPanel').addEventListener('click', () => $approvalPanel.classList.remove('open'));
$approvalButton.addEventListener('click', () => {
  $approvalPanel.classList.add('open');
  loadApprovalRequests();
});

$loginForm.addEventListener('submit', async (ev) => {
  ev.preventDefault();
  $loginButton.disabled = true;
  $loginButton.textContent = authMode === 'login' ? '로그인 중...' : '가입 중...';
  $loginError.textContent = '';
  try {
    const username = document.getElementById('loginUsername').value.trim();
    const password = document.getElementById('loginPassword').value;
    await api(authMode === 'login' ? '/auth/login' : '/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password, office_name: $signupOffice.value }),
    });
    if (authMode === 'signup') {
      authMode = 'login';
      $loginButton.textContent = '로그인';
      $authToggle.textContent = '회원가입';
      $loginPassword.value = '';
      $loginError.textContent = '회원가입이 완료되었습니다. 로그인해주세요.';
    } else {
      hideLogin();
      enableNotifications();
      await router();
      connectSSE();
    }
  } catch (e) {
    $loginError.textContent = e.message;
  } finally {
    $loginButton.disabled = false;
    $loginButton.textContent = authMode === 'login' ? '로그인' : '회원가입';
  }
});

$authToggle.addEventListener('click', () => {
  $signupScreen.classList.add('open');
  document.getElementById('signupUsername').focus();
});

document.getElementById('closeSignup').addEventListener('click', () => $signupScreen.classList.remove('open'));
$signupScreen.addEventListener('click', (ev) => {
  if (ev.target === $signupScreen) $signupScreen.classList.remove('open');
});

$signupForm.addEventListener('submit', async (ev) => {
  ev.preventDefault();
  $signupButton.disabled = true;
  $signupButton.textContent = '신청 중...';
  $signupError.textContent = '';
  try {
    await api('/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: document.getElementById('signupUsername').value.trim(),
        password: document.getElementById('signupPassword').value,
        office_name: document.getElementById('signupOffice').value.trim(),
      }),
    });
    $signupForm.reset();
    $signupScreen.classList.remove('open');
    $loginError.textContent = '가입 신청이 완료되었습니다. 승인 후 로그인해주세요.';
  } catch (e) {
    $signupError.textContent = e.message;
  } finally {
    $signupButton.disabled = false;
    $signupButton.textContent = '가입 신청';
  }
});

document.getElementById('logoutButton').addEventListener('click', async () => {
  try { await api('/auth/logout', { method: 'POST' }); } catch (e) {}
  showLogin();
});
function fmtDate(s) { return s || '-'; }

function printAccidentReport(accident) {
  const printWindow = window.open('', '_blank', 'width=900,height=1000');
  if (!printWindow) {
    toast('팝업이 차단되었습니다. 브라우저에서 팝업을 허용해주세요.', true);
    return;
  }
  const logs = (accident.action_log || []).map(log => `
    <tr><td>${esc(log.created_at)}</td><td>${esc(log.type)}</td><td>${esc(log.content)}</td></tr>
  `).join('');
  const photos = (accident.photos || []).map(photo => `<img src="${esc(photo)}" alt="사고 현장 사진">`).join('');
  printWindow.document.write(`<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>사고 보고서 #${esc(accident.id)}</title>
    <style>
      @page { size: A4; margin: 15mm; }
      * { box-sizing: border-box; }
      body { margin: 0; color: #111827; font-family: "Malgun Gothic", sans-serif; font-size: 11pt; }
      h1 { margin: 0; text-align: center; font-size: 22pt; letter-spacing: 0; }
      .head { padding-bottom: 14px; border-bottom: 2px solid #111827; }
      .meta { display: flex; justify-content: space-between; margin-top: 10px; color: #4b5563; font-size: 9pt; }
      .section { margin-top: 18px; page-break-inside: avoid; }
      .section-title { padding: 7px 9px; background: #eef2f7; border: 1px solid #cbd5e1; font-weight: 700; }
      table { width: 100%; border-collapse: collapse; table-layout: fixed; }
      th, td { padding: 8px; border: 1px solid #cbd5e1; text-align: left; vertical-align: top; word-break: break-word; }
      th { width: 22%; background: #f8fafc; font-weight: 700; }
      .logs th { width: auto; }
      .photos { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; padding-top: 10px; }
      .photos img { width: 100%; max-height: 110mm; object-fit: contain; border: 1px solid #cbd5e1; }
      .empty { color: #6b7280; padding: 12px 0; }
      .footer { margin-top: 28px; text-align: right; color: #4b5563; font-size: 9pt; }
    </style></head><body>
    <div class="head"><h1>사고 보고서</h1><div class="meta"><span>보고서 번호: #${esc(accident.id)}</span><span>상태: ${esc(accident.status)}</span></div></div>
    <div class="section"><div class="section-title">1. 사고 기본정보</div><table>
      <tr><th>사고 일시</th><td>${esc(accident.datetime)}</td><th>등록자</th><td>${esc(accident.reporter)}</td></tr>
      <tr><th>발생 장소</th><td>${esc(formatLocation(accident.location))}</td><th>사고 유형</th><td>${esc(accident.accident_type)}</td></tr>
      <tr><th>사고 내용</th><td colspan="3">${esc(accident.description)}</td></tr>
    </table></div>
    <div class="section"><div class="section-title">2. 조치 내용</div><table class="logs"><tr><th>일시</th><th>구분</th><th>내용</th></tr>${logs || '<tr><td colspan="3" class="empty">등록된 조치 내용이 없습니다.</td></tr>'}</table></div>
    <div class="section"><div class="section-title">3. 첨부 사진</div>${photos ? `<div class="photos">${photos}</div>` : '<div class="empty">첨부된 사진이 없습니다.</div>'}</div>
    <div class="footer">작성일: ${esc(accident.created_at)}${accident.updated_by ? ` · 최종 수정자: ${esc(accident.updated_by)}` : ''}</div>
    </body></html>`);
  printWindow.document.close();
  printWindow.focus();
  printWindow.setTimeout(() => printWindow.print(), 500);
}

// ---------- data ----------
async function loadAccidents() {
  state.accidents = await api('/accidents');
  updateBadge();
  return state.accidents;
}
async function loadBranches() {
  if (state.branches.length) return state.branches;
  state.branches = await api('/branches');
  return state.branches;
}
async function loadInspections() {
  state.inspections = await api('/inspections');
  return state.inspections;
}
function updateBadge() {
  const open = state.accidents.filter(a => a.status !== '완료').length;
  [$navBadge, $navBadgeMobile].forEach($b => {
    if (!$b) return;
    if (open > 0) { $b.hidden = false; $b.textContent = open; }
    else { $b.hidden = true; }
  });
}

// ---------- router ----------
const NAV_ROUTE_ALIAS = {
  detail: 'actions',
  'inspection-detail': 'inspections',
  'action-detail': 'actions',
};
// 모바일 하단 탭(홈/사고등록/조치결과/사고분석)이 어떤 라우트를 포괄하는지 매핑
const ROUTE_TO_TAB = {
  dashboard: 'home',
  register: 'register',
  actions: 'actions', 'action-detail': 'actions', detail: 'actions',
  analytics: 'status',
  inspections: 'status', 'inspection-detail': 'status',
};
const TAB_DEFAULT_ROUTE = { home: '#/dashboard', register: '#/register', actions: '#/actions', status: '#/analytics' };
let currentRegisterType = 'accident';

function parseHash() {
  const h = location.hash.replace(/^#\//, '');
  const parts = h.split('/').filter(Boolean);
  if (parts[0] === 'accidents' && parts[1]) return { route: 'detail', param: parts[1] };
  if (parts[0] === 'actions' && parts[1]) return { route: 'action-detail', param: parts[1] };
  if (parts[0] === 'inspections' && parts[1]) return { route: 'inspection-detail', param: parts[1] };
  if (parts[0]) return { route: parts[0], param: null };
  return { route: 'dashboard', param: null };
}
function updateTopbarButton(activeRoute) {
  const btn = document.getElementById('openRegisterModal');
  if (activeRoute === 'inspections') { currentRegisterType = 'inspection'; btn.textContent = '+ 점검 등록'; }
  else { currentRegisterType = 'accident'; btn.textContent = '+ 보고서 등록'; }
}
async function router() {
  const { route, param } = parseHash();
  state.route = route;
  state.routeParam = param;

  const activeRoute = NAV_ROUTE_ALIAS[route] || route;
  document.querySelectorAll('.sidebar .nav-item').forEach(el => {
    el.classList.toggle('active', el.dataset.route === activeRoute);
  });
  const activeTab = ROUTE_TO_TAB[route] || 'home';
  document.querySelectorAll('.bottom-nav-item[data-tab]').forEach(el => {
    el.classList.toggle('active', el.dataset.tab === activeTab);
  });
  updateTopbarButton(activeRoute);

  try {
    await loadAccidents();
    if (route === 'dashboard') await renderDashboard();
    else if (route === 'register') await renderRegisterPage();
    else if (route === 'actions') await renderActionsPage();
    else if (route === 'action-detail') await renderActionDetail(param);
    else if (route === 'detail') await renderDetail(param);
    else if (route === 'analytics') await renderAnalytics();
    else if (route === 'inspections') await renderInspectionList();
    else if (route === 'inspection-detail') await renderInspectionDetail(param);
    else await renderDashboard();
  } catch (e) {
    $content.innerHTML = `<div class="empty-state">오류가 발생했습니다: ${esc(e.message)}</div>`;
  }
}
window.addEventListener('hashchange', router);

function setBreadcrumb(main, sub) {
  $breadcrumb.innerHTML = `${esc(main)} <span class="sep">/</span> <span class="muted">${esc(sub)}</span>`;
}

// ---------- Dashboard ----------
const NOTICES = [
  '하계휴가철 대비 현수막 및 환경정비 철저',
];
function nowKSTDate() {
  return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}
function daysBetween(fromStr, toStr) {
  const d1 = new Date((fromStr || '').slice(0, 10));
  const d2 = new Date((toStr || '').slice(0, 10));
  if (isNaN(d1) || isNaN(d2)) return 0;
  return Math.max(0, Math.round((d2 - d1) / 86400000));
}

// ---------- 캘린더 ----------
function getAccidentDate(a) {
  return (a.datetime || a.created_at || '').slice(0, 10);
}
function splitLocation(location) {
  const branch = state.branches.find(b => location === b.name || location.startsWith(b.name + ' '));
  if (!branch) return { branch: '', office: location };
  return { branch: branch.name, office: location.slice(branch.name.length).trim() };
}
function officeNameOf(location) {
  const { branch, office } = splitLocation(location);
  return branch ? (office || location) : location;
}
function formatLocation(location) {
  const { branch, office } = splitLocation(location);
  if (!branch) return location;
  return office ? `${branch}지사/${office}영업소` : `${branch}지사`;
}
function buildCalendarData() {
  const accByDate = {};
  state.accidents.forEach(a => {
    const d = getAccidentDate(a);
    if (!d) return;
    (accByDate[d] = accByDate[d] || []).push(a);
  });
  return { accByDate };
}
function renderCalendarCard() {
  const el = document.getElementById('calendarCard');
  if (!el) return;
  const { year, month, selectedDate } = state.calendar;
  const { accByDate } = buildCalendarData();
  const todayStr = nowKSTDate();
  const firstDow = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const pad = n => String(n).padStart(2, '0');

  let cells = '';
  for (let i = 0; i < firstDow; i++) cells += `<div class="cal-cell cal-cell-empty"></div>`;
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${pad(month + 1)}-${pad(d)}`;
    const accs = accByDate[dateStr] || [];
    const cls = ['cal-cell'];
    if (dateStr === todayStr) cls.push('cal-cell-today');
    if (dateStr === selectedDate) cls.push('cal-cell-selected');

    let chipsHtml = '';
    if (accs.length) {
      const label = officeNameOf(accs[0].location) + (accs.length > 1 ? ` 외${accs.length - 1}` : '');
      chipsHtml = `<span class="cal-event-chip"><span class="cal-dot cal-dot-red"></span>${esc(label)}</span>`;
    }

    cells += `
      <button type="button" class="${cls.join(' ')}" data-date="${dateStr}">
        <span class="cal-daynum">${d}</span>
        ${chipsHtml ? `<span class="cal-cell-events">${chipsHtml}</span>` : ''}
      </button>`;
  }

  const selAccs = accByDate[selectedDate] || [];
  const [, sm, sd] = selectedDate.split('-').map(Number);

  el.innerHTML = `
    <div class="card-head">
      <h3>캘린더</h3>
      <div class="cal-head-actions">
        <div class="cal-legend">
          <span><span class="cal-dot cal-dot-red"></span>사고</span>
        </div>
        <button type="button" class="subtab-add" id="calAddBtn" aria-label="사고 등록">${ICON_PLUS}</button>
      </div>
    </div>
    <div class="cal-nav">
      <button type="button" class="cal-nav-btn" id="calPrev" aria-label="이전 달">‹</button>
      <div class="cal-month-label">${year}년 ${month + 1}월</div>
      <button type="button" class="cal-nav-btn" id="calNext" aria-label="다음 달">›</button>
    </div>
    <div class="cal-weekdays">${['일', '월', '화', '수', '목', '금', '토'].map(w => `<div>${w}</div>`).join('')}</div>
    <div class="cal-grid">${cells}</div>
    <div class="cal-detail">
      <div class="cal-detail-date">${sm}월 ${sd}일</div>
      ${selAccs.length === 0 ? `<div class="empty-state" style="padding:10px 0;">등록된 사고가 없습니다.</div>` : `
        ${selAccs.map(a => `
          <div class="cal-detail-item" data-goto-hash="#/accidents/${a.id}">
            <span class="cal-dot cal-dot-red"></span>
            <span class="cal-detail-text">${esc(officeNameOf(a.location))} · ${esc(a.accident_type)}</span>
          </div>`).join('')}
      `}
    </div>
  `;

  document.getElementById('calPrev').addEventListener('click', () => {
    state.calendar.month--;
    if (state.calendar.month < 0) { state.calendar.month = 11; state.calendar.year--; }
    renderCalendarCard();
  });
  document.getElementById('calNext').addEventListener('click', () => {
    state.calendar.month++;
    if (state.calendar.month > 11) { state.calendar.month = 0; state.calendar.year++; }
    renderCalendarCard();
  });
  el.querySelectorAll('[data-date]').forEach(btn => {
    btn.addEventListener('click', () => {
      state.calendar.selectedDate = btn.dataset.date;
      renderCalendarCard();
    });
  });
  el.querySelectorAll('[data-goto-hash]').forEach(row => {
    row.addEventListener('click', () => { location.hash = row.dataset.gotoHash; });
  });
  document.getElementById('calAddBtn').addEventListener('click', () => {
    const nowTime = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(11, 16);
    openAppModal('accident', null, { datetime: `${state.calendar.selectedDate}T${nowTime}` });
  });
}

async function renderDashboard() {
  setBreadcrumb('홈', '오늘의 현황');
  await Promise.all([loadInspections(), loadBranches()]);
  if (!state.calendar) {
    const [y, m, d] = nowKSTDate().split('-').map(Number);
    state.calendar = { year: y, month: m - 1, selectedDate: nowKSTDate() };
  }
  const list = state.accidents;
  const pending = list.filter(a => a.status !== '완료');
  const byDateAsc = [...list].sort((a, b) => (a.datetime || '').localeCompare(b.datetime || ''));
  const lastAccident = byDateAsc[byDateAsc.length - 1];
  const daysSinceLast = lastAccident ? daysBetween(lastAccident.datetime, nowKSTDate()) : null;

  $content.innerHTML = `
    <div class="stat-grid" id="dashStatGrid">
      ${statCard('전체 사고', list.length, '누적', '', ICON_STAT_TOTAL, 'data-drilldown="all"')}
      ${statCard('처리 대기', pending.length, '사고접수 + 검토중', 'amber', ICON_STAT_INBOX, 'data-drilldown="pending"')}
      ${statCard('무사고 경과일', daysSinceLast !== null ? daysSinceLast + '일' : '-', '최근 사고 이후', daysSinceLast === null ? '' : (daysSinceLast >= 7 ? 'green' : 'amber'), ICON_STAT_CHECK)}
    </div>
    <div class="scroll-dots" id="dashStatDots"></div>
    <div class="card">
      <div class="card-head"><h3>공지사항</h3></div>
      ${NOTICES.length ? `
      <ul class="notice-list">
        ${NOTICES.map(n => `<li>${esc(n)}</li>`).join('')}
      </ul>` : `<div class="empty-state">등록된 공지사항이 없습니다.</div>`}
    </div>
    <div class="dash-grid">
      <div class="card" id="calendarCard"></div>
      <div>
        <div class="card">
          <div class="card-head"><h3>월별 추이</h3></div>
          <div class="chart-wrap"><canvas id="miniTrendChart"></canvas></div>
        </div>
      </div>
    </div>
  `;
  $content.querySelectorAll('[data-goto-hash]').forEach(el => {
    el.addEventListener('click', () => { location.hash = el.dataset.gotoHash; });
  });
  $content.querySelectorAll('[data-drilldown]').forEach(el => {
    el.addEventListener('click', () => {
      if (el.dataset.drilldown === 'all') openDrilldown(`전체 사고 (${list.length}건)`, list);
      else if (el.dataset.drilldown === 'pending') openDrilldown(`처리 대기 (${pending.length}건)`, pending);
    });
  });
  renderCalendarCard();
  setupCarouselDots(document.getElementById('dashStatGrid'), document.getElementById('dashStatDots'));

  const stats = await api('/stats');
  renderMiniTrendChart(stats);
}
function statCard(title, value, sub, cls, icon, dataAttr) {
  return `<div class="stat-card${dataAttr ? ' stat-card-clickable' : ''}"${dataAttr ? ' ' + dataAttr : ''}>
    ${icon ? `<div class="stat-icon ${cls || ''}">${icon}</div>` : ''}
    <div class="stat-title">${esc(title)}</div>
    <div class="stat-value ${cls || ''}">${esc(value)}</div>
    <div class="stat-sub">${esc(sub)}</div>
  </div>`;
}
function setupCarouselDots(gridEl, dotsEl) {
  if (!gridEl || !dotsEl) return;
  const items = gridEl.children;
  if (!items.length) return;
  dotsEl.innerHTML = Array.from(items).map((_, i) => `<span class="scroll-dot"></span>`).join('');
  const dots = dotsEl.querySelectorAll('.scroll-dot');
  function update() {
    const cardW = items[0].getBoundingClientRect().width + 10;
    const idx = Math.min(dots.length - 1, Math.round(gridEl.scrollLeft / cardW));
    dots.forEach((d, i) => d.classList.toggle('active', i === idx));
  }
  gridEl.addEventListener('scroll', () => requestAnimationFrame(update), { passive: true });
  update();
}

// ---------- 사고 등록 (전용 탭) ----------
async function renderRegisterPage() {
  setBreadcrumb('사고등록', '새 사고 보고서 작성');
  await loadBranches();
  $content.innerHTML = `<div class="card"><div id="registerPageFormWrap"></div></div>`;
  document.getElementById('registerPageFormWrap').innerHTML = buildFormHTML('page');
  bindForm('page', null, (accident) => { location.hash = `#/accidents/${accident.id}`; });
}

// ---------- 조치 내용 / 처리 상태 (사고 상세 + 조치결과 페이지 공용) ----------
function timelineCardHTML(accident) {
  return `
    <div class="card">
      <div class="card-head"><h3>조치 내용</h3></div>
      <ul class="timeline" id="timelineList">
        ${(accident.action_log || []).length ? accident.action_log.map(e => `
          <li>
            <span class="tl-tag">${esc(e.type)}</span>
            <div class="tl-content">${esc(e.content)}<div class="tl-date">${esc(e.created_at)}</div></div>
            <span class="tl-del" data-del-log="${e.id}">✕</span>
          </li>`).join('') : '<div class="empty-state">등록된 조치 이력이 없습니다.</div>'}
      </ul>
      <form id="logForm" style="margin-top:14px;display:flex;flex-wrap:nowrap;gap:8px;">
        <input id="logContent" placeholder="조치 내용을 입력하세요" style="flex:1;min-width:0;padding:11px;border:1px solid var(--border);border-radius:8px;font-size:15px;">
        <button class="btn btn-primary" type="submit" style="flex-shrink:0;">추가</button>
      </form>
    </div>
  `;
}
function statusCardHTML(accident) {
  return `
    <div class="card">
      <div class="card-head"><h3>처리 상태</h3></div>
      <div class="status-select">
        ${['사고접수', '검토중', '완료'].map(s => `
          <button class="status-btn ${accident.status === s ? 'active ' + s : ''}" data-status="${s}">${s}</button>
        `).join('')}
      </div>
    </div>
  `;
}
function bindTimelineAndStatus(id, onUpdate) {
  $content.querySelectorAll('.status-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      try {
        await api(`/accidents/${id}/status`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: btn.dataset.status })
        });
        toast('상태가 변경되었습니다.');
        onUpdate();
      } catch (e) { toast(e.message, true); }
    });
  });

  $content.querySelectorAll('[data-del-log]').forEach(el => {
    el.addEventListener('click', async () => {
      if (!confirm('이 조치 항목을 삭제하시겠습니까?')) return;
      try {
        await api(`/accidents/${id}/action-log/${el.dataset.delLog}`, { method: 'DELETE' });
        onUpdate();
      } catch (e) { toast(e.message, true); }
    });
  });

  document.getElementById('logForm').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const content = document.getElementById('logContent').value.trim();
    if (!content) return;
    try {
      await api(`/accidents/${id}/action-log`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: '조치 내용', content })
      });
      onUpdate();
    } catch (e) { toast(e.message, true); }
  });
}

// ---------- 관계자 의견 (사고 상세 + 조치결과 페이지 공용) ----------
function commentsCardHTML(accident) {
  return `
    <div class="card">
      <div class="card-head"><h3>관계자 의견 ${accident.comments.length ? `(${accident.comments.length})` : ''}</h3></div>
      <div id="commentsList">
        ${accident.comments.length ? accident.comments.map(c => `
          <div class="comment-item">
            <div class="comment-head">
              <span class="comment-author">${esc(c.author)}</span>
              <span class="comment-role">${esc(c.role)}</span>
              <span class="comment-date">${esc(c.created_at)}</span>
            </div>
            <div class="comment-content">${esc(c.content)}</div>
          </div>`).join('') : '<div class="empty-state">등록된 의견이 없습니다.</div>'}
      </div>
      <form id="commentForm" style="margin-top:14px;">
        <div class="form-row">
          <div class="form-group"><label>작성자</label><input id="cAuthor" required></div>
          <div class="form-group"><label>소속</label><input id="cRole" placeholder="예: 본부, ○○자회사" required></div>
        </div>
        <div class="form-group"><label>의견 내용</label><textarea id="cContent" required></textarea></div>
        <button class="btn btn-primary btn-block" type="submit">의견 등록</button>
      </form>
    </div>
  `;
}
function bindComments(id, onUpdate) {
  document.getElementById('commentForm').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const author = document.getElementById('cAuthor').value.trim();
    const role = document.getElementById('cRole').value.trim();
    const content = document.getElementById('cContent').value.trim();
    if (!author || !role || !content) return;
    try {
      await api(`/accidents/${id}/comments`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ author, role, content })
      });
      onUpdate();
    } catch (e) { toast(e.message, true); }
  });
}

// ---------- Detail ----------
async function renderDetail(id) {
  await loadBranches();
  const accident = await api(`/accidents/${id}`);
  setBreadcrumb('조치결과', `보고서 #${accident.id}`);
  $content.innerHTML = `
    <div class="detail-header">
      <div>
        <h2 class="detail-title">${esc(formatLocation(accident.location))} · ${esc(accident.accident_type)}</h2>
        <div class="detail-meta">등록 ${esc(accident.created_at)} · 수정 ${esc(accident.updated_at)}</div>
      </div>
      <div class="detail-actions">
        <button class="btn btn-secondary" id="printBtn">인쇄</button>
        <button class="btn btn-secondary" id="editBtn">수정</button>
        <button class="btn btn-danger" id="deleteBtn">삭제</button>
      </div>
    </div>
    <div class="detail-grid">
      <div>
        <div class="card">
          <div class="card-head"><h3>사고 정보</h3></div>
          <div class="info-row"><div class="k">사고 일시</div><div class="v">${esc(accident.datetime)}</div></div>
          <div class="info-row"><div class="k">발생 장소</div><div class="v">${esc(formatLocation(accident.location))}</div></div>
          <div class="info-row"><div class="k">등록자</div><div class="v">${esc(accident.reporter)}</div></div>
          <div class="info-row"><div class="k">사고 유형</div><div class="v">${esc(accident.accident_type)}</div></div>
          <div class="info-row"><div class="k">사고 내용</div><div class="v">${esc(accident.description)}</div></div>
          ${accident.action_taken ? `<div class="info-row"><div class="k">조치 사항</div><div class="v">${esc(accident.action_taken)}</div></div>` : ''}
          ${accident.photos && accident.photos.length ? `
          <div class="info-row"><div class="k">첨부 사진</div><div class="v">
            <div class="photo-grid">
              ${accident.photos.map(p => `<img src="${esc(p)}" data-full="${esc(p)}">`).join('')}
            </div>
          </div></div>` : ''}
          ${accident.updated_by ? `<div class="detail-meta" style="margin-top:10px;">최종 수정: ${esc(accident.updated_by)} · ${esc(accident.updated_at)}</div>` : ''}
        </div>

        ${timelineCardHTML(accident)}

        ${commentsCardHTML(accident)}
      </div>

      <div>
        ${statusCardHTML(accident)}
      </div>
    </div>
  `;

  document.getElementById('editBtn').addEventListener('click', () => openAppModal('accident', accident));
  document.getElementById('printBtn').addEventListener('click', () => printAccidentReport(accident));
  document.getElementById('deleteBtn').addEventListener('click', async () => {
    if (!confirm('이 사고 보고서를 삭제하시겠습니까?')) return;
    try {
      await api(`/accidents/${id}`, { method: 'DELETE' });
      toast('삭제되었습니다.');
      location.hash = '#/actions';
    } catch (e) { toast(e.message, true); }
  });

  bindTimelineAndStatus(id, () => renderDetail(id));
  bindComments(id, () => renderDetail(id));

  $content.querySelectorAll('.photo-grid img').forEach(img => {
    img.addEventListener('click', () => openLightbox(img.dataset.full));
  });
}

// ---------- 조치결과 (칸반보드: 상태별로 한눈에 보고, 상세 화면에서 처리) ----------
const ACTION_STATUSES = ['사고접수', '검토중', '완료'];
function kanbanCardHTML(a) {
  return `
    <div class="kanban-card st-${esc(a.status)}" data-goto="${a.id}">
      <div class="kanban-card-top">
        <span class="kanban-card-id">#${a.id}</span>
        <span class="kanban-card-type">${esc(a.accident_type)}</span>
        <button type="button" class="kanban-card-link" data-view="${a.id}" title="사고 상세 보기">${ICON_LINK}</button>
      </div>
      <div class="kanban-card-loc">${esc(formatLocation(a.location))}</div>
      <div class="kanban-card-datetime">사고일시 ${esc(a.datetime)} · 등록자 ${esc(a.reporter)}</div>
      <div class="kanban-card-desc">${esc(a.description)}</div>
      <div class="kanban-card-meta">조치 ${a.action_log_count || 0}건 · 의견 ${a.comment_count || 0}건</div>
    </div>
  `;
}
let kanbanActiveStatus = '사고접수';
let kanbanSearchQuery = '';
function accidentMatchesQuery(a, q) {
  if (!q) return true;
  const hay = [`#${a.id}`, formatLocation(a.location), a.description, a.reporter, a.accident_type].join(' ').toLowerCase();
  return hay.includes(q.toLowerCase());
}
function renderKanbanBoard() {
  const q = kanbanSearchQuery.trim();
  const filtered = state.accidents.filter(a => accidentMatchesQuery(a, q));
  const counts = {};
  ACTION_STATUSES.forEach(s => { counts[s] = filtered.filter(a => a.status === s).length; });

  $content.querySelectorAll('#kanbanTabs .subtab-btn').forEach(btn => {
    btn.textContent = `${btn.dataset.status} ${counts[btn.dataset.status]}`;
  });

  const board = document.getElementById('kanbanBoard');
  board.innerHTML = ACTION_STATUSES.map(status => {
    const items = filtered.filter(a => a.status === status);
    return `
      <div class="kanban-col ${status === kanbanActiveStatus ? 'kanban-col-active' : ''}">
        <div class="kanban-col-head">
          <span class="badge st-${status}">${status}</span>
          <span class="kanban-col-count">${items.length}건</span>
        </div>
        <div class="kanban-col-body">
          ${items.length ? items.map(kanbanCardHTML).join('') : `<div class="kanban-empty">${q ? '검색 결과가 없습니다.' : '해당 사고가 없습니다.'}</div>`}
        </div>
      </div>
    `;
  }).join('');

  board.querySelectorAll('.kanban-card').forEach(card => {
    card.addEventListener('click', (ev) => {
      if (ev.target.closest('.kanban-card-link')) return;
      location.hash = `#/actions/${card.dataset.goto}`;
    });
  });
  board.querySelectorAll('.kanban-card-link').forEach(btn => {
    btn.addEventListener('click', (ev) => {
      ev.stopPropagation();
      location.hash = `#/accidents/${btn.dataset.view}`;
    });
  });
}
async function renderActionsPage() {
  await loadBranches();
  setBreadcrumb('조치결과', `조치/진행상황 관리 · 전체 ${state.accidents.length}건`);

  $content.innerHTML = `
    <div class="kanban-search">
      <input type="search" id="kanbanSearchInput" placeholder="영업소, 사고 내용, 등록자로 검색" value="${esc(kanbanSearchQuery)}">
    </div>
    <div class="subtab-bar" id="kanbanTabs">
      <div class="subtab-track">
        ${ACTION_STATUSES.map(s => `
          <button type="button" class="subtab-btn ${s === kanbanActiveStatus ? 'active' : ''}" data-status="${esc(s)}">${esc(s)}</button>
        `).join('')}
      </div>
    </div>
    <div class="kanban-board" id="kanbanBoard"></div>
  `;

  $content.querySelectorAll('#kanbanTabs .subtab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      kanbanActiveStatus = btn.dataset.status;
      $content.querySelectorAll('#kanbanTabs .subtab-btn').forEach(b => b.classList.toggle('active', b === btn));
      renderKanbanBoard();
    });
  });

  document.getElementById('kanbanSearchInput').addEventListener('input', (ev) => {
    kanbanSearchQuery = ev.target.value;
    renderKanbanBoard();
  });

  renderKanbanBoard();
}

async function renderActionDetail(id) {
  await loadBranches();
  const accident = await api(`/accidents/${id}`);
  setBreadcrumb('조치결과', `보고서 #${accident.id} · 조치/진행상황`);
  $content.innerHTML = `
    <div class="detail-header">
      <div>
        <h2 class="detail-title">${esc(formatLocation(accident.location))} · ${esc(accident.accident_type)}</h2>
        <div class="detail-meta">사고일시 ${esc(accident.datetime)} · 등록 ${esc(accident.created_at)}</div>
      </div>
    </div>
    <div class="detail-grid">
      <div>
        <div class="card">
          <div class="card-head">
            <h3>사고 내용</h3>
            <button class="btn btn-secondary" id="editAccidentBtn">수정</button>
          </div>
          <div class="info-row"><div class="k">사고 일시</div><div class="v">${esc(accident.datetime)}</div></div>
          <div class="info-row"><div class="k">발생 장소</div><div class="v">${esc(formatLocation(accident.location))}</div></div>
          <div class="info-row"><div class="k">등록자</div><div class="v">${esc(accident.reporter)}</div></div>
          <div class="info-row"><div class="k">사고 유형</div><div class="v">${esc(accident.accident_type)}</div></div>
          <div class="info-row"><div class="k">사고 내용</div><div class="v">${esc(accident.description)}</div></div>
          ${accident.photos && accident.photos.length ? `
          <div class="info-row"><div class="k">첨부 사진</div><div class="v">
            <div class="photo-grid">
              ${accident.photos.map(p => `<img src="${esc(p)}" data-full="${esc(p)}">`).join('')}
            </div>
          </div></div>` : ''}
          ${accident.updated_by ? `<div class="detail-meta" style="margin-top:10px;">최종 수정: ${esc(accident.updated_by)} · ${esc(accident.updated_at)}</div>` : ''}
        </div>

        ${timelineCardHTML(accident)}

        ${commentsCardHTML(accident)}
      </div>

      <div>
        ${statusCardHTML(accident)}
      </div>
    </div>
  `;

  document.getElementById('editAccidentBtn').addEventListener('click', () => openAppModal('accident', accident));
  bindTimelineAndStatus(id, () => renderActionDetail(id));
  bindComments(id, () => renderActionDetail(id));

  $content.querySelectorAll('.photo-grid img').forEach(img => {
    img.addEventListener('click', () => openLightbox(img.dataset.full));
  });
}

// ---------- Analytics ----------
async function renderAnalytics() {
  await loadBranches();
  setBreadcrumb('사고분석', '데이터 분석');
  const stats = await api('/stats');
  const avgMonth = (stats.total / 12).toFixed(1);
  const topLocation = stats.byLocation[0] ? officeNameOf(stats.byLocation[0].name) : '-';
  const typeCounts = {};
  state.accidents.forEach(a => { typeCounts[a.accident_type] = (typeCounts[a.accident_type] || 0) + 1; });
  const topType = Object.entries(typeCounts).sort((a, b) => b[1] - a[1])[0];

  const byDateAsc = [...state.accidents].sort((a, b) => (a.datetime || '').localeCompare(b.datetime || ''));
  const lastAccident = byDateAsc[byDateAsc.length - 1];
  const daysSinceLast = lastAccident ? daysBetween(lastAccident.datetime, nowKSTDate()) : null;
  const openSortedAsc = state.accidents.filter(a => a.status !== '완료')
    .sort((a, b) => (a.datetime || '').localeCompare(b.datetime || ''));
  const oldestOpen = openSortedAsc[0];
  const oldestOpenDays = oldestOpen ? daysBetween(oldestOpen.datetime, nowKSTDate()) : null;

  $content.innerHTML = `
    <div class="stat-grid analytics-grid" id="analyticsStatGrid">
      ${statCard('무사고 경과일', daysSinceLast !== null ? daysSinceLast + '일' : '-', '최근 사고 이후', daysSinceLast === null ? undefined : (daysSinceLast >= 7 ? 'green' : 'amber'))}
      ${statCard('최장 미처리 사고', oldestOpen ? oldestOpenDays + '일째' : '없음', oldestOpen ? officeNameOf(oldestOpen.location) : '처리 대기 없음', oldestOpen ? 'amber' : 'green')}
      ${statCard('최다 사고 장소', topLocation, '누적 기준')}
      ${statCard('최다 사고 유형', topType ? topType[0] : '-', '누적 기준')}
      ${statCard('완료율', stats.doneRate + '%', '전체 대비')}
      ${statCard('평균 월 사고', avgMonth, '건/월')}
    </div>
    <div class="scroll-dots" id="analyticsStatDots"></div>
    <div class="charts-2x2">
      <div class="card"><div class="card-head"><h3>월별 사고 건수 추이</h3></div>
        <div class="chart-wrap lg"><canvas id="trendChart"></canvas></div></div>
      <div class="card"><div class="card-head"><h3>사고 유형별 분포</h3></div>
        <div class="chart-wrap lg"><canvas id="typeChart"></canvas></div></div>
      <div class="card"><div class="card-head"><h3>장소별 사고 건수 Top 10</h3></div>
        <div class="chart-wrap lg"><canvas id="locationChart"></canvas></div></div>
      <div class="card"><div class="card-head"><h3>요일별 사고 분포</h3></div>
        <div class="chart-wrap lg"><canvas id="weekdayChart"></canvas></div></div>
      <div class="card"><div class="card-head"><h3>시간대별 사고 분포</h3></div>
        <div class="chart-wrap lg"><canvas id="hourChart"></canvas></div></div>
    </div>
  `;

  setupCarouselDots(document.getElementById('analyticsStatGrid'), document.getElementById('analyticsStatDots'));

  destroyCharts();
  const indigo = '#007dc2';

  state.charts.trend = new Chart(document.getElementById('trendChart'), {
    type: 'line',
    data: {
      labels: stats.byMonth.labels.map(m => m.slice(5) + '월'),
      datasets: [{
        data: stats.byMonth.data, borderColor: indigo, backgroundColor: 'rgba(0,125,194,.12)',
        fill: true, tension: .35, pointBackgroundColor: '#fff', pointBorderColor: indigo, pointRadius: 3
      }]
    },
    options: chartOpts()
  });

  const typeLabels = Object.keys(typeCounts);
  const palette = ['#007dc2', '#8b5cf6', '#f59e0b', '#10b981', '#eb2333', '#14b8a6'];
  const openTypeDrilldown = (idx) => {
    const type = typeLabels[idx];
    openDrilldown(`${type} (${typeCounts[type]}건)`, state.accidents.filter(a => a.accident_type === type));
  };
  state.charts.type = new Chart(document.getElementById('typeChart'), {
    type: 'doughnut',
    data: {
      labels: typeLabels.map(t => `${t} (${typeCounts[t]}건)`),
      datasets: [{ data: typeLabels.map(t => typeCounts[t]), backgroundColor: typeLabels.map((_, i) => palette[i % palette.length]) }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      onClick: (evt, elements) => { if (elements.length) openTypeDrilldown(elements[0].index); },
      onHover: (evt, elements) => { evt.native.target.style.cursor = elements.length ? 'pointer' : 'default'; },
      plugins: {
        legend: {
          position: 'right', labels: { boxWidth: 14, font: { size: 13.5 }, padding: 12 },
          onClick: (evt, legendItem) => openTypeDrilldown(legendItem.index)
        }
      }
    }
  });

  state.charts.location = new Chart(document.getElementById('locationChart'), {
    type: 'bar',
    data: {
      labels: stats.byLocation.map(l => officeNameOf(l.name)),
      datasets: [{ data: stats.byLocation.map(l => l.count), backgroundColor: indigo, borderRadius: 4 }]
    },
    options: {
      ...chartOpts(), indexAxis: 'y',
      onClick: (evt, elements) => {
        if (!elements.length) return;
        const loc = stats.byLocation[elements[0].index];
        openDrilldown(`${officeNameOf(loc.name)} (${loc.count}건)`, state.accidents.filter(a => a.location === loc.name));
      },
      onHover: (evt, elements) => { evt.native.target.style.cursor = elements.length ? 'pointer' : 'default'; }
    }
  });

  const weekdayLabels = ['일', '월', '화', '수', '목', '금', '토'];
  const weekdayCounts = [0, 0, 0, 0, 0, 0, 0];
  state.accidents.forEach(a => {
    const d = new Date((a.datetime || a.created_at).replace(' ', 'T'));
    if (!isNaN(d)) weekdayCounts[d.getDay()]++;
  });
  state.charts.weekday = new Chart(document.getElementById('weekdayChart'), {
    type: 'bar',
    data: { labels: weekdayLabels, datasets: [{ data: weekdayCounts, backgroundColor: '#10b981', borderRadius: 4 }] },
    options: chartOpts()
  });

  const hourLabels = Array.from({ length: 24 }, (_, i) => `${i}시`);
  const hourCounts = new Array(24).fill(0);
  state.accidents.forEach(a => {
    const d = new Date((a.datetime || a.created_at).replace(' ', 'T'));
    if (!isNaN(d)) hourCounts[d.getHours()]++;
  });
  state.charts.hour = new Chart(document.getElementById('hourChart'), {
    type: 'bar',
    data: { labels: hourLabels, datasets: [{ data: hourCounts, backgroundColor: '#f59e0b', borderRadius: 4 }] },
    options: chartOpts()
  });
}
function chartOpts() {
  return {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      y: { beginAtZero: true, ticks: { precision: 0, font: { size: 13 } } },
      x: { ticks: { font: { size: 13 } } }
    }
  };
}
function destroyCharts() {
  Object.values(state.charts).forEach(c => c && c.destroy());
  state.charts = {};
}
function renderMiniTrendChart(stats) {
  if (state.charts.mini) state.charts.mini.destroy();
  const ctx = document.getElementById('miniTrendChart');
  if (!ctx) return;
  state.charts.mini = new Chart(ctx, {
    type: 'line',
    data: {
      labels: stats.byMonth.labels.map(m => m.slice(5) + '월'),
      datasets: [{
        data: stats.byMonth.data, borderColor: '#007dc2', backgroundColor: 'rgba(0,125,194,.12)',
        fill: true, tension: .35, pointRadius: 2
      }]
    },
    options: chartOpts()
  });
}

// ---------- Weekly Inspection (주간 점검) ----------
async function renderInspectionList() {
  await loadBranches();
  await loadInspections();
  setBreadcrumb('주간 점검', `전체 ${state.inspections.length}건`);
  $content.innerHTML = `
    <div class="card">
      <div id="inspectionListWrap"></div>
    </div>
  `;
  const wrap = document.getElementById('inspectionListWrap');
  wrap.innerHTML = state.inspections.length ? `
    <table>
      <thead><tr><th>지사</th><th>영업소</th><th>점검일자</th><th>점검자</th><th>결과</th></tr></thead>
      <tbody>
        ${state.inspections.map(i => {
          const bad = (i.items || []).filter(it => it.result === '미흡').length;
          return `
          <tr class="clickable" data-goto="${i.id}">
            <td data-label="지사">${esc(i.branch_name)}</td>
            <td data-label="영업소">${esc(i.office_name)}</td>
            <td data-label="점검일자">${esc(i.inspection_date)}</td>
            <td data-label="점검자">${esc(i.inspector)}</td>
            <td data-label="결과">${bad > 0 ? `<span class="badge result-미흡">미흡 ${bad}</span>` : `<span class="badge result-양호">전체 양호</span>`}</td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>` : `<div class="empty-state">등록된 점검 기록이 없습니다.</div>`;
  wrap.querySelectorAll('[data-goto]').forEach(el => {
    el.addEventListener('click', () => { location.hash = `#/inspections/${el.dataset.goto}`; });
  });
}

async function renderInspectionDetail(id) {
  await loadBranches();
  const item = await api(`/inspections/${id}`);
  setBreadcrumb('주간 점검', `${item.branch_name} · ${item.office_name}`);
  const badCount = (item.items || []).filter(it => it.result === '미흡').length;
  $content.innerHTML = `
    <div class="detail-header">
      <div>
        <h2 class="detail-title">${esc(item.branch_name)} → ${esc(item.office_name)}</h2>
        <div class="detail-meta">점검일 ${esc(item.inspection_date)} · 점검자 ${esc(item.inspector)}</div>
      </div>
      <div class="detail-actions">
        <button class="btn btn-secondary" id="editBtn">수정</button>
        <button class="btn btn-danger" id="deleteBtn">삭제</button>
      </div>
    </div>
    <div class="card">
      <div class="card-head">
        <h3>점검 결과</h3>
        ${badCount > 0 ? `<span class="badge result-미흡">미흡 ${badCount}건</span>` : `<span class="badge result-양호">전체 양호</span>`}
      </div>
      ${(item.items || []).map(it => `
        <div class="info-row">
          <div class="k">${esc(it.item)}</div>
          <div class="v">
            <span class="badge result-${esc(it.result)}">${esc(it.result)}</span>
            ${it.note ? `<div style="margin-top:4px;color:var(--text-muted);font-size:12.5px;">${esc(it.note)}</div>` : ''}
          </div>
        </div>
      `).join('')}
      ${item.overall_note ? `<div class="info-row"><div class="k">종합의견</div><div class="v">${esc(item.overall_note)}</div></div>` : ''}
    </div>
  `;
  document.getElementById('editBtn').addEventListener('click', () => openAppModal('inspection', item));
  document.getElementById('deleteBtn').addEventListener('click', async () => {
    if (!confirm('이 점검 기록을 삭제하시겠습니까?')) return;
    try {
      await api(`/inspections/${id}`, { method: 'DELETE' });
      toast('삭제되었습니다.');
      location.hash = '#/inspections';
    } catch (e) { toast(e.message, true); }
  });
}

function buildInspectionFormHTML(prefix) {
  return `
    <form id="${prefix}Form">
      <div class="form-row">
        <div class="form-group">
          <label>지사</label>
          <select id="${prefix}_branch" required>
            <option value="">선택</option>
            ${state.branches.map(b => `<option value="${esc(b.name)}">${esc(b.name)}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>영업소</label>
          <div id="${prefix}_officeWrap"></div>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>점검일자</label>
          <input type="date" id="${prefix}_date" required>
        </div>
        <div class="form-group">
          <label>점검자</label>
          <input type="text" id="${prefix}_inspector" placeholder="점검자 이름" required>
        </div>
      </div>
      <div class="form-group">
        <label>점검 항목</label>
        <div id="${prefix}_checklist"></div>
      </div>
      <div class="form-group">
        <label>종합의견 / 특이사항</label>
        <textarea id="${prefix}_note" placeholder="선택 입력"></textarea>
      </div>
      <button class="btn btn-primary btn-block" type="submit">등록하기</button>
    </form>
  `;
}
function bindInspectionForm(prefix, editingItem, onDone) {
  const form = document.getElementById(`${prefix}Form`);
  const branchSel = document.getElementById(`${prefix}_branch`);
  const officeWrap = document.getElementById(`${prefix}_officeWrap`);
  const checklistWrap = document.getElementById(`${prefix}_checklist`);
  const submitBtn = form.querySelector('button[type=submit]');
  submitBtn.textContent = editingItem ? '수정하기' : '등록하기';

  function renderOfficeField(branchName, selectedOffice) {
    const branch = state.branches.find(b => b.name === branchName);
    const offices = branch ? branch.offices : [];
    if (offices.length) {
      officeWrap.innerHTML = `<select id="${prefix}_office" required>
        <option value="">선택</option>
        ${offices.map(o => `<option value="${esc(o.name)}" ${o.name === selectedOffice ? 'selected' : ''}>${esc(o.name)}</option>`).join('')}
      </select>`;
    } else {
      officeWrap.innerHTML = `<input type="text" id="${prefix}_office" placeholder="영업소명 입력 (미등록 지사)" value="${esc(selectedOffice || '')}" required>`;
    }
  }

  const itemsState = WEEKLY_CHECKLIST_ITEMS.map(name => {
    const existing = editingItem && (editingItem.items || []).find(it => it.item === name);
    return { item: name, result: existing ? existing.result : '양호', note: existing ? existing.note : '' };
  });

  function renderChecklist() {
    checklistWrap.innerHTML = itemsState.map((it, idx) => `
      <div class="checklist-item">
        <div class="checklist-item-name">${esc(it.item)}</div>
        <div class="checklist-result">
          ${INSPECTION_RESULTS.map(r => `<button type="button" class="checklist-result-btn ${it.result === r ? 'active ' + r : ''}" data-idx="${idx}" data-result="${r}">${r}</button>`).join('')}
        </div>
        <textarea class="checklist-item-note" data-idx="${idx}" placeholder="비고 (선택)" rows="2">${esc(it.note)}</textarea>
      </div>
    `).join('');
    checklistWrap.querySelectorAll('.checklist-result-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        itemsState[btn.dataset.idx].result = btn.dataset.result;
        renderChecklist();
      });
    });
    checklistWrap.querySelectorAll('.checklist-item-note').forEach(ta => {
      ta.addEventListener('input', () => { itemsState[ta.dataset.idx].note = ta.value; });
    });
  }

  branchSel.addEventListener('change', () => renderOfficeField(branchSel.value, null));

  if (editingItem) {
    branchSel.value = editingItem.branch_name;
    document.getElementById(`${prefix}_date`).value = editingItem.inspection_date;
    document.getElementById(`${prefix}_inspector`).value = editingItem.inspector;
    document.getElementById(`${prefix}_note`).value = editingItem.overall_note || '';
  }
  renderOfficeField(editingItem ? editingItem.branch_name : '', editingItem ? editingItem.office_name : null);
  renderChecklist();

  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const payload = {
      branch_name: branchSel.value,
      office_name: document.getElementById(`${prefix}_office`).value.trim(),
      inspection_date: document.getElementById(`${prefix}_date`).value,
      inspector: document.getElementById(`${prefix}_inspector`).value.trim(),
      items: itemsState,
      overall_note: document.getElementById(`${prefix}_note`).value.trim(),
    };
    if (!payload.branch_name || !payload.office_name || !payload.inspection_date || !payload.inspector) {
      toast('모든 항목을 입력해주세요.', true); return;
    }
    submitBtn.disabled = true;
    try {
      if (editingItem) {
        await api(`/inspections/${editingItem.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        toast('수정되었습니다.');
      } else {
        await api('/inspections', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        toast('점검 기록이 등록되었습니다.');
      }
      onDone && onDone();
    } catch (e) { toast(e.message, true); }
    finally { submitBtn.disabled = false; }
  });
}

// ---------- Register / Edit form ----------
function buildFormHTML(prefix, isEditing) {
  return `
    <form id="${prefix}Form">
      <div class="form-group">
        <label>사고 일시</label>
        <input type="datetime-local" id="${prefix}_datetime" required>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>지사</label>
          <select id="${prefix}_branch" required>
            <option value="">선택</option>
            ${state.branches.map(b => `<option value="${esc(b.name)}">${esc(b.name)}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>영업소</label>
          <div id="${prefix}_officeWrap"><select required disabled><option value="">지사를 먼저 선택하세요</option></select></div>
        </div>
      </div>
      <div class="form-group">
        <label>등록자</label>
        <input type="text" id="${prefix}_reporter" placeholder="등록자 이름" required>
      </div>
      <div class="form-group">
        <label>사고 유형</label>
        <select id="${prefix}_type">
          ${ACCIDENT_TYPES.map(t => `<option value="${esc(t)}">${esc(t)}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>사고 내용</label>
        <textarea id="${prefix}_description" placeholder="사고 내용을 간략히 입력" required></textarea>
      </div>
      <div class="form-group">
        <label>사진 첨부</label>
        <div class="photo-picker" id="${prefix}_photoPicker"></div>
        <p class="photo-help">최대 10장, 사진 1장당 10MB 이하</p>
        <input type="file" id="${prefix}_photos" accept="image/*" capture="environment" multiple hidden>
      </div>
      ${isEditing ? `
      <div class="form-group">
        <label>수정자</label>
        <input type="text" id="${prefix}_updatedBy" placeholder="수정자 이름" required>
      </div>` : ''}
      <button class="btn btn-primary btn-block" type="submit">${isEditing ? '수정하기' : '등록하기'}</button>
    </form>
  `;
}
function bindForm(prefix, editingAccident, onDone) {
  const form = document.getElementById(`${prefix}Form`);
  const fileInput = document.getElementById(`${prefix}_photos`);
  const picker = document.getElementById(`${prefix}_photoPicker`);
  const branchSel = document.getElementById(`${prefix}_branch`);
  const officeWrap = document.getElementById(`${prefix}_officeWrap`);
  let removedPhotos = new Set();
  let newFiles = [];
  const maxPhotos = 10;
  const maxPhotoSize = 10 * 1024 * 1024;

  function renderOfficeField(branchName, selectedOffice) {
    const branch = state.branches.find(b => b.name === branchName);
    const offices = branch ? branch.offices : [];
    if (offices.length) {
      officeWrap.innerHTML = `<select id="${prefix}_office" required>
        <option value="">선택</option>
        ${offices.map(o => `<option value="${esc(o.name)}" ${o.name === selectedOffice ? 'selected' : ''}>${esc(o.name)}</option>`).join('')}
      </select>`;
    } else {
      officeWrap.innerHTML = `<select required disabled><option value="">지사를 먼저 선택하세요</option></select>`;
    }
  }
  branchSel.addEventListener('change', () => renderOfficeField(branchSel.value, null));

  function renderPicker() {
    const kept = editingAccident ? (editingAccident.photos || []).filter(p => !removedPhotos.has(p)) : [];
    picker.innerHTML =
      kept.map(p => `
        <div class="photo-tile">
          <img src="${esc(p)}">
          <button type="button" class="photo-tile-remove" data-kind="existing" data-key="${esc(p)}">✕</button>
        </div>`).join('') +
      newFiles.map((f, i) => `
        <div class="photo-tile">
          <img src="${URL.createObjectURL(f)}">
          <button type="button" class="photo-tile-remove" data-kind="new" data-key="${i}">✕</button>
        </div>`).join('') +
      `<label class="photo-add-tile" for="${prefix}_photos"><span>+</span><span class="photo-add-label">사진 추가</span></label>`;

    picker.querySelectorAll('.photo-tile-remove').forEach(btn => {
      btn.addEventListener('click', () => {
        if (btn.dataset.kind === 'existing') removedPhotos.add(btn.dataset.key);
        else newFiles.splice(parseInt(btn.dataset.key), 1);
        renderPicker();
      });
    });
  }

  fileInput.addEventListener('change', () => {
    const keptCount = editingAccident
      ? (editingAccident.photos || []).filter(p => !removedPhotos.has(p)).length
      : 0;
    const available = maxPhotos - keptCount - newFiles.length;
    const selected = Array.from(fileInput.files);
    const validFiles = selected.filter(file => {
      if (!file.type.startsWith('image/')) {
        toast('이미지 파일만 첨부할 수 있습니다.', true);
        return false;
      }
      if (file.size > maxPhotoSize) {
        toast('사진은 10MB 이하만 첨부할 수 있습니다.', true);
        return false;
      }
      return true;
    });
    if (validFiles.length > available) {
      toast(`사진은 최대 ${maxPhotos}장까지 첨부할 수 있습니다.`, true);
      validFiles.splice(Math.max(available, 0));
    }
    newFiles.push(...validFiles);
    fileInput.value = '';
    renderPicker();
  });

  let initialBranch = '', initialOffice = '';
  if (editingAccident) {
    document.getElementById(`${prefix}_datetime`).value = editingAccident.datetime;
    const [guessBranch, ...rest] = (editingAccident.location || '').split(' ');
    const guessOffice = rest.join(' ');
    if (state.branches.some(b => b.name === guessBranch)) {
      initialBranch = guessBranch;
      initialOffice = guessOffice;
      branchSel.value = guessBranch;
    }
    document.getElementById(`${prefix}_reporter`).value = editingAccident.reporter || '';
    document.getElementById(`${prefix}_type`).value = editingAccident.accident_type;
    document.getElementById(`${prefix}_description`).value = editingAccident.description;
  }
  renderOfficeField(initialBranch, initialOffice);
  renderPicker();

  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const officeSel = document.getElementById(`${prefix}_office`);
    const fd = new FormData();
    fd.append('datetime', document.getElementById(`${prefix}_datetime`).value);
    fd.append('location', `${branchSel.value} ${officeSel ? officeSel.value : ''}`.trim());
    fd.append('reporter', document.getElementById(`${prefix}_reporter`).value.trim());
    fd.append('accident_type', document.getElementById(`${prefix}_type`).value);
    fd.append('description', document.getElementById(`${prefix}_description`).value.trim());
    newFiles.forEach(f => fd.append('photos', f));

    if (editingAccident) {
      (editingAccident.photos || []).forEach(p => { if (!removedPhotos.has(p)) fd.append('keep_photos', p); });
      fd.append('updated_by', document.getElementById(`${prefix}_updatedBy`).value.trim());
    }

    const submitBtn = form.querySelector('button[type=submit]');
    const defaultSubmitText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = newFiles.length ? '사진 업로드 중...' : '등록 중...';
    submitBtn.setAttribute('aria-busy', 'true');
    try {
      let savedAccident;
      if (editingAccident) {
        savedAccident = await api(`/accidents/${editingAccident.id}`, { method: 'PUT', body: fd });
        toast('수정되었습니다.');
      } else {
        savedAccident = await api('/accidents', { method: 'POST', body: fd });
        toast('보고서가 등록되었습니다.');
        form.reset();
        newFiles = [];
        renderPicker();
      }
      onDone && onDone(savedAccident);
    } catch (e) {
      toast(e.message, true);
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = defaultSubmitText;
      submitBtn.removeAttribute('aria-busy');
    }
  });
}

// ---------- App modal (사고/점검/회의록 등록·수정 공용) ----------
const $backdrop = document.getElementById('modalBackdrop');
const $appModalTitle = document.getElementById('appModalTitle');
const $modalBody = document.getElementById('appModalBody');
async function openAppModal(type, editingItem, prefill) {
  if (type === 'inspection') {
    await loadBranches();
    $appModalTitle.textContent = editingItem ? '주간 점검 수정' : '주간 점검 등록';
    $modalBody.innerHTML = buildInspectionFormHTML('modal');
    bindInspectionForm('modal', editingItem, () => { closeAppModal(); router(); });
  } else {
    await loadBranches();
    $appModalTitle.textContent = editingItem ? '사고 보고서 수정' : '사고 보고서 등록';
    $modalBody.innerHTML = buildFormHTML('modal', !!editingItem);
    bindForm('modal', editingItem, (accident) => {
      closeAppModal();
      location.hash = `#/accidents/${accident.id}`;
    });
    if (!editingItem && prefill && prefill.datetime) {
      document.getElementById('modal_datetime').value = prefill.datetime;
    }
  }
  $backdrop.classList.add('open');
}
function closeAppModal() { $backdrop.classList.remove('open'); }
function handleRegisterClick() { openAppModal(currentRegisterType, null); }
document.getElementById('openRegisterModal').addEventListener('click', handleRegisterClick);
document.getElementById('closeAppModal').addEventListener('click', closeAppModal);
$backdrop.addEventListener('click', (e) => { if (e.target === $backdrop) closeAppModal(); });

// ---------- 드릴다운 모달 (사고분석 차트 클릭 시 해당 사고 목록) ----------
const $drilldownBackdrop = document.getElementById('drilldownBackdrop');
const $drilldownTitle = document.getElementById('drilldownTitle');
const $drilldownBody = document.getElementById('drilldownBody');
function openDrilldown(title, accidents) {
  $drilldownTitle.textContent = title;
  $drilldownBody.innerHTML = accidents.length
    ? accidents.map(kanbanCardHTML).join('')
    : '<div class="empty-state">해당 사고가 없습니다.</div>';
  $drilldownBody.querySelectorAll('.kanban-card').forEach(card => {
    card.addEventListener('click', (ev) => {
      if (ev.target.closest('.kanban-card-link')) return;
      closeDrilldown();
      location.hash = `#/actions/${card.dataset.goto}`;
    });
  });
  $drilldownBody.querySelectorAll('.kanban-card-link').forEach(btn => {
    btn.addEventListener('click', (ev) => {
      ev.stopPropagation();
      closeDrilldown();
      location.hash = `#/accidents/${btn.dataset.view}`;
    });
  });
  $drilldownBackdrop.classList.add('open');
}
function closeDrilldown() { $drilldownBackdrop.classList.remove('open'); }
document.getElementById('closeDrilldown').addEventListener('click', closeDrilldown);
$drilldownBackdrop.addEventListener('click', (e) => { if (e.target === $drilldownBackdrop) closeDrilldown(); });
enableSwipeToClose(document.getElementById('drilldownModal'), closeDrilldown);

// ---------- 모바일 하단 탭 (홈 / 사고보고 / 안전보건) ----------
document.querySelectorAll('.bottom-nav-item[data-tab]').forEach(btn => {
  btn.addEventListener('click', () => { location.hash = TAB_DEFAULT_ROUTE[btn.dataset.tab]; });
});

// 모달 아래로 스와이프해서 닫기
function enableSwipeToClose(modalEl, closeFn) {
  const handle = modalEl.querySelector('.modal-drag-handle');
  let startY = 0, dy = 0, dragging = false;
  handle.addEventListener('touchstart', (e) => {
    dragging = true; startY = e.touches[0].clientY; modalEl.style.transition = 'none';
  }, { passive: true });
  handle.addEventListener('touchmove', (e) => {
    if (!dragging) return;
    dy = Math.max(0, e.touches[0].clientY - startY);
    modalEl.style.transform = `translateY(${dy}px)`;
  }, { passive: true });
  handle.addEventListener('touchend', () => {
    dragging = false;
    modalEl.style.transition = '';
    if (dy > 90) closeFn();
    modalEl.style.transform = '';
    dy = 0;
  });
}
enableSwipeToClose(document.getElementById('appModal'), closeAppModal);

// ---------- Lightbox ----------
const lightboxEl = document.createElement('div');
lightboxEl.className = 'lightbox';
lightboxEl.id = 'lightbox';
lightboxEl.innerHTML = '<img id="lightboxImg" src="">';
document.body.appendChild(lightboxEl);
function openLightbox(src) {
  document.getElementById('lightboxImg').src = src;
  lightboxEl.classList.add('open');
}
lightboxEl.addEventListener('click', () => lightboxEl.classList.remove('open'));

// 라이트박스 아래/위로 스와이프해서 닫기
(function enableLightboxSwipeToClose() {
  const img = document.getElementById('lightboxImg');
  let startY = 0, dy = 0, dragging = false;
  lightboxEl.addEventListener('touchstart', (e) => {
    dragging = true; startY = e.touches[0].clientY; img.style.transition = 'none';
  }, { passive: true });
  lightboxEl.addEventListener('touchmove', (e) => {
    if (!dragging) return;
    dy = e.touches[0].clientY - startY;
    img.style.transform = `translateY(${dy}px)`;
    lightboxEl.style.background = `rgba(0,0,0,${Math.max(.85 - Math.abs(dy) / 400, .2)})`;
  }, { passive: true });
  lightboxEl.addEventListener('touchend', () => {
    dragging = false;
    img.style.transition = '';
    if (Math.abs(dy) > 100) lightboxEl.classList.remove('open');
    img.style.transform = '';
    lightboxEl.style.background = '';
    dy = 0;
  });
})();

// ---------- SSE live updates ----------
function connectSSE() {
  const es = new EventSource(`${API_BASE_URL}/events`);
  es.onmessage = (ev) => {
    let data;
    try { data = JSON.parse(ev.data); } catch (e) { return; }
    if (data.type === 'connected') return;
    if (data.type === 'new_accident') notifyNewAccident(data.accident);
    router();
  };
  es.onerror = () => { es.close(); setTimeout(connectSSE, 3000); };
}

// ---------- init ----------
async function initializeApp() {
  try {
    await api('/auth/me');
    hideLogin();
    updateNotificationButton();
    await router();
    connectSSE();
    loadApprovalRequests();
  } catch (e) {
    showLogin();
  }
}
initializeApp();

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(() => {});
}
