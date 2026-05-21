const AGENT_LEVELS = [
  {lv:1,req:0},{lv:2,req:100},{lv:3,req:300},{lv:4,req:500},
  {lv:5,req:800},{lv:6,req:1000},{lv:7,req:10000},{lv:8,req:30000},
  {lv:9,req:50000},{lv:10,req:80000},{lv:11,req:100000},{lv:12,req:1000000},
  {lv:13,req:3000000},{lv:14,req:5000000},{lv:15,req:8000000},
  {lv:16,req:10000000},{lv:17,req:100000000},{lv:18,req:300000000},
  {lv:19,req:500000000},{lv:20,req:800000000},
];

function getLevelColor(lv) {
  if (lv <= 2)  return { a: '#CD7F32', b: '#8B4513' };
  if (lv <= 4)  return { a: '#A8A9AD', b: '#606060' };
  if (lv <= 6)  return { a: '#FFD700', b: '#B8860B' };
  if (lv <= 8)  return { a: '#4169E1', b: '#1E3A8A' };
  if (lv <= 10) return { a: '#A855F7', b: '#6B21A8' };
  if (lv <= 14) return { a: '#F97316', b: '#C2410C' };
  if (lv <= 16) return { a: '#06B6D4', b: '#0E7490' };
  if (lv <= 18) return { a: '#C084FC', b: '#7E22CE' };
  return { a: '#EF4444', b: '#991B1B' };
}

// ============================================================
// LEVEL MODAL
// ============================================================
function buildLevelModal() {
  const body   = document.getElementById('levelModalBody');
  const userLv = parseInt(document.getElementById('userLevelNum')?.textContent) || 1;

  body.innerHTML = AGENT_LEVELS.map(({ lv, req }) => {
    const { a, b } = getLevelColor(lv);
    const isCurrent = lv === userLv;
    const svg = `<svg width="36" height="36" viewBox="0 0 36 36">
      <defs><linearGradient id="lg${lv}" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${a}"/><stop offset="100%" stop-color="${b}"/>
      </linearGradient></defs>
      <polygon points="18,2 32,10 32,26 18,34 4,26 4,10" fill="url(#lg${lv})" opacity=".25" stroke="${a}" stroke-width="1.5"/>
      <polygon points="18,6 28,12 28,24 18,30 8,24 8,12" fill="url(#lg${lv})" opacity=".6"/>
      <text x="18" y="22" text-anchor="middle" fill="white" font-size="${lv >= 10 ? 9 : 11}" font-weight="900" font-family="sans-serif">${lv}</text>
    </svg>`;
    return `<div class="level-row${isCurrent ? ' current-level' : ''}">
      <div class="level-badge-icon">${svg}</div>
      <div class="level-row-name" style="color:${isCurrent ? 'var(--accent)' : '#fff'}">LV${lv}${isCurrent ? ' ✓' : ''}</div>
      <div class="level-row-req" style="color:${a}">${req === 0 ? '0.00' : req.toLocaleString() + '.00'}</div>
    </div>`;
  }).join('');
}

function initLevelModal() {
  document.getElementById('levelBtn')?.addEventListener('click', () => {
    buildLevelModal();
    document.getElementById('levelModal').classList.add('show');
  });
  document.getElementById('levelModalClose')?.addEventListener('click', () => {
    document.getElementById('levelModal').classList.remove('show');
  });
  document.getElementById('levelModal')?.addEventListener('click', e => {
    if (e.target === document.getElementById('levelModal'))
      document.getElementById('levelModal').classList.remove('show');
  });
}

// ============================================================
// DASHBOARD STATS
// ============================================================
async function loadDashboardStats(userId) {
  const { data, error } = await window.DB
    .from('agent_dashboard_stats')
    .select('today_commission,direct_members,received,bonus,yesterday_commission,salary')
    .eq('agent_id', userId)
    .eq('period', 'today')
    .single();

  if (error || !data) return;
  setEl('statCommission',  fmt(data.today_commission));
  setEl('statInvited',     data.direct_members ?? 0);
  setEl('walletReceived',  fmt(data.received));
  setEl('walletBonus',     fmt(data.bonus));
  setEl('walletYesterday', fmt(data.yesterday_commission));
  setEl('walletSalary',    fmt(data.salary));

  const ticker = document.getElementById('agentTickerText');
  if (ticker) {
    const t = ` ›  Agent ကော်မရှင်: ${fmt(data.today_commission)}    ›  Diamond-BETT Affiliate    `;
    ticker.innerHTML = t + t;
  }
}

