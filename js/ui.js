// ============================================================
// AUTH MODAL TABS
// ============================================================
function switchTab(tab) {
  document.getElementById('registerForm').style.display = tab === 'register' ? 'block' : 'none';
  document.getElementById('loginForm').style.display    = tab === 'login'    ? 'block' : 'none';
  document.getElementById('tabRegister').classList.toggle('active', tab === 'register');
  document.getElementById('tabLogin').classList.toggle('active',    tab === 'login');
}

function toggleEye(id, btn) {
  const inp  = document.getElementById(id);
  inp.type   = inp.type === 'password' ? 'text' : 'password';
  btn.style.color = inp.type === 'text' ? '#f5c518' : 'rgba(255,255,255,.5)';
}

// ============================================================
// PAGE NAVIGATION
// ============================================================
function showPage(nav) {
  document.querySelectorAll('.page-panel').forEach(p => p.classList.remove('active'));
  document.getElementById('topArea').style.display = '';

  const pages = {
    home   : 'homePage',
    tasks  : 'tasksPage',
    agent  : 'agentPage',
    cs     : 'csPage',
    account: 'accountPage'
  };
  if (pages[nav]) document.getElementById(pages[nav])?.classList.add('active');

  if (nav === 'tasks') document.getElementById('topArea').style.display = 'none';
  if (nav === 'agent') document.getElementById('topArea').style.display = 'none';
}

// ============================================================
// BANNER — dynamic slide count
// ============================================================
function initBanner() {
  let cur = 0, tmr = null;
  const track = document.getElementById('bannerTrack');
  const wrap  = document.getElementById('bannerWrap');
  if (!track || !wrap) return;

  const count   = () => track.querySelectorAll('.banner-slide').length;
  const getDots = () => document.querySelectorAll('#bannerDots .dot');

  const update = () => {
    const n = count(); if (!n) return;
    track.style.transform = `translateX(-${cur * 100}%)`;
    getDots().forEach((d, i) => d.classList.toggle('active', i === cur));
  };
  const go    = n => { const c = count(); if (!c) return; cur = ((n % c) + c) % c; update(); };
  const start = () => { clearInterval(tmr); tmr = setInterval(() => go(cur + 1), 4000); };
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
// CATEGORY ITEMS — filter games on click
// ============================================================
function initCatItems() {
  document.querySelectorAll('.cat-item').forEach(item => {
    item.addEventListener('click', () => {
      document.querySelectorAll('.cat-item').forEach(el => el.classList.remove('active'));
      item.classList.add('active');
      const catMap = {
        all    : 'all',
        show   : 'show',
        slot   : 'slot',
        arcade : 'arcade',
        live   : 'live',
        fish   : 'fish',
        sport  : 'sport',
        lottery: 'lottery',
      };
      filterGames(catMap[item.dataset.cat] || 'all');
    });
  });
}

// ============================================================
// BALANCE REFRESH (live)
// ============================================================
async function refreshBalance() {
  if (!window.currentUserId) return;
  const btn = document.getElementById('balRefreshBtn');
  btn?.classList.add('spinning');

  try {
    const { data, error } = await window.DB
      .from('users')
      .select('balance')
      .eq('id', window.currentUserId)
      .single();

    if (!error && data) {
      const bal = parseFloat(data.balance || 0);
      const fmt2 = bal.toLocaleString('en-US', {
        minimumFractionDigits: 2, maximumFractionDigits: 2
      });
      setEl('qnavBalance', fmt2);
      setEl('statBalance', fmt(data.balance));
      gToast('Balance refresh ပြီးပါပြီ', 'success');
    }
  } catch (e) {
    console.error('Balance refresh error:', e);
    gToast('Balance refresh မရပါ', 'error');
  } finally {
    btn?.classList.remove('spinning');
  }
}

// ============================================================
// INIT BALANCE REFRESH BUTTON
// ============================================================
function initBalRefresh() {
  document.getElementById('balRefreshBtn')?.addEventListener('click', refreshBalance);
      }
