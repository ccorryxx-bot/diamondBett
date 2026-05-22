async function loadPartials() {
  const partials = [
    { src: 'html/home.html',    id: 'homeContent'     },
    { src: 'html/tasks.html',   id: 'tasksPage'       },
    { src: 'html/agent.html',   id: 'agentContent'    },
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
        // FIX: innerHTML does NOT execute <script> tags automatically.
        // Manually re-create and append each script so the browser runs it.
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

  // Remove any existing channel first to prevent duplicate subscriptions
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
        const msg = payload.new?.message || 'အသိပေးချက် ရှိသည်';
        const type = payload.new?.type || 'normal';
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
  if (typeof prefillLoginForm === 'function') prefillLoginForm();

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

  // Sync TopArea to Agent Page for consistent scroll logic
  const topArea = document.getElementById('topArea');
  const topAreaAgent = document.getElementById('topAreaAgent');
  if (topArea && topAreaAgent) {
    topAreaAgent.innerHTML = topArea.innerHTML;
  }

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
    window.DB.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session?.user?.id) {
        // If user intentionally logged out, force sign-out and stay logged out
        if (localStorage.getItem('_db_logout') === '1') {
          window.DB.auth.signOut();
          return;
        }
        window.currentUserId = session.user.id;
        // Fully restore UI (username, balance, agent panel, etc.)
        if (typeof restoreSession === 'function') {
          restoreSession(session.user.id);
        }
        subscribeNotifications(session.user.id);
      }
      if (event === 'SIGNED_OUT') {
        window.currentUserId  = null;
        window.currentIsAdmin = false;
        // Reset all UI to guest state
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
        // Pre-fill LOGIN form with last credentials, then open modal on login tab
        if (typeof prefillLoginForm === 'function') prefillLoginForm();
        if (typeof openAuthModal === 'function') openAuthModal('login');
        // Clean up notification channel
        unsubscribeNotifications();
        showPage('home');
      }
    });
  }

  if (typeof loadBanners === 'function') await loadBanners();
  if (typeof loadGamesFromDB === 'function') await loadGamesFromDB();

  document.querySelectorAll('.bnav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const nav = btn.dataset.nav;
      if (nav === 'account' && !window.currentUserId) {
        if (typeof gToast === 'function')
          gToast('Account page ကြည့်ရန် အကောင့် အရင်ဝင်ပါ');
        return;
      }
      showPage(nav);
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
