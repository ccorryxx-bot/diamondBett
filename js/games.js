// STATE
// ============================================================
let _allGames       = [];
let _activeCategory = 'all';
let _launchingGame  = null;

const _PROVIDER_CATS = ['pg', 'pp', 'jili', 'jdb'];

// ============================================================
// DYNAMIC BANNERS
// ============================================================
async function loadBanners() {
  try {
    if (!window.DB) return;
    const { data, error } = await window.DB
      .from('banners')
      .select('id, title, image_url')
      .order('created_at', { ascending: false })
      .limit(5);

    if (error || !data?.length) return;

    const track = document.getElementById('bannerTrack');
    const dots  = document.getElementById('bannerDots');
    if (!track || !dots) return;

    track.innerHTML = data.map(b => `
      <div class="banner-slide" style="background:#0c0a1e;position:relative;">
        <img
          src="${b.image_url}"
          alt="${b.title || 'Banner'}"
          style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;"
          onerror="this.style.display='none'">
        ${b.title ? `<div class="banner-placeholder" style="position:relative;z-index:1;">
          <div class="b-title">${b.title}</div>
        </div>` : ''}
      </div>`).join('');

    dots.innerHTML = data.map((_, i) =>
      `<div class="dot${i === 0 ? ' active' : ''}" data-i="${i}"></div>`
    ).join('');

    if (typeof window._restartBanner === 'function') window._restartBanner();
  } catch (err) {
    console.error('Banner load error:', err);
  }
}

// ============================================================
// DYNAMIC GAME GRID
// ============================================================
async function loadGamesFromDB() {
  const grid = document.getElementById('gameGrid');
  if (!grid) return;

  grid.innerHTML = `
    <div style="grid-column:span 3;padding:30px;text-align:center;">
      <div class="md-spin" style="margin:0 auto;"></div>
    </div>`;

  try {
    if (!window.DB) throw new Error('Supabase client not initialized');

    // Fetch all games in batches of 1000 (PostgREST max-rows default)
    // to work around the 1000-row page limit on all Supabase plans.
    const PAGE_SIZE = 1000;
    let allData = [];
    let from = 0;
    let keepFetching = true;

    while (keepFetching) {
      const { data, error } = await window.DB
        .from('game_cards')
        .select('id, game_name, game_code, image_url, category, provider_code')
        .order('created_at', { ascending: false })
        .range(from, from + PAGE_SIZE - 1);

      if (error) throw error;

      if (data && data.length > 0) {
        allData = allData.concat(data);
        from += PAGE_SIZE;
        keepFetching = data.length === PAGE_SIZE;
      } else {
        keepFetching = false;
      }
    }

    if (allData.length === 0) {
      grid.innerHTML = `
        <div style="grid-column:span 3;text-align:center;color:#555;font-size:12px;padding:30px;">
          ဂိမ်း မရှိသေးပါ
        </div>`;
      return;
    }

    _allGames = allData;
    renderGames();
  } catch (err) {
    console.error('Game load error:', err);
    grid.innerHTML = `
      <div style="grid-column:span 3;text-align:center;color:#555;font-size:12px;padding:30px;">
        ဂိမ်းများ load မဖြစ်ပါ (Error: ${err.message || 'Unknown error'})
      </div>`;
  }
}

