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
let _allGames        = [];
let _activeCategory  = 'all';
let _activeProvider  = 'all';   // sub-filter used when Slots tab is active
let _displayLimit    = 20;       // cards visible; auto-grows 20 on scroll
let _renderedCount   = 0;        // cards currently in DOM (append-only tracking)
let _hsObserver      = null;     // lazy-load observer for static home sections
let _scrollObserver  = null;     // IntersectionObserver for infinite scroll
let _launchingGame   = null;
let _gcObserver      = null;
let _providerImageMap = null;    // Map<provider_code, string[]> valid image URLs
let _hotGames        = [];       // top-7 most-played games
let _hotPollTimer    = null;     // 30-min interval handle
let _searchQuery     = '';       // active search string (empty = no search)
let _searchActive    = false;    // search bar open state

const _PROVIDER_CATS = ['pg', 'pp', 'jili', 'jdb'];
// 'all' tab shows only these 3 providers (not all 1000+ games)
const _DEFAULT_PROVIDERS = ['pp', 'jili', 'jdb'];

// Myanmar popular slot game codes — pinned at top of Slots tab (valid-image games only)
// Covers PP, PG, JILI, JDB top picks for local market
const _MM_POPULAR_SLOT_CODES = new Set([
  // ── Pragmatic Play ──────────────────────────────
  '880a68222d05a3697055d523d574cb2b', // Gates of Olympus Super Scatter
  '6dcaf78e4e23929cbe2deb3d1210928c', // Sweet Bonanza
  'ab841b96a216b2321baa11d6121185a3', // Pyramid Bonanza
  'be6b6890587ed84289fad941d99a3613', // Starlight Princess
  '09d08939279289a03b89f2f146a7f817', // Starlight Princess 1000
  '4ae52ed2e1a8c353878ba65ed7791ac4', // Gates of Olympus 1000
  // ── PG Soft ─────────────────────────────────────
  '9b93cb0dc46d847864c87ed42a3428bb', // Wild Ape #3258
  // ── JILI ────────────────────────────────────────
  '09699fd0de13edbb6c4a194d7494640b', // Fengshen
  '8cbb88bc0bc1f7be4379cf75abc6095f', // Golden Empire 2
  '981f5f9675002fbeaaf24c4128b938d7', // Boxing King
  '3ea8ed5f8ba2239e6cd49366afb743f8', // 3 Charge Buffalo
  'fe942e56d8f33522e4084e8e3aaa3523', // Cash Coin
  '3b502aee6c9e1ef0f698332ee1b76634', // Blackjack
]);

// Returns true only for games hosted on our trusted CDNs (jsDelivr or ImageKit).
// Provider CDNs (JDB, JILI, etc.) often block hotlinking → treat as unconfirmed.
function _hasOwnValidImage(g) {
  const url = g.image_url || '';
  return url.includes('cdn.jsdelivr.net') || url.includes('ik.imagekit.io');
}

// Returns true for any non-empty URL that isn't a known blocker.
// "Maybe valid" — unknown CDN that might work.
function _hasMaybeImage(g) {
  const url = g.image_url || '';
  return !!(url && !url.includes('pragmaticplay.net'));
}

// Sort games into 4 tiers:
//   0 — Popular MM + trusted CDN image  (top)
//   1 — Non-popular + trusted CDN image
//   2 — Unknown CDN (may display, but unconfirmed)
//   3 — pragmaticplay.net blocked / no image  (bottom)
function _sortSlotGames(games) {
  return [...games].sort((a, b) => {
    const t = g => _MM_POPULAR_SLOT_CODES.has(g.game_code) && _hasOwnValidImage(g) ? 0
                 : _hasOwnValidImage(g)  ? 1
                 : _hasMaybeImage(g)     ? 2
                 : 3;
    return t(a) - t(b);
  });
}