// ============================================================
// MY DATA TAB
// ============================================================
async function loadMyData(agentId, period = 'today') {
  const loading = document.getElementById('mdLoading');
  if (loading) loading.style.display = 'flex';

  const { data, error } = await window.DB
    .from('agent_dashboard_stats')
    .select('*')
    .eq('agent_id', agentId)
    .eq('period', period)
    .single();

  if (loading) loading.style.display = 'none';
  if (error || !data) return;

  const map = {
    'md-total-commission'   : fmt(data.total_commission),
    'md-direct-bet'         : fmt(data.direct_bet_amount),
    'md-sub-bet'            : fmt(data.sub_bet_amount),
    'md-total-members'      : data.total_members   ?? 0,
    'md-direct-members'     : data.direct_members  ?? 0,
    'md-sub-members'        : data.sub_members     ?? 0,
    'md-direct-performance' : fmt(data.direct_performance),
    'md-sub-performance'    : fmt(data.sub_performance),
    'md-total-performance'  : fmt(data.total_performance),
    'md-direct-savings'     : fmt(data.direct_savings),
    'md-direct-withdraw'    : fmt(data.direct_withdraw_savings),
    'md-direct-total-savings': fmt(data.direct_total_savings),
    'md-effective-bets'     : fmt(data.effective_bets),
    'md-level-savings'      : fmt(data.level_savings),
    'md-direct-commission'  : fmt(data.direct_commission),
    'md-sub-commission'     : fmt(data.sub_commission),
    'md-total-commission2'  : fmt(data.total_commission),
    'md-bonus'              : fmt(data.bonus),
    'md-received'           : fmt(data.received),
    'md-salary'             : fmt(data.salary),
    'md-promo-savings'      : fmt(data.promotion_savings),
    'md-achievement-savings': fmt(data.achievement_savings),
    'md-direct-income-commission': fmt(data.direct_commission),
    'md-sub-income-commission'   : fmt(data.sub_commission),
    'md-total-income-commission' : fmt(data.total_commission),
  };
  Object.entries(map).forEach(([id, val]) => setEl(id, val));
}

