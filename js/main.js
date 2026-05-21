async function loadPartials() {
  const partials = [
    { src: 'html/home.html',   id: 'homeContent'     },
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

document.addEventListener('DOMContentLoaded', async () => {
  if (window.supabase) {
    window.DB = window.supabase.createClient(SUPA_URL, SUPA_KEY);
  }

  await loadPartials();

  // Bind Auth Events (Loaded via Modals Partial)
  document.getElementById('modalCloseBtn')?.addEventListener('click', () => {
    document.getElementById('authModal')?.classList.remove('active');
  });

  // Close Deposit Modal
  document.getElementById('depCloseBtn')?.addEventListener('click', () => {
    document.getElementById('depositModal')?.classList.remove('open');
  });

  // Close Withdraw Modal
  document.getElementById('wdCloseBtn')?.addEventListener('click', () => {
    document.getElementById('withdrawModal')?.classList.remove('open');
  });
  document.getElementById('loginBtn')?.addEventListener('click', loginUser);
  document.getElementById('registerBtn')?.addEventListener('click', registerUser);

  initBanner();
  initBalRefresh();
  initLangBtn();
  initCatItems();
  initLevelModal();
  initAgentTabs();
  initDownline();
  initWheel();
  startDailyTimer();
  startCommissionCountdown();

  if (window.DB) {
    window.DB.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session?.user?.id) {
        window.currentUserId = session.user.id;
        const showBtn = document.getElementById('showAuthBtn');
        const wdBtns = document.getElementById('walletBtns');
        const balWrap = document.getElementById('qnavBalanceWrap');
        if (showBtn) showBtn.style.display = 'none';
        if (wdBtns) wdBtns.style.display = 'flex';
        if (balWrap) balWrap.style.display = 'flex';
        refreshBalance();
      }
      if (event === 'SIGNED_OUT') {
        window.currentUserId = null;
        const showBtn = document.getElementById('showAuthBtn');
        const wdBtns = document.getElementById('walletBtns');
        const balWrap = document.getElementById('qnavBalanceWrap');
        if (showBtn) showBtn.style.display = 'block';
        if (wdBtns) wdBtns.style.display = 'none';
        if (balWrap) balWrap.style.display = 'none';
      }
    });
  }

  if (typeof loadBanners === 'function') await loadBanners();
  if (typeof loadGamesFromDB === 'function') await loadGamesFromDB();

  document.querySelectorAll('.bnav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      showPage(btn.dataset.nav);
    });
  });

  // Login Button Listener
  document.getElementById('showAuthBtn')?.addEventListener('click', () => {
    if (typeof openAuthModal === 'function') {
      openAuthModal('login');
    } else {
      console.error('openAuthModal function not found');
    }
  });

  // Deposit & Withdraw Button Listeners (Event Delegation for dynamic content)
  document.addEventListener('click', (e) => {
    const depBtn = e.target.closest('.wallet-btn.deposit');
    if (depBtn) {
      if (typeof openDepositModal === 'function') openDepositModal();
      return;
    }
    const wdBtn = e.target.closest('.wallet-btn.withdraw');
    if (wdBtn) {
      if (typeof openWithdrawModal === 'function') openWithdrawModal();
      return;
    }
  });

  // Supabase connection check
  if (!window.DB) {
    console.error('Supabase client (window.DB) failed to initialize. Check config.js and Supabase SDK.');
  }

  showPage('home');
});
