document.addEventListener('DOMContentLoaded', () => {

  // ============================================================
  // INIT SUPABASE  (CDN is already loaded — script is deferred)
  // ============================================================
  window.DB = window.supabase.createClient(SUPA_URL, SUPA_KEY);

  // ============================================================
  // INIT MODULES
  // ============================================================
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

  // Initial page
  showPage('home');
  document.querySelector('.bnav-btn[data-nav="home"]')?.classList.add('active');

  // ============================================================
  // BOTTOM NAV
  // ============================================================
  document.querySelectorAll('.bnav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.bnav-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      showPage(btn.dataset.nav);
    });
  });

  // ============================================================
  // AUTH MODAL
  // ============================================================
  const modal = document.getElementById('authModal');

  document.getElementById('showAuthBtn')?.addEventListener('click',  () => openAuthModal('login'));
  document.getElementById('agentLoginBtn')?.addEventListener('click', () => openAuthModal('login'));
  document.getElementById('modalCloseBtn')?.addEventListener('click', () => modal.classList.remove('active'));
  modal?.addEventListener('click', e => { if (e.target === modal) modal.classList.remove('active'); });

  document.getElementById('registerBtn')?.addEventListener('click', registerUser);
  document.getElementById('loginBtn')?.addEventListener('click',    loginUser);

  // ============================================================
  // DEPOSIT / WITHDRAW BUTTONS
  // ============================================================
  document.querySelectorAll('.wallet-btn.deposit').forEach(b =>
    b.addEventListener('click', openDepositModal));
  document.querySelectorAll('.wallet-btn.withdraw').forEach(b =>
    b.addEventListener('click', openWithdrawModal));

  document.getElementById('depCloseBtn')?.addEventListener('click', () => {
    clearInterval(window._cdTimer);
    document.getElementById('depositModal').classList.remove('open');
  });
  document.getElementById('wdCloseBtn')?.addEventListener('click', () => {
    document.getElementById('withdrawModal').classList.remove('open');
  });

  // ============================================================
  // BONUS CODE BUTTON
  // ============================================================
  document.getElementById('bonusCodeBtn')?.addEventListener('click', handleBonusCode);

  // ============================================================
  // SHARE / COPY BUTTONS
  // ============================================================
  document.getElementById('agentCopyLinkBtn')?.addEventListener('click', copyAgentLink);
  document.getElementById('shareNativeBtn')?.addEventListener('click', async () => {
    const link = document.getElementById('agentShareLinkInput')?.value;
    if (!link || link === '—') return;
    if (navigator.share) await navigator.share({ title: 'Diamond-BETT', url: link });
    else copyAgentLink();
  });
  document.getElementById('shareNative2')?.addEventListener('click', async () => {
    const link = document.getElementById('inv-link')?.value;
    if (!link || link === '—') return;
    if (navigator.share) await navigator.share({ title: 'Diamond-BETT', url: link });
    else navigator.clipboard.writeText(link).then(() => gToast('Link ကူးပြီးပါပြီ', 'success'));
  });
  document.getElementById('copyPhoneBtn')?.addEventListener('click', () => {
    const txt = document.getElementById('agentPhoneDisplay')?.textContent;
    if (txt) navigator.clipboard.writeText(txt).then(() => gToast('ကူးပြီးပါပြီ', 'success'));
  });

  // ============================================================
  // TURNOVER MODAL CLOSE
  // ============================================================
  document.getElementById('tvModal')?.querySelector('.tv-close-btn')
    ?.addEventListener('click', () => {
      document.getElementById('tvModal').classList.remove('open');
    });

  // ============================================================
  // URL REF PARAM — auto-fill referral
  // ============================================================
  const urlParams  = new URLSearchParams(window.location.search);
  const invitedBy  = urlParams.get('ref');
  if (invitedBy) {
    const ri = document.getElementById('referrer_code_input');
    if (ri) { ri.value = invitedBy; ri.readOnly = true; }
    openAuthModal('register');
  }

  // ============================================================
  // gToast CSS (injected once if not in styles.css)
  // ============================================================
  if (!document.getElementById('gToast')) {
    const t = document.createElement('div');
    t.id = 'gToast';
    document.body.appendChild(t);
  }

});
