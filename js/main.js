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
      const res = await fetch(src);
      if (!res.ok) throw new Error(`${src} — ${res.status}`);
      const el = document.getElementById(id);
      if (el) el.innerHTML = await res.text();
    } catch (e) {
      console.error('Partial load failed:', e);
    }
  }));
}

// ============================================================
// DOM READY
// ============================================================
document.addEventListener('DOMContentLoaded', async () => {

  // 1. Supabase init (CDN already loaded — deferred scripts)
  window.DB = window.supabase.createClient(SUPA_URL, SUPA_KEY);

  // 2. Load HTML partials
  await loadPartials();

  // 3. SESSION RESTORE — refresh လုပ်ရင် session ပြန်ရမည်
  try {
    const { data: { session } } = await window.DB.auth.getSession();
    if (session?.user) {
      await restoreSession(session.user.id);
    }
  } catch (e) {
    console.error('getSession error:', e);
  }

  // 4. Auth state listener (FIXED: Aggressive reset မလုပ်တော့ပါ)
  window.DB.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_IN' && session?.user?.id) {
      window.currentUserId  = session.user.id;
      window.currentAgentId = session.user.id;
      sessionStorage.setItem('_db_uid', session.user.id);
    }
    
    // SIGNED_OUT — စစ်မှန်သော logout အတွက်သာ clear လုပ်မည်
    if (event === 'SIGNED_OUT') {
      window.DB.auth.getSession().then(({ data: { session: s } }) => {
        if (!s) {
          window.currentUserId  = null;
          window.currentAgentId = null;
          sessionStorage.removeItem('_db_uid');
          
          const showBtn  = document.getElementById('showAuthBtn');
          const wdBtns   = document.getElementById('walletBtns');
          const locked   = document.getElementById('agentLocked');
          const unlocked = document.getElementById('agentUnlocked');
          
          if (showBtn)  showBtn.style.display  = '';
          if (wdBtns)   wdBtns.style.display   = 'none';
          if (locked)   locked.style.display   = '';
          if (unlocked) unlocked.style.display = 'none';
        }
      });
    }
  });

  // 5. Init modules
  initBanner();
  initLangBtn();
  initCatItems();
  initLevelModal();
  initAgentTabs();
  initDownline();
  initWheel();
  startDailyTimer();
  startCommissionCountdown();

  // 6. Load dynamic data
  await loadBanners();
  await loadGamesFromDB();

  // 7. Initial page
  showPage('home');
  document.querySelector('.bnav-btn[data-nav="home"]')?.classList.add('active');

  // ============================================================
  // EVENT LISTENERS
  // ============================================================

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

  // Deposit / Withdraw
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

  // Misc
  document.getElementById('bonusCodeBtn')?.addEventListener('click', handleBonusCode);
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

  // URL ref
  const ref = new URLSearchParams(window.location.search).get('ref');
  if (ref) {
    const ri = document.getElementById('referrer_code_input');
    if (ri) { ri.value = ref; ri.readOnly = true; }
    openAuthModal('register');
  }

});
