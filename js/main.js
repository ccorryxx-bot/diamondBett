// ============================================================
// HTML PARTIALS LOADER
// ============================================================
async function loadPartials() {
  const partials = [
    { src: 'html/home.html',   id: 'homePage'        },
    { src: 'html/tasks.html',  id: 'tasksPage'       },
    { src: 'html/agent.html',  id: 'agentPage'       },
    { src: 'html/modals.html', id: 'modalsContainer' },
  ];

  await Promise.all(partials.map(async ({ src, id }) => {
    try {
      const res  = await fetch(src);
      if (!res.ok) throw new Error(`${src} — ${res.status}`);
      const html = await res.text();
      const el   = document.getElementById(id);
      if (el) el.innerHTML = html;
    } catch (e) {
      console.error('Partial load failed:', e);
    }
  }));
}

// ============================================================
// DOM READY
// ============================================================
document.addEventListener('DOMContentLoaded', async () => {

  // 1. Init Supabase (CDN already loaded — script is deferred)
  window.DB = window.supabase.createClient(SUPA_URL, SUPA_KEY);

  // 2. Load HTML partials first
  await loadPartials();

  // 3. Init all modules (DOM elements now exist)
  initBanner();
  initLangBtn();
  initCatItems();
  initLevelModal();
  initAgentTabs();
  initDownline();
  initWheel();
  startDailyTimer();
  startCommissionCountdown();
  loadGamesFromDB();

  // 4. Initial page
  showPage('home');
  document.querySelector('.bnav-btn[data-nav="home"]')?.classList.add('active');

  // ============================================================
  // EVENT LISTENERS
  // ============================================================

  // Bottom nav
  document.querySelectorAll('.bnav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.bnav-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      showPage(btn.dataset.nav);
    });
  });

  // Auth modal
  const modal = document.getElementById('authModal');
  document.getElementById('showAuthBtn')?.addEventListener('click',  () => openAuthModal('login'));
  document.getElementById('agentLoginBtn')?.addEventListener('click', () => openAuthModal('login'));
  document.getElementById('modalCloseBtn')?.addEventListener('click', () => modal?.classList.remove('active'));
  modal?.addEventListener('click', e => { if (e.target === modal) modal.classList.remove('active'); });
  document.getElementById('registerBtn')?.addEventListener('click', registerUser);
  document.getElementById('loginBtn')?.addEventListener('click',    loginUser);

  // Deposit / Withdraw buttons
  document.querySelectorAll('.wallet-btn.deposit').forEach(b =>
    b.addEventListener('click', openDepositModal));
  document.querySelectorAll('.wallet-btn.withdraw').forEach(b =>
    b.addEventListener('click', openWithdrawModal));

  document.getElementById('depCloseBtn')?.addEventListener('click', () => {
    clearInterval(window._cdTimer);
    document.getElementById('depositModal')?.classList.remove('open');
  });
  document.getElementById('wdCloseBtn')?.addEventListener('click', () => {
    document.getElementById('withdrawModal')?.classList.remove('open');
  });

  // Bonus code
  document.getElementById('bonusCodeBtn')?.addEventListener('click', handleBonusCode);

  // Share / Copy
  document.getElementById('agentCopyLinkBtn')?.addEventListener('click', copyAgentLink);
  document.getElementById('shareNativeBtn')?.addEventListener('click', async () => {
    const link = document.getElementById('agentShareLinkInput')?.value;
    if (!link || link === '—') return;
    navigator.share ? await navigator.share({ title: 'Diamond-BETT', url: link }) : copyAgentLink();
  });
  document.getElementById('shareNative2')?.addEventListener('click', async () => {
    const link = document.getElementById('inv-link')?.value;
    if (!link || link === '—') return;
    navigator.share
      ? await navigator.share({ title: 'Diamond-BETT', url: link })
      : navigator.clipboard.writeText(link).then(() => gToast('Link ကူးပြီးပါပြီ', 'success'));
  });
  document.getElementById('copyPhoneBtn')?.addEventListener('click', () => {
    const txt = document.getElementById('agentPhoneDisplay')?.textContent;
    if (txt) navigator.clipboard.writeText(txt).then(() => gToast('ကူးပြီးပါပြီ', 'success'));
  });

  // Turnover modal close
  document.querySelector('#tvModal .tv-close-btn')?.addEventListener('click', () => {
    document.getElementById('tvModal')?.classList.remove('open');
  });

  // URL ref param
  const ref = new URLSearchParams(window.location.search).get('ref');
  if (ref) {
    const ri = document.getElementById('referrer_code_input');
    if (ri) { ri.value = ref; ri.readOnly = true; }
    openAuthModal('register');
  }

});
