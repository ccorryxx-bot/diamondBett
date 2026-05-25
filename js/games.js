// STATE
// ============================================================
let _allGames       = [];
let _activeCategory = 'all';
let _launchingGame  = null;

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

    const { data, error } = await window.DB
      .from('game_cards')
      .select('id, game_name, game_code, image_url, category')
      .order('created_at', { ascending: false });

    if (error) throw error;

    if (!data || data.length === 0) {
      grid.innerHTML = `
        <div style="grid-column:span 3;text-align:center;color:#555;font-size:12px;padding:30px;">
          ဂိမ်း မရှိသေးပါ
        </div>`;
      return;
    }

    _allGames = data;
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

  const filtered = _activeCategory === 'all'
    ? _allGames
    : _allGames.filter(g => g.category === _activeCategory);

  if (!filtered.length) {
    grid.innerHTML = `
      <div style="grid-column:span 3;text-align:center;color:#555;font-size:12px;padding:30px;">
        ဂိမ်း မရှိသေးပါ
      </div>`;
    return;
  }

  grid.innerHTML = filtered.map((g, idx) => {
    const hue    = (idx * 37) % 360;
    const hasImg = g.image_url && !g.image_url.includes('placeholder');
    return `<div class="game-card" id="gc-${g.game_code}" style="background:linear-gradient(145deg,hsl(${hue},45%,16%),hsl(${hue+20},55%,11%));" onclick="playGame('${g.game_code}','${(g.game_name||'').replace(/'/g,'')}')">
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
      </div>
    </div>`;
  }).join('');
}

function filterGames(category) {
  _activeCategory = category;
  renderGames();
}

// ============================================================
// PLAY GAME  — calls B2B API via Replit backend
// ============================================================
async function playGame(gameCode, gameName) {
  // Must be logged in
  if (!window.currentUserId) {
    if (typeof openAuthModal === 'function') openAuthModal('login');
    return;
  }

  // Prevent double-launch
  if (_launchingGame === gameCode) return;
  _launchingGame = gameCode;

  // Show loading state on card
  const card = document.getElementById('gc-' + gameCode);
  if (card) {
    card.style.opacity = '0.6';
    card.style.pointerEvents = 'none';
  }

  // Show toast
  if (typeof showToast === 'function') showToast(`ဂိမ်း ဖွင့်နေသည်... / Loading ${gameName || ''}...`);

  try {
    const apiBase = (typeof GAME_API_BASE !== 'undefined') ? GAME_API_BASE : '';
    const resp = await fetch(`${apiBase}/api/games/launch`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        user_id:  window.currentUserId,
        game_uid: gameCode,
        platform: 2   // H5 mobile
      }),
    });

    const result = await resp.json();

    if (result.code !== 0 || !result.game_url) {
      const msg = result.msg || 'ဂိမ်း မဖွင့်နိုင်ပါ';
      if (typeof showToast === 'function') showToast(msg, 'error');
      return;
    }

    // Open game in new tab
    window.open(result.game_url, '_blank', 'noopener,noreferrer');

  } catch (err) {
    console.error('Game launch error:', err);
    if (typeof showToast === 'function') showToast('Network error — ဂိမ်း မဖွင့်နိုင်ပါ', 'error');
  } finally {
    // Restore card
    if (card) {
      card.style.opacity = '';
      card.style.pointerEvents = '';
    }
    _launchingGame = null;
  }
}
