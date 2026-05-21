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

  showPage('home');
});
