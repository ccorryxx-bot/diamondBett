// IMAGE URL HELPER
// ============================================================
const _IK_BASE = 'https://ik.imagekit.io/tdpebgueq';

// Apply ImageKit transforms to a URL
function _applyIkTr(url, tr) {
  if (!url) return '';

  // jsDelivr → ImageKit with transforms
  if (url.includes('cdn.jsdelivr.net/gh/ccorryxx-bot/game-assets')) {
    const path = url.replace(
      'https://cdn.jsdelivr.net/gh/ccorryxx-bot/game-assets@main/', '');
    return `${_IK_BASE}/${tr}/${path}`;
  }

  // Already ImageKit — replace or inject transforms
  if (url.includes('ik.imagekit.io/tdpebgueq/')) {
    if (url.includes('/tr:')) {
      return url.replace(/\/tr:[^/]+\//, `/${tr}/`);   // replace existing
    }
    return url.replace(`${_IK_BASE}/`, `${_IK_BASE}/${tr}/`);
  }

  // Supabase storage or other — return as-is
  return url;
}

// Game card thumbnails: 3:4 portrait, 200×267 @2× for retina, auto-WebP, q75
function _gameImgUrl(url) {
  return _applyIkTr(url, 'tr:w-200,h-267,f-auto,q-75');
}

// Banner images: full-width banner, 800×400, auto-WebP, q85
function _bannerImgUrl(url) {
  return _applyIkTr(url, 'tr:w-800,h-400,f-auto,q-85');
}

// Legacy alias — kept for any other callers
function _imgUrl(url) { return _gameImgUrl(url); }

// Game card placeholder (shown when image fails or is missing)
function _gcPlaceholder(name) {
  const init = ((name || '?')[0] || '?').toUpperCase();
  return `<div class="gc-char">
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none"
         stroke="currentColor" stroke-width="1.5" opacity=".3">
      <polygon points="12,2 22,8 22,16 12,22 2,16 2,8"/>
    </svg>
    <span class="gc-init">${init}</span>
  </div>`;
}

// STATE
// ============================================================
let _allGames       = [];
let _activeCategory = 'all';
let _activeProvider  = 'all';   // sub-filter used when Slots tab is active
let _launchingGame  = null;
let _gcObserver     = null;

const _PROVIDER_CATS = ['pg', 'pp', 'jili', 'jdb'];
// 'all' tab shows only these 3 providers (not all 1000+ games)
const _DEFAULT_PROVIDERS = ['pp', 'jili', 'jdb'];

// Featured game codes — shown on 'all' tab in this exact order
const _FEATURED_CODES = [
  '9b93cb0dc46d847864c87ed42a3428bb', // 1. Wild Ape #3258 (pg)
  '880a68222d05a3697055d523d574cb2b', // 2. Gates of Olympus Super Scatter (pp)
  // 3. Raven Party Fever — not in DB
  '6dcaf78e4e23929cbe2deb3d1210928c', // 4. Sweet Bonanza (pp)
  'b8e1e1eb06f840517980f96164bc3ccd', // 5. Jackpot Fishing 2 (jili)
  '09699fd0de13edbb6c4a194d7494640b', // 6. Fengshen (jili)
  'ab841b96a216b2321baa11d6121185a3', // 7. Pyramid Bonanza (pp)
  'be6b6890587ed84289fad941d99a3613', // 8. Starlight Princess (pp)
  '3b502aee6c9e1ef0f698332ee1b76634', // 9. Blackjack (jili)
  '09d08939279289a03b89f2f146a7f817', // 10. Starlight Princess 1000 (pp)
  '3ea8ed5f8ba2239e6cd49366afb743f8', // 11. 3 Charge Buffalo (jili)
  'fe942e56d8f33522e4084e8e3aaa3523', // 12. Cash Coin (jili)
  '4ae52ed2e1a8c353878ba65ed7791ac4', // 13. Gates of Olympus 1000 (pp)
  '8cbb88bc0bc1f7be4379cf75abc6095f', // 14. Golden Empire 2 (jili)
  '981f5f9675002fbeaaf24c4128b938d7', // 15. Boxing King (jili)
];

// ============================================================
// DYNAMIC BANNERS  (uses _bannerImgUrl — full-width transforms)
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
          src="${_bannerImgUrl(b.image_url)}"
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
// INTERSECTION OBSERVER — lazy load: swap data-src → src
// on viewport entry (200px pre-load buffer)
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
  }, { rootMargin: '200px 0px', threshold: 0 });
}