// Fallback hot games shown until real play_count data accumulates
const _HOT_FALLBACK_CODES = [
  '880a68222d05a3697055d523d574cb2b', // Gates of Olympus Super Scatter (pp)
  '6dcaf78e4e23929cbe2deb3d1210928c', // Sweet Bonanza (pp)
  '9b93cb0dc46d847864c87ed42a3428bb', // Wild Ape #3258 (pg)
  'b8e1e1eb06f840517980f96164bc3ccd', // Jackpot Fishing 2 (jili)
  '09699fd0de13edbb6c4a194d7494640b', // Fengshen (jili)
  'ab841b96a216b2321baa11d6121185a3', // Pyramid Bonanza (pp)
  'be6b6890587ed84289fad941d99a3613', // Starlight Princess (pp)
];

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
// PROVIDER IMAGE MAP — fallback images for games with no image
// ============================================================
// Builds Map<provider_code, string[]> of valid (non-broken) image URLs.
// Called once after _allGames is populated.
function _buildProviderImageMap() {
  const map = new Map();
  for (const g of _allGames) {
    const url = g.image_url || '';
    // pragmaticplay.net blocks hotlinking → treat as broken
    if (!url || url.includes('pragmaticplay.net')) continue;
    const prov = g.provider_code || '_other';
    if (!map.has(prov)) map.set(prov, []);
    map.get(prov).push(url);
  }
  _providerImageMap = map;
}

// Returns a resolved, valid image URL for a game.
// If the game's own image is missing or broken, picks a stable
// replacement from the same provider (deterministic via game_code hash).
function _resolveGameImg(g) {
  const url = g.image_url || '';
  const isBroken = !url || url.includes('pragmaticplay.net');
  if (!isBroken) return _gameImgUrl(url);

  if (!_providerImageMap) return '';
  const pool = _providerImageMap.get(g.provider_code || '_other');
  if (!pool || !pool.length) return '';

  // Deterministic index from game_code so the same card always shows
  // the same replacement image (no flicker on re-render).
  const idx = [...(g.game_code || '')].reduce(
    (s, c) => (s + c.charCodeAt(0)) & 0xffff, 0
  ) % pool.length;
  return _gameImgUrl(pool[idx]);
}

// ============================================================
// HOT GAMES — top-7 by play_count, 30-min polling
// ============================================================
async function loadHotGames() {
  if (!window.DB) return;
  try {
    const { data } = await window.DB
      .from('game_cards')
      .select('id, game_name, game_code, image_url, category, provider_code, play_count')
      .gt('play_count', 0)
      .order('play_count', { ascending: false })
      .limit(7);

    if (data && data.length >= 7) {
      _hotGames = data;
    } else if (data && data.length > 0) {
      // Partial real data — pad with fallback codes
      const realCodes = new Set(data.map(g => g.game_code));
      const extra = _HOT_FALLBACK_CODES
        .map(code => _allGames.find(g => g.game_code === code))
        .filter(g => g && !realCodes.has(g.game_code));
      _hotGames = [...data, ...extra].slice(0, 7);
    } else {
      // No play data yet — show curated fallback
      _hotGames = _HOT_FALLBACK_CODES
        .map(code => _allGames.find(g => g.game_code === code))
        .filter(Boolean)
        .slice(0, 7);
    }
  } catch (_e) {
    // play_count column may not exist yet — fall back silently
    _hotGames = _HOT_FALLBACK_CODES
      .map(code => _allGames.find(g => g.game_code === code))
      .filter(Boolean)
      .slice(0, 7);
  }

  // If user is currently on the Hot tab, refresh the grid
  if (_activeCategory === 'show') {
    _renderedCount = 0;
    renderGames();
  }
}

function _startHotPoll() {
  if (_hotPollTimer) clearInterval(_hotPollTimer);
  loadHotGames();
  _hotPollTimer = setInterval(loadHotGames, 30 * 60 * 1000); // 30 minutes
}