// ============================================================
// RENDER + FILTER
// ============================================================
function renderGames() {
  const grid = document.getElementById('gameGrid');
  if (!grid) return;

  if (!grid._delegated) {
    grid.addEventListener('click', (e) => {
      const card = e.target.closest('.game-card');
      if (card && card.dataset.code) {
        playGame(card.dataset.code, card.dataset.name);
      }
    });
    grid._delegated = true;
  }

  const filtered = _activeCategory === 'all'
    ? _allGames
    : _PROVIDER_CATS.includes(_activeCategory)
      ? _allGames.filter(g => g.provider_code === _activeCategory)
      : _allGames.filter(g => g.category === _activeCategory);

  if (!filtered.length) {
    grid.innerHTML = `
      <div style="grid-column:span 3;text-align:center;color:#555;font-size:12px;padding:30px;">
        ဂိမ်း မရှိသေးပါ
      </div>`;
    return;
  }

  const frag = document.createDocumentFragment();
  filtered.forEach((g, idx) => {
    const hue = (idx * 37) % 360;
    const hasImg = g.image_url && !g.image_url.includes('placeholder');
    const safeName = (g.game_name || '').replace(/'/g, '');
    
    const card = document.createElement('div');
    card.className = 'game-card';
    card.id = `gc-${g.game_code}`;
    card.dataset.code = g.game_code;
    card.dataset.name = safeName;
    card.style.background = `linear-gradient(145deg,hsl(${hue},45%,16%),hsl(${hue+20},55%,11%))`;
    
    card.innerHTML = `
      ${hasImg
        ? `<img src="${g.image_url}" class="gc-bg" loading="lazy" onerror="this.style.display='none'">`
        : `<div class="gc-char">
             <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" opacity=".4">
               <polygon points="12,2 22,8 22,16 12,22 2,16 2,8"/>
             </svg>
           </div>`
      }
      <div class="gc-label">
        <span>${g.game_name}</span>
        <span>${(g.category||'').toUpperCase()}</span>
      </div>`;
    frag.appendChild(card);
  });

  grid.innerHTML = '';
  grid.appendChild(frag);
}

function filterGames(category) {
  _activeCategory = category;
  renderGames();
}

// ============================================================
// PLAY GAME
// window.open() MUST be the very first call — before any await.
// Mobile Chrome/Safari kill the popup if ANY async gap precedes it.
// ============================================================
async function playGame(gameCode, gameName) {
  // Prevent double-launch (sync check — no await yet)
  if (_launchingGame === gameCode) return;
  _launchingGame = gameCode;

  // ── STEP 1: Open blank tab NOW, inside synchronous user-gesture ──
  // This MUST come before any await or the browser popup-blocker fires.
  const gameWindow = window.open('about:blank', '_blank');

  // Show loading state on card
  const card = document.getElementById('gc-' + gameCode);
  if (card) {
    card.style.opacity       = '0.6';
    card.style.pointerEvents = 'none';
    const loader = document.createElement('div');
    loader.className = 'card-loader';
    loader.innerHTML = '<div class="md-spin"></div>';
    loader.style.cssText = 'position:absolute;inset:0;display:flex;align-items:center;justify-content:center;z-index:10;background:rgba(0,0,0,0.3);';
    card.appendChild(loader);
  }

  try {
    // ── STEP 2: Resolve user ID (async is OK — tab already open) ──
    const uid = window.currentUserId || (
      typeof getAuthUid === 'function' ? await getAuthUid() : null
    );

    if (!uid) {
      // Not logged in — close blank tab, show login modal
      if (gameWindow && !gameWindow.closed) gameWindow.close();
      if (typeof openAuthModal === 'function') openAuthModal('login');
      return;
    }

    if (typeof gToast === 'function') gToast(`ဂိမ်း ဖွင့်နေသည်... ${gameName || ''}`);

    // ── STEP 3: Call Edge Function to get game URL ──
    const apiBase  = (typeof GAME_API_BASE !== 'undefined') ? GAME_API_BASE : '';
    const supaKey  = (typeof SUPA_KEY      !== 'undefined') ? SUPA_KEY      : '';
    const resp = await fetch(`${apiBase}/api/games/launch`, {
      method : 'POST',
      headers: {
        'Content-Type' : 'application/json',
        'apikey'       : supaKey,
        'Authorization': `Bearer ${supaKey}`,
      },
      body   : JSON.stringify({
        user_id : uid,
        game_uid: gameCode,
        platform: 2,
        lang    : 'my',
        currency: 'MMK',
      }),
    });

    if (!resp.ok) {
      const errText = await resp.text().catch(() => '');
      throw new Error(`Server error ${resp.status}: ${errText}`);
    }

    const result = await resp.json();

    if (result.code !== 0 || !result.game_url) {
      if (gameWindow && !gameWindow.closed) gameWindow.close();
      if (typeof gToast === 'function') gToast(result.msg || 'ဂိမ်း မဖွင့်နိုင်ပါ', 'error');
      return;
    }

    // ── STEP 4: Navigate pre-opened tab to the game ──
    if (gameWindow && !gameWindow.closed) {
      gameWindow.location.href = result.game_url;
    } else {
      // Blank tab was blocked (very rare) — direct open as fallback
      const fallback = window.open(result.game_url, '_blank');
      if (!fallback && typeof gToast === 'function')
        gToast('Pop-up ပိတ်ထားပါသည် — Browser setting စစ်ပါ', 'error');
    }

  } catch (err) {
    console.error('Game launch error:', err);
    if (gameWindow && !gameWindow.closed) gameWindow.close();
    if (typeof gToast === 'function') gToast('ဂိမ်း မဖွင့်နိုင်ပါ — ထပ်ကြိုးစားပါ', 'error');
  } finally {
    if (card) {
      card.style.opacity       = '';
      card.style.pointerEvents = '';
      card.querySelector('.card-loader')?.remove();
    }
    _launchingGame = null;
  }
}
