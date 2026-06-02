// IMAGE URL HELPER — optimized: ImageKit transforms ပါ + fallback handling
// ============================================================
const _IK_BASE = 'https://ik.imagekit.io/tdpebgueq';
const _IK_TR   = 'tr:w-200,h-150,f-auto,q-75';

function _imgUrl(url) {
  if (!url) return '';

  // jsDelivr → ImageKit with transforms (2× retina, auto-WebP, q75)
  if (url.includes('cdn.jsdelivr.net/gh/ccorryxx-bot/game-assets')) {
    const path = url.replace(
      'https://cdn.jsdelivr.net/gh/ccorryxx-bot/game-assets@main/', '');
    return `${_IK_BASE}/${_IK_TR}/${path}`;
  }

  // Already ImageKit — inject transforms if not already present
  if (url.includes('ik.imagekit.io/tdpebgueq/')) {
    if (url.includes('/tr:')) return url;          // already transformed
    return url.replace(`${_IK_BASE}/`, `${_IK_BASE}/${_IK_TR}/`);
  }

  // Supabase storage or other CDN — return as-is (can't proxy)
  return url;
}

// ── Inline game card placeholder (shown when img fails or url is missing) ──
function _gcPlaceholder(name) {
  const init = ((name || '?')[0] || '?').toUpperCase();
  return `<div class="gc-char">
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none"
         stroke="currentColor" stroke-width="1.5" opacity=".35">
      <polygon points="12,2 22,8 22,16 12,22 2,16 2,8"/>
    </svg>
    <span style="position:absolute;bottom:4px;left:0;right:0;text-align:center;
      font-size:9px;color:rgba(255,255,255,.4);font-weight:700;letter-spacing:.5px;">
      ${init}
    </span>
  </div>`;
}

// STATE
// ============================================================
let _allGames       = [];
let _activeCategory = 'all';
let _launchingGame  = null;
let _gcObserver     = null;   // IntersectionObserver for lazy image loading

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
          src="${_imgUrl(b.image_url)}"
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
// INTERSECTION OBSERVER — lazy image loading
// Images have data-src; observer swaps to src when card enters viewport.
// ============================================================
function _initGcObserver() {
  if (_gcObserver) _gcObserver.disconnect();

  _gcObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const img = entry.target;
      const src = img.dataset.src;
      if (!src) return;

      img.src = src;
      img.removeAttribute('data-src');
      _gcObserver.unobserve(img);
    });
  }, {
    rootMargin: '200px 0px',   // pre-load 200px before visible
    threshold: 0
  });
}

// ============================================================
// RENDER + FILTER
// ============================================================
function renderGames() {
  const grid = document.getElementById('gameGrid');
  if (!grid) return;

  // Disconnect old observer before re-render
  if (_gcObserver) _gcObserver.disconnect();

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

  // ── Phase 1: Build all cards instantly (no network) ──────────
  // Images use data-src — no network request yet.
  // IntersectionObserver will swap data-src → src as cards enter viewport.
  _initGcObserver();

  const frag = document.createDocumentFragment();
  filtered.forEach((g, idx) => {
    const hue      = (idx * 37) % 360;
    const imgSrc   = _imgUrl(g.image_url);
    const hasImg   = imgSrc && !imgSrc.includes('placeholder');
    const safeName = (g.game_name || '').replace(/'/g, '');

    const card = document.createElement('div');
    card.className = 'game-card';
    card.id = `gc-${g.game_code}`;
    card.dataset.code = g.game_code;
    card.dataset.name = safeName;
    card.style.background =
      `linear-gradient(145deg,hsl(${hue},45%,16%),hsl(${hue + 20},55%,11%))`;

    if (hasImg) {
      // Use data-src for lazy IntersectionObserver loading
      const img = document.createElement('img');
      img.className   = 'gc-bg';
      img.alt         = g.game_name || '';
      img.width       = 200;
      img.height      = 150;
      img.dataset.src = imgSrc;          // ← deferred, no network yet
      // On error: replace img with placeholder (never show blank card)
      img.onerror = function() {
        const ph = document.createElement('div');
        ph.innerHTML = _gcPlaceholder(g.game_name);
        this.parentNode.replaceChild(ph.firstElementChild, this);
      };
      card.appendChild(img);
      _gcObserver.observe(img);          // will set src when visible
    } else {
      card.insertAdjacentHTML('beforeend', _gcPlaceholder(g.game_name));
    }

    card.insertAdjacentHTML('beforeend', `
      <div class="gc-label">
        <span>${g.game_name}</span>
        <span>${(g.category || '').toUpperCase()}</span>
      </div>`);

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
  if (_launchingGame === gameCode) return;
  _launchingGame = gameCode;

  const gameWindow = window.open('about:blank', '_blank');

  const card = document.getElementById('gc-' + gameCode);
  if (card) {
    card.style.opacity       = '0.6';
    card.style.pointerEvents = 'none';
    const loader = document.createElement('div');
    loader.className = 'card-loader';
    loader.innerHTML = '<div class="md-spin"></div>';
    loader.style.cssText =
      'position:absolute;inset:0;display:flex;align-items:center;justify-content:center;z-index:10;background:rgba(0,0,0,0.3);';
    card.appendChild(loader);
  }

  try {
    const uid = window.currentUserId || (
      typeof getAuthUid === 'function' ? await getAuthUid() : null
    );

    if (!uid) {
      if (gameWindow && !gameWindow.closed) gameWindow.close();
      if (typeof openAuthModal === 'function') openAuthModal('login');
      return;
    }

    if (typeof gToast === 'function') gToast(`ဂိမ်း ဖွင့်နေသည်... ${gameName || ''}`);

    const apiBase = (typeof GAME_API_BASE !== 'undefined') ? GAME_API_BASE : '';
    const supaKey = (typeof SUPA_KEY      !== 'undefined') ? SUPA_KEY      : '';
    const resp = await fetch(`${apiBase}/api/games/launch`, {
      method : 'POST',
      headers: {
        'Content-Type' : 'application/json',
        'apikey'       : supaKey,
        'Authorization': `Bearer ${supaKey}`,
      },
      body: JSON.stringify({
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
      if (typeof gToast === 'function')
        gToast(result.msg || 'ဂိမ်း မဖွင့်နိုင်ပါ', 'error');
      return;
    }

    if (gameWindow && !gameWindow.closed) {
      gameWindow.location.href = result.game_url;
    } else {
      const fallback = window.open(result.game_url, '_blank');
      if (!fallback && typeof gToast === 'function')
        gToast('Pop-up ပိတ်ထားပါသည် — Browser setting စစ်ပါ', 'error');
    }

  } catch (err) {
    console.error('Game launch error:', err);
    if (gameWindow && !gameWindow.closed) gameWindow.close();
    if (typeof gToast === 'function')
      gToast('ဂိမ်း မဖွင့်နိုင်ပါ — ထပ်ကြိုးစားပါ', 'error');
  } finally {
    if (card) {
      card.style.opacity       = '';
      card.style.pointerEvents = '';
      card.querySelector('.card-loader')?.remove();
    }
    _launchingGame = null;
  }
}