// Fire-and-forget play count increment (non-critical)
async function _trackGamePlay(gameCode) {
  if (!window.DB || !gameCode) return;
  try {
    await window.DB.rpc('increment_game_play', { p_game_code: gameCode });
  } catch (_e) { /* silent — migration may not be applied yet */ }
}

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
    _buildProviderImageMap();   // build provider→images map for fallback images
    renderGames();
    // Populate static home-page preview sections
    _renderHomeSection('live',   9,  'homeLiveGrid');
    _renderHomeSection('fish',   11, 'homeFishGrid');
    _renderHomeSection('arcade', 8,  'homeArcadeGrid');
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

      if (src.includes('pragmaticplay.net')) img.referrerPolicy = 'no-referrer';
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

  const isFirstRender = (_renderedCount === 0);

  // Only reset the lazy-load observer on a full refresh
  if (isFirstRender && _gcObserver) _gcObserver.disconnect();

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
  } else if (_activeCategory === 'show') {
    // Hot Games — top-7 by play_count (or fallback if no data yet)
    filtered = _hotGames.length
      ? _hotGames
      : _HOT_FALLBACK_CODES
          .map(code => _allGames.find(g => g.game_code === code))
          .filter(Boolean)
          .slice(0, 7);
  } else if (_activeCategory === 'slot') {
    const slotGames = _allGames.filter(g => g.category === 'slot');
    const base = _activeProvider === 'all'
      ? slotGames
      : slotGames.filter(g => g.provider_code === _activeProvider);
    // Popular MM games (valid image) → other valid-image games → broken/no image
    filtered = _sortSlotGames(base);
  } else if (_PROVIDER_CATS.includes(_activeCategory)) {
    filtered = _allGames.filter(g => g.provider_code === _activeCategory);
  } else {
    filtered = _allGames.filter(g => g.category === _activeCategory);
  }

  // Search filter — overrides category when query is active (searches all games)
  if (_searchQuery) {
    filtered = _allGames.filter(g =>
      (g.game_name || '').toLowerCase().includes(_searchQuery)
    );
    // Exact / starts-with matches float to top
    filtered = filtered.sort((a, b) => {
      const aN = (a.game_name || '').toLowerCase();
      const bN = (b.game_name || '').toLowerCase();
      return (aN.startsWith(_searchQuery) ? 0 : 1) - (bN.startsWith(_searchQuery) ? 0 : 1);
    });
  }

  const totalCount = filtered.length;

  if (!totalCount) {
    grid.innerHTML = `
      <div style="grid-column:span 3;text-align:center;color:#555;font-size:12px;padding:30px;">
        ဂိမ်း မရှိသေးပါ
      </div>`;
    _updateScrollSentinel(false);
    return;
  }

  // On first render: create fresh observer + clear grid
  if (isFirstRender) {
    _initGcObserver();
    grid.innerHTML = '';
  }

  // ── Append-only: only build cards that aren't in the DOM yet ──
  const upTo     = Math.min(_displayLimit, totalCount);
  const newSlice = filtered.slice(_renderedCount, upTo);

  if (newSlice.length > 0) {
    const frag = document.createDocumentFragment();
    newSlice.forEach((g, i) => {
      const globalIdx = _renderedCount + i;   // consistent hue across batches
      const imgSrc    = _resolveGameImg(g);   // provider-fallback image if own is missing
      const hasImg    = !!(imgSrc);
      const safeName  = (g.game_name || '').replace(/'/g, '');

      const wrap = document.createElement('div');
      wrap.className = 'game-card-wrap';

      const card = document.createElement('div');
      card.className = 'game-card';
      card.id        = `gc-${g.game_code}`;
      card.dataset.code = g.game_code;
      card.dataset.name = safeName;

      if (hasImg) {
        const img = document.createElement('img');
        img.className   = 'gc-bg';
        img.alt         = '';
        img.width       = 200;
        img.height      = 267;
        img.dataset.src = imgSrc;   // deferred — _gcObserver sets src on scroll
        // Fallback: original jsDelivr URL if ImageKit CDN fails
        if (g.image_url && g.image_url.includes('cdn.jsdelivr.net')) {
          img.dataset.fallback = g.image_url;
        }

        img.onload  = function() { card.classList.add('gc-img-loaded'); };
        img.onerror = function() {
          const fb = this.dataset.fallback;
          if (fb && this.src !== fb) { this.src = fb; return; }
          card.classList.add('gc-img-loaded');
          const ph = document.createElement('div');
          ph.innerHTML = _gcPlaceholder(g.game_name);
          if (this.parentNode) this.parentNode.replaceChild(ph.firstElementChild, this);
        };

        card.appendChild(img);
        _gcObserver.observe(img);
      } else {
        card.classList.add('gc-img-loaded');
        card.insertAdjacentHTML('beforeend', _gcPlaceholder(g.game_name));
      }

      const nameEl = document.createElement('div');
      nameEl.className = 'gc-name';
      nameEl.textContent = g.game_name;

      wrap.appendChild(card);
      wrap.appendChild(nameEl);
      frag.appendChild(wrap);
    });

    grid.appendChild(frag);
    _renderedCount = upTo;
  }

  // Sentinel + background prefetch of NEXT batch
  _updateScrollSentinel(_renderedCount < totalCount);
  _prefetchNextBatch(filtered, _renderedCount, 20);
}

