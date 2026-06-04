async function loadPartials() {
  const partials = [
    { src: 'html/home.html',    id: 'homeContent'     },
    { src: 'html/tasks.html',   id: 'tasksPage'       },
    { src: 'html/agent.html',   id: 'agentPage'       },
    { src: 'html/modals.html',  id: 'modalsContainer' },
    { src: 'html/account.html', id: 'accountPage'     },
    { src: 'html/admin.html',   id: 'adminPage'       },
    { src: 'html/cs.html',     id: 'csPage'          },
  ];
  await Promise.all(partials.map(async ({ src, id }) => {
    try {
      const res = await fetch(src);
      if (!res.ok) throw new Error(`${src} — ${res.status}`);
      const el = document.getElementById(id);
      if (el) {
        el.innerHTML = await res.text();
        el.querySelectorAll('script').forEach(oldScript => {
          const newScript = document.createElement('script');
          [...oldScript.attributes].forEach(attr =>
            newScript.setAttribute(attr.name, attr.value));
          newScript.textContent = oldScript.textContent;
          document.head.appendChild(newScript);
          oldScript.remove();
        });
      }
    } catch (e) {
      console.error('Partial load failed:', e);
    }
  }));
}

// ============================================================
// SUPABASE REALTIME — Notification subscription
// ============================================================
let _notiChannel = null;

function subscribeNotifications(userId) {
  if (!window.DB || !userId) return;
  if (_notiChannel) {
    window.DB.removeChannel(_notiChannel);
    _notiChannel = null;
  }
  _notiChannel = window.DB
    .channel('noti-' + userId)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
      (payload) => {
        const msg  = payload.new?.message || 'အသိပေးချက် ရှိသည်';
        const type = payload.new?.type    || 'normal';
        gToast(msg, type);
      }
    )
    .subscribe((status, err) => {
      if (err) console.error('Notification channel error:', err);
    });
}

function unsubscribeNotifications() {
  if (_notiChannel && window.DB) {
    window.DB.removeChannel(_notiChannel);
    _notiChannel = null;
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  if (window.supabase) {
    window.DB = window.supabase.createClient(SUPA_URL, SUPA_KEY);
  }

  await loadPartials();
  // Load payment button icons (KPay/Wave) from agent_icons table — no auth needed
  if (typeof loadPaymentActIcons === 'function') loadPaymentActIcons();
  if (typeof prefillLoginForm === 'function') prefillLoginForm();

  // Bind Auth Events
  document.getElementById('modalCloseBtn')?.addEventListener('click', () => {
    document.getElementById('authModal')?.classList.remove('active');
  });
  document.getElementById('depCloseBtn')?.addEventListener('click', () => {
    const dm = document.getElementById('depositModal');
    if (dm) { dm.classList.remove('open','full-page'); }
    document.getElementById('depStep1').style.display = 'block';
    document.getElementById('depStep2').style.display = 'none';
  });
  document.getElementById('wdCloseBtn')?.addEventListener('click', () => {
    document.getElementById('withdrawModal')?.classList.remove('open');
  });
  document.getElementById('loginBtn')?.addEventListener('click', loginUser);
  document.getElementById('registerBtn')?.addEventListener('click', registerUser);

  initBanner();
  initBalRefresh();
  initAgentOrb();
  initLangBtn();
  initCatItems();
  initLevelModal();
  initAgentTabs();
  initDownline();
  initWheel();
  startDailyTimer();
  startCommissionCountdown();

  if (window.DB) {
    // ── FIX: Explicit session check on load ──────────────────────────
    // Do NOT rely solely on onAuthStateChange for initial load.
    // getSession() synchronously returns the stored session — this
    // means auth is restored BEFORE games load, so tapping a card
    // right away won't falsely trigger the login modal.
    let _sessionRestored = false;
    try {
      const { data: { session } } = await window.DB.auth.getSession();
      if (session?.user?.id) {
        if (localStorage.getItem('_db_logout') !== '1') {
          _sessionRestored = true;
          window.currentUserId = session.user.id;
          if (typeof restoreSession === 'function') {
            await restoreSession(session.user.id);
          }
          subscribeNotifications(session.user.id);
          if (typeof setupUserRealtime === 'function') setupUserRealtime(session.user.id);
        }
      }
    } catch (e) {
      console.error('getSession error:', e);
    }

    // ── Listen for future auth changes (token refresh, logout, etc.) ─
    // _initDone prevents SIGNED_OUT showing modal during the initial
    // token-refresh race that can fire before SIGNED_IN.
    let _initDone = false;
    setTimeout(() => { _initDone = true; }, 2500);

    window.DB.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session?.user?.id) {
        if (localStorage.getItem('_db_logout') === '1') {
          window.DB.auth.signOut();
          return;
        }
        window.currentUserId = session.user.id;
        if (!_sessionRestored) {
          _sessionRestored = true;
          if (typeof restoreSession === 'function') restoreSession(session.user.id);
          subscribeNotifications(session.user.id);
          if (typeof setupUserRealtime === 'function') setupUserRealtime(session.user.id);
        }
      }
      if (event === 'SIGNED_OUT') {
        window.currentUserId  = null;
        window.currentIsAdmin = false;
        sessionStorage.removeItem('_db_uid');
        // Reset UI to guest state
        const showBtn  = document.getElementById('showAuthBtn');
        const wdBtns   = document.getElementById('walletBtns');
        const balWrap  = document.getElementById('qnavBalanceWrap');
        const payLogos = document.getElementById('payLogos');
        const adminBtn = document.getElementById('adminDashBtn');
        if (showBtn)  showBtn.style.display  = 'block';
        if (wdBtns)   wdBtns.style.display   = 'none';
        if (balWrap)  balWrap.style.display   = 'none';
        if (payLogos) payLogos.style.display  = 'none';
        if (adminBtn) adminBtn.style.display  = 'none';
        unsubscribeNotifications();
        if (typeof teardownUserRealtime === 'function') teardownUserRealtime();
        showPage('home');
        // Only show login modal if:
        // 1. Init is done (not a token-refresh flicker)
        // 2. No register/login flow is actively in progress (prevents modal re-open
        //    caused by SIGNED_OUT firing between signUp session and signInWithPassword)
        if (_initDone && !window._authFlowActive) {
          if (typeof prefillLoginForm === 'function') prefillLoginForm();
          if (typeof openAuthModal === 'function') openAuthModal('login');
        }
      }
    });
  }

  // Load banners and games in parallel
  const loadTasks = [];
  if (typeof loadBanners     === 'function') loadTasks.push(loadBanners());
  if (typeof loadGamesFromDB     === 'function') loadTasks.push(loadGamesFromDB());
  if (typeof loadHomePageAssets === 'function') loadTasks.push(loadHomePageAssets());
  if (loadTasks.length) Promise.all(loadTasks).catch(err => console.error('Parallel loading failed:', err));

  document.querySelectorAll('.bnav-btn').forEach(btn => {
    btn.addEventListener('click', () => showPage(btn.dataset.nav));
  });

  document.getElementById('showAuthBtn')?.addEventListener('click', () => {
    if (typeof openAuthModal === 'function') openAuthModal('login');
  });

  document.addEventListener('click', (e) => {
    if (e.target.closest('.wallet-btn.deposit'))  { if (typeof openDepositModal  === 'function') openDepositModal();  return; }
    if (e.target.closest('.wallet-btn.withdraw')) { if (typeof openWithdrawModal === 'function') openWithdrawModal(); return; }
  });

  if (!window.DB) {
    console.error('Supabase client (window.DB) failed to initialize. Check config.js and Supabase SDK.');
  }

  showPage('home');
});
