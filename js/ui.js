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
  const inp = document.getElementById(id);
  inp.type = inp.type === 'password' ? 'text' : 'password';
  btn.style.color = inp.type === 'text' ? '#f5c518' : 'rgba(255,255,255,.5)';
}

// ============================================================
// PAGE NAVIGATION
// ============================================================
function showPage(nav) {
  document.querySelectorAll('.page-panel').forEach(p => p.classList.remove('active'));
  document.getElementById('topArea').style.display = '';

  const pages = { home: 'homePage', tasks: 'tasksPage', agent: 'agentPage', cs: 'csPage', account: 'accountPage' };
  if (pages[nav]) document.getElementById(pages[nav]).classList.add('active');

  if (nav === 'tasks') {
    document.getElementById('topArea').style.display = 'none';
    if (window.currentUserId && window.availableSpins > 0)
      document.getElementById('spinBtn').disabled = false;
  }
  if (nav === 'agent') {
    document.getElementById('topArea').style.display = 'none';
  }
}

// ============================================================
// BANNER
// ============================================================
function initBanner() {
  let cur = 0, tmr = null;
  const track = document.getElementById('bannerTrack');
  const dots  = document.querySelectorAll('#bannerDots .dot');
  const wrap  = document.getElementById('bannerWrap');
  if (!track) return;

  const update = () => {
    track.style.transform = `translateX(-${cur * 100}%)`;
    dots.forEach((d, i) => d.classList.toggle('active', i === cur));
  };
  const go    = n => { cur = ((n % 3) + 3) % 3; update(); };
  const start = () => { clearInterval(tmr); tmr = setInterval(() => go(cur + 1), 4000); };

  dots.forEach(d => d.addEventListener('click', () => { go(+d.dataset.i); start(); }));
  let sx = 0;
  wrap.addEventListener('touchstart', e => { sx = e.touches[0].clientX; }, { passive: true });
  wrap.addEventListener('touchend',   e => {
    const diff = sx - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 40) go(diff > 0 ? cur + 1 : cur - 1);
    start();
  }, { passive: true });
  update(); start();
}

// ============================================================
// LANGUAGE TOGGLE
// ============================================================
function initLangBtn() {
  document.getElementById('langBtn')?.addEventListener('click', () => {
    const lbl = document.getElementById('langLabel');
    lbl.textContent = lbl.textContent === 'မြန်မာ' ? 'EN' : 'မြန်မာ';
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
    });
  });
}