// ── Infinite scroll helpers ──────────────────────────────────────────────────
function _updateScrollSentinel(hasMore) {
  const sentinel = document.getElementById('loadMoreWrap');
  if (!sentinel) return;

  // Disconnect previous observer before re-observing
  if (_scrollObserver) { _scrollObserver.disconnect(); _scrollObserver = null; }

  if (!hasMore) {
    sentinel.innerHTML = '';   // no more games — hide sentinel
    return;
  }

  // Keep sentinel visible (CSS makes it a thin invisible strip)
  sentinel.innerHTML = '<div class="scroll-sentinel"></div>';

  _scrollObserver = new IntersectionObserver((entries) => {
    if (entries[0].isIntersecting) {
      _scrollObserver.disconnect();
      _scrollObserver = null;
      // Prefetch already handled — append next 20 immediately
      _displayLimit += 20;
      renderGames();
    }
  }, {
    root: null,
    rootMargin: '0px 0px 120px 0px',  // trigger 120px before sentinel hits bottom
    threshold: 0
  });

  _scrollObserver.observe(sentinel.firstElementChild);
}
// ── Background image prefetch ─────────────────────────────────────────────────
// Loads next batch into browser cache while user is reading current batch.
// When cards appear in DOM, images are already cached → instant display.
function _prefetchNextBatch(filtered, startIdx, count) {
  filtered.slice(startIdx, startIdx + count).forEach(game => {
    const src = _gameImgUrl(game.image_url);
    if (src && !src.includes('placeholder') && src !== 'undefined') {
      const img = new Image();
      if (src.includes('pragmaticplay.net')) img.referrerPolicy = 'no-referrer';
      img.src = src;   // silent background download
    }
  });
}

function filterGames(category) {
  _activeCategory = category;
  _activeProvider  = 'all';
  _displayLimit    = 20;        // reset on tab change
  _renderedCount   = 0;          // force full DOM rebuild
  if (_scrollObserver) { _scrollObserver.disconnect(); _scrollObserver = null; }

  // Hot tab — start 30-min polling (first call loads immediately)
  if (category === 'show') _startHotPoll();

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
  _displayLimit   = 20;         // reset on provider change
  _renderedCount   = 0;          // force full DOM rebuild
  if (_scrollObserver) { _scrollObserver.disconnect(); _scrollObserver = null; }
  // Update active state on provider buttons
  const provBar = document.getElementById('providerFilterBar');
  if (provBar) {
    provBar.querySelectorAll('.prov-item').forEach(b => b.classList.remove('active'));
  }
  if (el) el.classList.add('active');
  renderGames();
}
// ── Home-section lazy-load observer (permanent, never disconnected) ────────────
function _initHsObserver() {
  _hsObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const img = entry.target;
      const src = img.dataset.src;
      if (!src) return;
      if (src.includes('pragmaticplay.net')) img.referrerPolicy = 'no-referrer';
      img.src = src;
      _hsObserver.unobserve(img);
    });
  }, { root: null, rootMargin: '0px 0px 200px 0px', threshold: 0 });
}