// ============================================================
// RENDER + FILTER
// ============================================================
function renderGames() {
  const grid = document.getElementById('gameGrid');
  if (!grid) return;

  if (_gcObserver) _gcObserver.disconnect();

  if (!grid._delegated) {
    grid.addEventListener('click', (e) => {
      const wrap = e.target.closest('.game-card-wrap');
      const card = wrap ? wrap.querySelector('.game-card') : e.target.closest('.game-card');
      if (card && card.dataset.code) {
        playGame(card.dataset.code, card.dataset.name);
      }
    });
    grid._delegated = true;
  }

  // Build filtered game list
  let filtered;
  if (_activeCategory === 'all') {
    filtered = _FEATURED_CODES
      .map(code => _allGames.find(g => g.game_code === code))
      .filter(Boolean);
  } else if (_activeCategory === 'slot') {
    // Slots tab: apply optional provider sub-filter
    const slotGames = _allGames.filter(g => g.category === 'slot');
    filtered = _activeProvider === 'all'
      ? slotGames
      : slotGames.filter(g => g.provider_code === _activeProvider);
  } else if (_PROVIDER_CATS.includes(_activeCategory)) {
    filtered = _allGames.filter(g => g.provider_code === _activeCategory);
  } else {
    filtered = _allGames.filter(g => g.category === _activeCategory);
  }

  if (!filtered.length) {
    grid.innerHTML = `
      <div style="grid-column:span 3;text-align:center;color:#555;font-size:12px;padding:30px;">
        ဂိမ်း မရှိသေးပါ
      </div>`;
    return;
  }

  _initGcObserver();

  const frag = document.createDocumentFragment();
  filtered.forEach((g, idx) => {
    const hue      = (idx * 37) % 360;
    const imgSrc   = _gameImgUrl(g.image_url);   // ← portrait transforms
    const hasImg   = !!(imgSrc && !imgSrc.includes('placeholder'));
    const safeName = (g.game_name || '').replace(/'/g, '');

    const wrap = document.createElement('div');
    wrap.className = 'game-card-wrap';

    const card = document.createElement('div');
    card.className = 'game-card';
    card.id = `gc-${g.game_code}`;
    card.dataset.code = g.game_code;
    card.dataset.name = safeName;

    if (hasImg) {
      const img = document.createElement('img');
      img.className = 'gc-bg';
      img.alt       = '';                      // empty alt = no alt text flash
      img.width     = 200;
      img.height    = 267;
      img.dataset.src = imgSrc;               // deferred — no network until visible

      // On load: fade in + remove shimmer from card
      img.onload = function() {
        card.classList.add('gc-img-loaded');
      };

      // On error: swap img → placeholder + remove shimmer
      img.onerror = function() {
        card.classList.add('gc-img-loaded');
        const ph = document.createElement('div');
        ph.innerHTML = _gcPlaceholder(g.game_name);
        if (this.parentNode) {
          this.parentNode.replaceChild(ph.firstElementChild, this);
        }
      };

      card.appendChild(img);
      _gcObserver.observe(img);
    } else {
      card.classList.add('gc-img-loaded');    // no image — skip shimmer
      card.insertAdjacentHTML('beforeend', _gcPlaceholder(g.game_name));
    }

    const nameEl = document.createElement('div');
    nameEl.className = 'gc-name';
    nameEl.textContent = g.game_name;

    wrap.appendChild(card);
    wrap.appendChild(nameEl);
    frag.appendChild(wrap);
  });

  grid.innerHTML = '';
  grid.appendChild(frag);
}

function filterGames(category) {
  _activeCategory = category;
  _activeProvider  = 'all';

  // Show provider bar ONLY when Slots tab is active
  const provBar = document.getElementById('providerFilterBar');
  if (provBar) {
    provBar.style.display = (category === 'slot') ? 'flex' : 'none';
    // Reset provider active state to "All"
    provBar.querySelectorAll('.prov-item').forEach(b => b.classList.remove('active'));
    const allBtn = provBar.querySelector('[data-prov="all"]');
    if (allBtn) allBtn.classList.add('active');
  }

  renderGames();
}

// ── Provider sub-filter (only used inside Slots tab) ─────────────────────────
function filterProvider(el, provider) {
  _activeProvider = provider;
  // Update active state on provider buttons
  const provBar = document.getElementById('providerFilterBar');
  if (provBar) {
    provBar.querySelectorAll('.prov-item').forEach(b => b.classList.remove('active'));
  }
  if (el) el.classList.add('active');
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
