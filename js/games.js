// STATE
// ============================================================
let _allGames       = [];
let _activeCategory = 'all';

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

    if (error || !data?.length) return; // keep static fallback

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

    // Re-init slider with new dynamic slides
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

  // Show loading spinner
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
    return `<div class="game-card" onclick="playGame('${g.game_code}')">
      ${hasImg
        ? `<img src="${g.image_url}" class="gc-bg" loading="lazy" 
             decoding="async"
             onerror="this.style.display='none'">`
        : `<div class="gc-bg" style="background:linear-gradient(145deg,
             hsl(${hue},60%,30%),hsl(${hue + 20},70%,20%));"></div>
           <div class="gc-char">
             <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" opacity=".4">
               <polygon points="12,2 22,8 22,16 12,22 2,16 2,8"/>
             </svg>
           </div>`
      }
      <div class="gc-info">
        <div class="gc-name">${g.game_name}</div>
        <div class="gc-cat">${g.category.toUpperCase()}</div>
      </div>
    </div>`;
  }).join('');
}

function filterGames(category) {
  _activeCategory = category;
  renderGames();
}

// ============================================================
// PLAY GAME
// ============================================================
function playGame(gameCode) {
  if (!window.currentUserId) {
    openAuthModal('login');
    return;
  }
  console.log('Launch game:', gameCode);
  // Here you'd redirect to game URL or open provider lobby
}
