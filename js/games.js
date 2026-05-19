// ============================================================
// STATE
// ============================================================
let _allGames       = [];
let _activeCategory = 'all';

// ============================================================
// DYNAMIC BANNERS
// ============================================================
async function loadBanners() {
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

  const { data, error } = await window.DB
    .from('game_cards')
    .select('id, game_name, game_code, image_url, category')
    .order('created_at', { ascending: false });

  if (error || !data?.length) {
    grid.innerHTML = `
      <div style="grid-column:span 3;text-align:center;color:#555;font-size:12px;padding:30px;">
        ဂိမ်းများ load မဖြစ်ပါ
      </div>`;
    return;
  }

  _allGames = data;
  renderGames();
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
             onerror="this.style.display='none'">`
        : `<div class="gc-bg" style="background:linear-gradient(145deg,
             hsl(${hue},60%,30%),hsl(${hue + 20},70%,20%));"></div>
           <div class="gc-char">
             <svg width="40" height="40" viewBox="0 0 24 24" fill="none"
               stroke="white" stroke-width="1.5">
               <rect x="2" y="6" width="20" height="12" rx="2"/>
               <path d="M8 12h8M12 8v8"/>
             </svg>
           </div>`
      }
      <div class="gc-label"><span>${g.game_name}</span></div>
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
  // TODO: window.open(`${GAME_API_URL}/launch?code=${gameCode}&uid=${window.currentUserId}`, '_blank');
}