// ============================================================
// DOWNLINE
// ============================================================
function initDownline() {
  const dlBackdrop  = document.getElementById('dlBackdrop');
  const dlDateModal = document.getElementById('dlDateModal');
  const openDl  = () => { dlBackdrop.classList.add('show');  dlDateModal.classList.add('show');  };
  const closeDl = () => { dlBackdrop.classList.remove('show'); dlDateModal.classList.remove('show'); };
  const closeRole = () => { document.getElementById('dlRoleDropdown').style.display = 'none'; };

  document.getElementById('dlDateBtn')?.addEventListener('click', openDl);
  document.getElementById('dlDateCancel')?.addEventListener('click', closeDl);
  dlBackdrop?.addEventListener('click', () => { closeDl(); closeRole(); });

  document.getElementById('dlDateConfirm')?.addEventListener('click', () => {
    const ap = dlDateModal.querySelector('.dl-period-btn.active');
    if (ap) setEl('dlDateLabel', ap.textContent);
    closeDl(); loadDownline();
  });

  dlDateModal?.querySelectorAll('.dl-period-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      dlDateModal.querySelectorAll('.dl-period-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  // Populate date selects
  const now = new Date(), y = now.getFullYear(), m = now.getMonth() + 1, d = now.getDate();
  ['dlStartYear', 'dlEndYear'].forEach(id => {
    const s = document.getElementById(id);
    for (let yr = y - 2; yr <= y; yr++) {
      const o = document.createElement('option');
      o.value = yr; o.textContent = yr; if (yr === y) o.selected = true;
      s?.appendChild(o);
    }
  });
  ['dlStartMonth', 'dlEndMonth'].forEach(id => {
    const s = document.getElementById(id);
    for (let mo = 1; mo <= 12; mo++) {
      const o = document.createElement('option');
      o.value = String(mo).padStart(2, '0'); o.textContent = o.value; if (mo === m) o.selected = true;
      s?.appendChild(o);
    }
  });
  ['dlStartDay', 'dlEndDay'].forEach(id => {
    const s = document.getElementById(id);
    for (let dy = 1; dy <= 31; dy++) {
      const o = document.createElement('option');
      o.value = String(dy).padStart(2, '0'); o.textContent = o.value; if (dy === d) o.selected = true;
      s?.appendChild(o);
    }
  });

  document.getElementById('dlRoleBtn')?.addEventListener('click', e => {
    e.stopPropagation();
    const dd = document.getElementById('dlRoleDropdown');
    dd.style.display = dd.style.display === 'block' ? 'none' : 'block';
  });
  document.getElementById('dlRoleDropdown')?.querySelectorAll('.dl-role-option').forEach(opt => {
    opt.addEventListener('click', () => {
      document.getElementById('dlRoleDropdown').querySelectorAll('.dl-role-option')
        .forEach(o => o.classList.remove('active'));
      opt.classList.add('active');
      const t = opt.textContent;
      setEl('dlRoleLabel', t.length > 8 ? t.substring(0, 8) + '…' : t);
      closeRole(); loadDownline();
    });
  });
  document.addEventListener('click', () => closeRole());

  document.getElementById('dlSearchToggle')?.addEventListener('click', () => {
    const bar = document.getElementById('dlSearchBar');
    bar.style.display = bar.style.display === 'block' ? 'none' : 'block';
    if (bar.style.display === 'block') document.getElementById('dlSearchInput')?.focus();
  });
  document.getElementById('dlSearchSubmit')?.addEventListener('click', () =>
    loadDownline(document.getElementById('dlSearchInput').value.trim()));
}

async function loadDownline(searchId = '') {
  if (!window.currentAgentId) return;
  const { data, error } = await window.DB.rpc('get_agent_subordinates', { p_agent_id: window.currentAgentId });

  const empty     = document.getElementById('dlEmpty');
  const tableWrap = document.getElementById('dlTableWrap');
  const tbody     = document.getElementById('dlTableBody');

  if (error || !data?.length) { empty.style.display = 'flex'; tableWrap.style.display = 'none'; return; }

  let rows = data;
  if (searchId) rows = rows.filter(r =>
    String(r.id || '').includes(searchId) || String(r.phone || '').includes(searchId));

  if (!rows.length) { empty.style.display = 'flex'; tableWrap.style.display = 'none'; return; }

  empty.style.display = 'none'; tableWrap.style.display = 'block';
  tbody.innerHTML = rows.map(r => `<tr>
    <td>${r.phone || r.id || '—'}</td>
    <td><span class="dl-level-badge">Lv ${r.level || 1}</span></td>
    <td style="font-size:10px;">${r.joined_at ? new Date(r.joined_at).toLocaleDateString('en-GB') : '—'}</td>
    <td>${fmt(r.bet_amount)}</td>
    <td>${fmt(r.deposit_amount)}</td>
  </tr>`).join('');
}

// ============================================================
// AGENT TAB + COMMISSION COUNTDOWN
// ============================================================
function initAgentTabs() {
  document.getElementById('agentTabBar')?.addEventListener('click', e => {
    const btn = e.target.closest('.atab');
    if (!btn) return;
    document.querySelectorAll('.atab').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.atab-content').forEach(c => c.classList.remove('active'));
    btn.classList.add('active');
    const target = document.getElementById('atab-' + btn.dataset.atab);
    if (target) target.classList.add('active');

    if (btn.dataset.atab === 'mydata' && window.currentAgentId) {
      const p = document.querySelector('.time-pill.active')?.dataset.period || 'today';
      loadMyData(window.currentAgentId, p);
    }
    if (btn.dataset.atab === 'downline' && window.currentAgentId) loadDownline();
  });

  document.getElementById('timePills')?.addEventListener('click', e => {
    const pill = e.target.closest('.time-pill');
    if (!pill || !window.currentAgentId) return;
    document.querySelectorAll('.time-pill').forEach(p => p.classList.remove('active'));
    pill.classList.add('active');
    loadMyData(window.currentAgentId, pill.dataset.period);
  });
}

function startCommissionCountdown() {
  const el = document.getElementById('commissionCountdown');
  if (!el) return;
  const tick = () => {
    const now = new Date(), next = new Date(); next.setHours(24, 0, 0, 0);
    const d = next - now;
    const h = String(Math.floor(d / 3600000)).padStart(2, '0');
    const m = String(Math.floor((d % 3600000) / 60000)).padStart(2, '0');
    const s = String(Math.floor((d % 60000) / 1000)).padStart(2, '0');
    el.textContent = `(နောက်ခြေချချိန်: ${h}:${m}:${s})`;
  };
  tick(); setInterval(tick, 1000);
}

function generateAgentQR(link) {
  const container = document.getElementById('agentQRCode');
  if (!container || !link) return;
  container.innerHTML = '';
  new QRCode(container, {
    text: link,
    width: 128,
    height: 128,
    colorDark: "#000000",
    colorLight: "#ffffff",
    correctLevel: QRCode.CorrectLevel.H
  });
}

// Hook into link setting logic if exists, or add to loadDashboardStats
// Looking at agent.html, agentShareLinkInput is where the link goes.
// We should update generateAgentQR when that link is set.
const originalSetEl = window.setEl;
window.setEl = function(id, val) {
  if (originalSetEl) originalSetEl(id, val);
  if (id === 'agentShareLinkInput' && val && val !== 'Link loading...') {
    generateAgentQR(val);
  }
};
