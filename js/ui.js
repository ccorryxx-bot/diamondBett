function switchTab(tab) {
  const regForm = document.getElementById('registerForm');
  const logForm = document.getElementById('loginForm');
  if (regForm) regForm.style.display = tab === 'register' ? 'grid' : 'none';
  if (logForm) logForm.style.display = tab === 'login'    ? 'grid' : 'none';
  
  document.getElementById('tabRegister')?.classList.toggle('active', tab === 'register');
  document.getElementById('tabLogin')?.classList.toggle('active',    tab === 'login');
}

function toggleEye(id, btn) {
  const inp = document.getElementById(id);
  inp.type  = inp.type === 'password' ? 'text' : 'password';
  btn.style.color = inp.type === 'text' ? '#f5c518' : 'rgba(255,255,255,.4)';
}

// ============================================================
// PAGE NAVIGATION — SPA Style (Show/Hide)
// ============================================================
const PAGE_MAP = { 
  home: 'homePage', 
  tasks: 'tasksPage', 
  agent: 'agentPage', 
  cs: 'csPage', 
  account: 'accountPage' 
};

function showPage(nav) {
  const targetId = PAGE_MAP[nav];
  if (!targetId) return;

  // Update Panel Visibility
  Object.values(PAGE_MAP).forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.classList.toggle('active', id === targetId);
      if (id === targetId) el.scrollTop = 0;
    }
  });

  // Update Nav Active State
  document.querySelectorAll('.bnav-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.nav === nav));
}

function initScrollObserver() {
  console.log('SPA Mode: ScrollObserver disabled');
}

// ============================================================
// BANNER — dynamic count
// ============================================================
function initBanner() {
  let cur = 0, tmr = null;
  const track = document.getElementById('bannerTrack');
  const wrap  = document.getElementById('bannerWrap');
  if (!track || !wrap) return;

  const count   = () => track.querySelectorAll('.banner-slide').length;
  const getDots = () => document.querySelectorAll('#bannerDots .dot');
  const update  = () => {
    const n = count(); if (!n) return;
    track.style.transform = `translateX(-${cur * 100}%)`;
    getDots().forEach((d, i) => d.classList.toggle('active', i === cur));
  };
  const go      = n => { const c = count(); if (!c) return; cur = ((n % c) + c) % c; update(); };
  const start   = () => { clearInterval(tmr); tmr = setInterval(() => go(cur + 1), 4000); };
  const restart = () => { cur = 0; update(); start(); };

  document.getElementById('bannerDots')?.addEventListener('click', e => {
    const dot = e.target.closest('.dot');
    if (dot) { go(+dot.dataset.i); start(); }
  });
  let sx = 0;
  wrap.addEventListener('touchstart', e => { sx = e.touches[0].clientX; }, { passive: true });
  wrap.addEventListener('touchend',   e => {
    const diff = sx - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 40) go(diff > 0 ? cur + 1 : cur - 1);
    start();
  }, { passive: true });

  update(); start();
  window._restartBanner = restart;
}

function initLangBtn() {
  document.getElementById('langBtn')?.addEventListener('click', () => {
    const lbl = document.getElementById('langLabel');
    if (lbl) lbl.textContent = lbl.textContent === 'မြန်မာ' ? 'EN' : 'မြန်မာ';
  });
}

function initCatItems() {
  document.querySelectorAll('.cat-item').forEach(item => {
    item.addEventListener('click', () => {
      document.querySelectorAll('.cat-item').forEach(el => el.classList.remove('active'));
      item.classList.add('active');
      const catMap = { all:'all', show:'show', slot:'slot', arcade:'arcade', live:'live', fish:'fish', sport:'sport', lottery:'lottery' };
      if (typeof filterGames === 'function') filterGames(catMap[item.dataset.cat] || 'all');
    });
  });
}

async function refreshBalance() {
  if (!window.currentUserId) return;
  const btn = document.getElementById('balRefreshBtn');
  btn?.classList.add('spinning');
  try {
    const { data } = await window.DB.from('users').select('balance').eq('id', window.currentUserId).single();
    if (data) {
      const bal  = parseFloat(data.balance || 0);
      const fmt2 = bal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      const qnavBal = document.getElementById('qnavBalance');
      if (qnavBal) qnavBal.textContent = fmt2;
    }
  } catch (e) { console.error('Balance refresh:', e); }
  finally { btn?.classList.remove('spinning'); }
}

function initBalRefresh() {
  document.querySelectorAll('#balRefreshBtn').forEach(btn => {
    btn.addEventListener('click', refreshBalance);
  });
}