// ── Render a fixed-count preview section (Live / Fish / Arcade) ──────────────
// category : 'live' | 'fish' | 'arcade'
// count    : how many cards to show
// gridId   : id of the target .hs-grid element
function _renderHomeSection(category, count, gridId) {
  const grid = document.getElementById(gridId);
  if (!grid || grid._rendered) return;   // idempotent

  // Pick top-N games for this category — trusted-CDN images first, broken last
  const games = [..._allGames.filter(g => g.category === category)]
    .sort((a, b) => (_hasOwnValidImage(b) ? 1 : 0) - (_hasOwnValidImage(a) ? 1 : 0))
    .slice(0, count);

  // Hide whole section if no games exist
  if (!games.length) {
    const section = grid.closest('.home-section');
    if (section) section.style.display = 'none';
    return;
  }

  if (!_hsObserver) _initHsObserver();

  // Click delegation
  if (!grid._delegated) {
    grid.addEventListener('click', (e) => {
      const wrap = e.target.closest('.game-card-wrap');
      const card = wrap ? wrap.querySelector('.game-card') : e.target.closest('.game-card');
      if (card && card.dataset.code) playGame(card.dataset.code, card.dataset.name);
    });
    grid._delegated = true;
  }

  const frag = document.createDocumentFragment();
  games.forEach(gm => {
    const imgSrc   = _resolveGameImg(gm);  // provider-fallback image if own is missing
    const hasImg   = !!(imgSrc);
    const safeName = (gm.game_name || '').replace(/'/g, '');

    const wrap = document.createElement('div');
    wrap.className = 'game-card-wrap';

    const card = document.createElement('div');
    card.className    = 'game-card';
    card.id           = `hs-${gm.game_code}`;
    card.dataset.code = gm.game_code;
    card.dataset.name = safeName;

    if (hasImg) {
      const img = document.createElement('img');
      img.className   = 'gc-bg';
      img.alt         = '';
      img.width       = 200;
      img.height      = 267;
      img.dataset.src = imgSrc;   // deferred via _hsObserver
      // Fallback: original jsDelivr URL if ImageKit CDN fails
      if (gm.image_url && gm.image_url.includes('cdn.jsdelivr.net')) {
        img.dataset.fallback = gm.image_url;
      }

      img.onload  = function() { card.classList.add('gc-img-loaded'); };
      img.onerror = function() {
        const fb = this.dataset.fallback;
        if (fb && this.src !== fb) { this.src = fb; return; }
        card.classList.add('gc-img-loaded');
        const ph = document.createElement('div');
        ph.innerHTML = _gcPlaceholder(gm.game_name);
        if (this.parentNode) this.parentNode.replaceChild(ph.firstElementChild, this);
      };

      card.appendChild(img);
      _hsObserver.observe(img);
    } else {
      card.classList.add('gc-img-loaded');
      card.insertAdjacentHTML('beforeend', _gcPlaceholder(gm.game_name));
    }

    const nameEl = document.createElement('div');
    nameEl.className  = 'gc-name';
    nameEl.textContent = gm.game_name;

    wrap.appendChild(card);
    wrap.appendChild(nameEl);
    frag.appendChild(wrap);
  });

  grid.appendChild(frag);
  grid._rendered = true;
}
// ============================================================
// SEARCH — toggle bar, filter games by name across all tabs
// ============================================================
function toggleSearch() {
  _searchActive = !_searchActive;
  const bar = document.getElementById('gameSearchBar');
  const btn = document.getElementById('searchToggleBtn');
  if (bar) bar.classList.toggle('open', _searchActive);
  if (btn) btn.classList.toggle('active', _searchActive);
  if (_searchActive) {
    setTimeout(() => {
      const inp = document.getElementById('gameSearchInput');
      if (inp) inp.focus();
    }, 180);
  } else {
    clearSearch();
  }
}

let _searchDebounce = null;
function searchGames(query) {
  _searchQuery = (query || '').trim().toLowerCase();
  clearTimeout(_searchDebounce);
  _searchDebounce = setTimeout(function() {
    _displayLimit  = 20;
    _renderedCount = 0;
    if (_scrollObserver) { _scrollObserver.disconnect(); _scrollObserver = null; }
    renderGames();
  }, 250);
}

function clearSearch() {
  _searchQuery   = '';
  _displayLimit  = 20;
  _renderedCount = 0;
  const inp = document.getElementById('gameSearchInput');
  if (inp) inp.value = '';
  renderGames();
}

// ── Quick-jump from provider/category grid ────────────────────────────────────
function goToSection(cat, provider) {
  // Activate the correct cat tab
  document.querySelectorAll('.cat-item').forEach(b => b.classList.remove('active'));
  const tabEl = document.querySelector('.cat-item[data-cat="' + cat + '"]');
  if (tabEl) tabEl.classList.add('active');

  // filterGames handles provider bar show/hide + resets provider to 'all'
  filterGames(cat);

  // If a specific provider requested, also apply provider filter
  if (provider) {
    const provEl = document.querySelector('.prov-item[data-prov="' + provider + '"]');
    filterProvider(provEl, provider);
  }

  // Scroll to the top of the game section
  const bar = document.getElementById('catTabBar');
  if (bar) bar.scrollIntoView({ behavior: 'smooth', block: 'start' });
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

    // Track play count (fire-and-forget — non-critical)
    _trackGamePlay(gameCode);

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
