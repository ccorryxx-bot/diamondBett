function switchTab(tab) {
  document.getElementById('registerForm').style.display = tab === 'register' ? 'block' : 'none';
  document.getElementById('loginForm').style.display    = tab === 'login'    ? 'block' : 'none';
  document.getElementById('tabRegister').classList.toggle('active', tab === 'register');
  document.getElementById('tabLogin').classList.toggle('active',    tab === 'login');
}

function toggleEye(id, btn) {
  const inp = document.getElementById(id);
  inp.type  = inp.type === 'password' ? 'text' : 'password';
  btn.style.color = inp.type === 'text' ? '#f5c518' : 'rgba(255,255,255,.4)';
}

// ============================================================
// PAGE NAVIGATION — scroll snap
// ============================================================
const PAGE_ORDER = ['home', 'tasks', 'agent', 'cs', 'account'];
const PAGE_MAP   = { home:'homePage', tasks:'tasksPage', agent:'agentPage', cs:'csPage', account:'accountPage' };

function showPage(nav) {
  const main   = document.getElementById('mainContent');
  const target = document.getElementById(PAGE_MAP[nav]);
  if (!main || !target) return;

  // Smooth scroll to page panel
  main.scrollTo({ top: target.offsetTop, behavior: 'smooth' });

  // topArea visibility
  const hideTop = ['tasks', 'agent'];
  const topArea = document.getElementById('topArea');
  if (topArea) topArea.style.display = hideTop.includes(nav) ? 'none' : '';

  // Update nav active state
  document.querySelectorAll('.bnav-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.nav === nav));
}

// ============================================================
// INTERSECTION OBSERVER — sync nav with scroll
// ============================================================
function initScrollObserver() {
  const main = document.getElementById('mainContent');
  if (!main) return;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
        const nav = Object.keys(PAGE_MAP).find(k => PAGE_MAP[k] === entry.target.id);
        if (!nav) return;
        document.querySelectorAll('.bnav-btn').forEach(b =>
          b.classList.toggle('active', b.dataset.nav === nav));
        const topArea = document.getElementById('topArea');
        if (topArea) topArea.style.display = ['tasks','agent'].includes(nav) ? 'none' : '';
      }
    });
  }, { root: main, threshold: 0.5 });

  Object.values(PAGE_MAP).forEach(id => {
    const el = document.getElementById(id);
    if (el) observer.observe(el);
  });
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

// ============================================================
// LANGUAGE TOGGLE
// ============================================================
function initLangBtn() {
  document.getElementById('langBtn')?.addEventListener('click', () => {
    const lbl = document.getElementById('langLabel');
    if (lbl) lbl.textContent = lbl.textContent === 'မြန်မာ' ? 'EN' : 'မြန်မာ';
  });
}

// ============================================================
// CATEGORY ITEMS
// ============================================================
function initCatItems() {
  document.querySelectorAll('.cat-item').forEach(item => {
    item.addEventListener('click', () => {
      document.querySelectorAll('.cat-item').forEach(el => el.classList.remove('active'));
      item.classList.add('active');
      const catMap = { all:'all', show:'show', slot:'slot', arcade:'arcade', live:'live', fish:'fish', sport:'sport', lottery:'lottery' };
      filterGames(catMap[item.dataset.cat] || 'all');
    });
  });
}

// ============================================================
// BALANCE REFRESH
// ============================================================
async function refreshBalance() {
  if (!window.currentUserId) return;
  const btn = document.getElementById('balRefreshBtn');
  btn?.classList.add('spinning');
  try {
    const { data } = await window.DB.from('users').select('balance').eq('id', window.currentUserId).single();
    if (data) {
      const bal  = parseFloat(data.balance || 0);
      const fmt2 = bal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      setEl('qnavBalance', fmt2);
      setEl('statBalance', fmt(data.balance));
    }
  } catch (e) { console.error('Balance refresh:', e); }
  finally { btn?.classList.remove('spinning'); }
}

function initBalRefresh() {
  document.getElementById('balRefreshBtn')?.addEventListener('click', refreshBalance);
                                                                         }
