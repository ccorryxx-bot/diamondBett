function switchTab(tab) {
  const regForm = document.getElementById('registerForm');
  const logForm = document.getElementById('loginForm');
  if (regForm) regForm.style.display = tab === 'register' ? 'grid' : 'none';
  if (logForm) logForm.style.display = tab === 'login'    ? 'grid' : 'none';
  
  document.getElementById('tabRegister')?.classList.toggle('active', tab === 'register');
  document.getElementById('tabLogin')?.classList.toggle('active',    tab === 'login');
}

function toggleEye(id, btn) {
  const inp = document.getElementById(id);
  inp.type  = inp.type === 'password' ? 'text' : 'password';
  btn.style.color = inp.type === 'text' ? '#f5c518' : 'rgba(255,255,255,.4)';
}

// ============================================================
// PAGE NAVIGATION — SPA Style (Show/Hide)
// ============================================================
const PAGE_MAP = { 
  home: 'homePage', 
  tasks: 'tasksPage', 
  agent: 'agentPage', 
  cs: 'csPage', 
  account: 'accountPage',
  admin: 'adminPage'
};

function showPage(nav) {
  const targetId = PAGE_MAP[nav];
  if (!targetId) return;

  // Update Panel Visibility
  Object.values(PAGE_MAP).forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.classList.toggle('active', id === targetId);
      if (id === targetId) el.scrollTop = 0;
    }
  });

  // Update Nav Active State
  document.querySelectorAll('.bnav-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.nav === nav));

  // Admin init hook
  if (nav === 'admin' && typeof initAdminDashboard === 'function') {
    initAdminDashboard();
  }
}

function initScrollObserver() {
  console.log('SPA Mode: ScrollObserver disabled');
}

// ============================================================
// BANNER — dynamic count
// ============================================================
function initBanner() {
  // Select all instances of banners (Home & Agent)
  const tracks = document.querySelectorAll('.banner-track');
  const wraps  = document.querySelectorAll('.banner-wrap');
  if (!tracks.length) return;

  let cur = 0, tmr = null;
  const count   = () => tracks[0].querySelectorAll('.banner-slide').length;
  const update  = () => {
    const n = count(); if (!n) return;
    tracks.forEach(track => track.style.transform = `translateX(-${cur * 100}%)`);
    document.querySelectorAll('.banner-dots').forEach(dotWrap => {
      dotWrap.querySelectorAll('.dot').forEach((d, i) => d.classList.toggle('active', i === cur));
    });
  };
  const go      = n => { const c = count(); if (!c) return; cur = ((n % c) + c) % c; update(); };
  const start   = () => { clearInterval(tmr); tmr = setInterval(() => go(cur + 1), 4000); };
  const restart = () => { cur = 0; update(); start(); };

  document.addEventListener('click', e => {
    const dot = e.target.closest('.dot');
    if (dot) { go(+dot.dataset.i); start(); }
  });

  wraps.forEach(wrap => {
    let sx = 0;
    wrap.addEventListener('touchstart', e => { sx = e.touches[0].clientX; }, { passive: true });
    wrap.addEventListener('touchend',   e => {
      const diff = sx - e.changedTouches[0].clientX;
      if (Math.abs(diff) > 40) go(diff > 0 ? cur + 1 : cur - 1);
      start();
    }, { passive: true });
  });

  update(); start();
  window._restartBanner = restart;
}

function initLangBtn() {
  document.getElementById('langBtn')?.addEventListener('click', () => {
    const lbl = document.getElementById('langLabel');
    if (lbl) lbl.textContent = lbl.textContent === 'မြန်မာ' ? 'EN' : 'မြန်မာ';
  });
}

function initCatItems() {
  document.querySelectorAll('.cat-item').forEach(item => {
    item.addEventListener('click', () => {
      document.querySelectorAll('.cat-item').forEach(el => el.classList.remove('active'));
      item.classList.add('active');
      const catMap = { all:'all', show:'show', slot:'slot', arcade:'arcade', live:'live', fish:'fish', sport:'sport', lottery:'lottery' };
      if (typeof filterGames === 'function') filterGames(catMap[item.dataset.cat] || 'all');
    });
  });
}

async function refreshBalance() {
  if (!window.currentUserId) return;
  // Spinner for all refresh buttons
  const btns = document.querySelectorAll('#balRefreshBtn');
  btns.forEach(btn => btn.classList.add('spinning'));
  
  try {
    const { data } = await window.DB.from('users').select('balance').eq('id', window.currentUserId).single();
    if (data) {
      const bal  = parseFloat(data.balance || 0);
      const fmt2 = bal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      // Update all balance displays
      document.querySelectorAll('#qnavBalance').forEach(el => el.textContent = fmt2);
    }
  } catch (e) { console.error('Balance refresh:', e); }
  finally { btns.forEach(btn => btn.classList.remove('spinning')); }
}

function initBalRefresh() {
  document.querySelectorAll('#balRefreshBtn').forEach(btn => {
    btn.addEventListener('click', refreshBalance);
  });
}

// ============================================================
// AGENT HOLOGRAM ORB — Canvas 2D + rAF animation
// ============================================================
function initAgentOrb() {
  const canvas = document.getElementById('agentOrb');
  if (!canvas) return;

  const dpr = Math.max(window.devicePixelRatio || 1, 1);
  const sz  = 32;
  canvas.width        = sz * dpr;
  canvas.height       = sz * dpr;
  canvas.style.width  = sz + 'px';
  canvas.style.height = sz + 'px';

  const ctx = canvas.getContext('2d');
  const cx = sz / 2, cy = sz / 2;

  // 3 hologram rings — different tilt, speed, hue
  const RINGS = [
    { tiltBase: 0.35, speed:  0.00090, phase: 0,               hue: 185 },
    { tiltBase: 1.05, speed: -0.00055, phase: Math.PI / 3,      hue: 200 },
    { tiltBase: 1.65, speed:  0.00120, phase: (Math.PI * 2) / 3, hue: 165 },
  ];

  // Light trail dots — 2 per ring
  const TRAILS = RINGS.flatMap((ring, ri) =>
    [0, 1].map(k => ({ angle: k * Math.PI + ring.phase, ri }))
  );

  function draw(t) {
    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, sz, sz);

    const sin1 = Math.sin(t * 0.0020);
    const sin2 = Math.sin(t * 0.0013);

    // ── Ambient outer glow ──
    const ambient = ctx.createRadialGradient(cx, cy, 0, cx, cy, 16);
    ambient.addColorStop(0,   'rgba(0,200,255,0.10)');
    ambient.addColorStop(0.6, 'rgba(0,100,200,0.04)');
    ambient.addColorStop(1,   'rgba(0,0,0,0)');
    ctx.beginPath(); ctx.arc(cx, cy, 16, 0, Math.PI * 2);
    ctx.fillStyle = ambient; ctx.fill();

    // ── Hologram rings ──
    for (const ring of RINGS) {
      const rot = t * ring.speed + ring.phase;
      const tilt = ring.tiltBase + Math.sin(t * 0.0004 + ring.phase) * 0.25;
      const rx = 11;
      const ry = Math.max(0.5, rx * Math.abs(Math.cos(tilt)));
      const alpha = 0.45 + 0.30 * Math.sin(t * 0.0016 + ring.phase);

      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(rot);

      // Ring glow (drawn twice — blur layer first)
      ctx.beginPath();
      ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
      ctx.strokeStyle = `hsla(${ring.hue},100%,70%,${alpha * 0.5})`;
      ctx.lineWidth   = 2.4;
      ctx.shadowColor = `hsl(${ring.hue},100%,65%)`;
      ctx.shadowBlur  = 6 * dpr;
      ctx.stroke();
      ctx.shadowBlur  = 0;

      // Ring sharp line
      ctx.beginPath();
      ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
      ctx.strokeStyle = `hsla(${ring.hue},100%,78%,${alpha})`;
      ctx.lineWidth   = 0.7;
      ctx.stroke();

      ctx.restore();
    }

    // ── Scanner line sweep ──
    const scanY   = cy + 11 * Math.sin(t * 0.0017);
    const scanA   = 0.22 + 0.14 * sin2;
    const scanGrd = ctx.createLinearGradient(cx - 12, scanY, cx + 12, scanY);
    scanGrd.addColorStop(0,   'rgba(0,255,200,0)');
    scanGrd.addColorStop(0.35, `rgba(0,255,200,${scanA})`);
    scanGrd.addColorStop(0.65, `rgba(0,220,255,${scanA})`);
    scanGrd.addColorStop(1,   'rgba(0,255,200,0)');
    ctx.beginPath();
    ctx.moveTo(cx - 12, scanY); ctx.lineTo(cx + 12, scanY);
    ctx.strokeStyle = scanGrd;
    ctx.lineWidth   = 0.9;
    ctx.stroke();

    // ── Light trails on rings ──
    for (const tr of TRAILS) {
      const ring = RINGS[tr.ri];
      tr.angle  += ring.speed * 10;
      const rot  = t * ring.speed + ring.phase;
      const tilt = ring.tiltBase + Math.sin(t * 0.0004 + ring.phase) * 0.25;
      const rx   = 11, ry = Math.max(0.5, rx * Math.abs(Math.cos(tilt)));

      const ex = cx + rx * Math.cos(tr.angle + rot);
      const ey = cy + ry * Math.sin(tr.angle + rot);
      const pa = 0.55 + 0.45 * Math.abs(Math.sin(t * 0.003 + tr.angle));

      ctx.beginPath();
      ctx.arc(ex, ey, 1.6, 0, Math.PI * 2);
      ctx.fillStyle   = `hsla(${ring.hue},100%,85%,${pa})`;
      ctx.shadowColor = `hsl(${ring.hue},100%,70%)`;
      ctx.shadowBlur  = 7 * dpr;
      ctx.fill();
      ctx.shadowBlur  = 0;
    }

    // ── Core sphere — pulsing bright center ──
    const cPulse = 0.70 + 0.30 * sin1;
    const core   = ctx.createRadialGradient(cx - 1, cy - 1, 0, cx, cy, 6 * cPulse);
    core.addColorStop(0,   'rgba(220,255,255,1)');
    core.addColorStop(0.3, 'rgba(0,220,255,0.85)');
    core.addColorStop(0.7, 'rgba(0,130,220,0.40)');
    core.addColorStop(1,   'rgba(0,80,180,0)');
    ctx.beginPath(); ctx.arc(cx, cy, 6 * cPulse, 0, Math.PI * 2);
    ctx.fillStyle   = core;
    ctx.shadowColor = 'rgba(0,220,255,1)';
    ctx.shadowBlur  = 10 * dpr;
    ctx.fill();
    ctx.shadowBlur  = 0;

    // ── Hard white center pinpoint ──
    ctx.beginPath(); ctx.arc(cx, cy, 1.8, 0, Math.PI * 2);
    ctx.fillStyle   = 'rgba(255,255,255,0.98)';
    ctx.shadowColor = 'rgba(180,240,255,1)';
    ctx.shadowBlur  = 8 * dpr;
    ctx.fill();
    ctx.shadowBlur  = 0;

    // ── Outer boundary ring (faint) ──
    const bA = 0.12 + 0.08 * sin2;
    ctx.beginPath(); ctx.arc(cx, cy, 14, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(0,200,255,${bA})`;
    ctx.lineWidth   = 0.8;
    ctx.stroke();

    ctx.restore();
    requestAnimationFrame(draw);
  }

  requestAnimationFrame(draw);
}

// ============================================================
// CYBERPUNK NFT AVATAR — unique per userId, Canvas 2D + rAF
// ============================================================
const _nftAnims = new Map();

function _nftRoundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

// canvasId — target canvas element id
// sz       — CSS display size in px (canvas draws in 30×30 logical space, scaled to sz)
function generateNFTAvatar(userId, canvasId = 'nftAvatar', sz = 30) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;

  if (_nftAnims.has(canvasId)) { cancelAnimationFrame(_nftAnims.get(canvasId)); _nftAnims.delete(canvasId); }

  const dpr   = Math.max(window.devicePixelRatio || 1, 1);
  const base  = 30;                       // logical drawing space
  const scale = (sz / base) * dpr;
  canvas.width        = sz * dpr;
  canvas.height       = sz * dpr;
  canvas.style.width  = sz + 'px';
  canvas.style.height = sz + 'px';

  const ctx = canvas.getContext('2d');

  // Deterministic hash → unique colors per user
  const s = String(userId || 'anon');
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) & 0x7fffffff;

  const hue  = h % 360;
  const hue2 = (hue + 150) % 360;

  // Floating particles — deterministic positions & velocities in 30×30 space
  const pts = Array.from({ length: 4 }, (_, i) => ({
    x : 2 + ((h >> (i * 4)) & 0x1f) % 26,
    y : 2 + ((h >> (i * 3)) & 0x1f) % 26,
    vx: (((h >> (i * 7 + 2)) & 3) - 1.5) * 0.22,
    vy: (((h >> (i * 6 + 1)) & 3) - 1.5) * 0.22,
    r : 0.7 + ((h >> i) & 1) * 0.5,
  }));

  function draw(t) {
    ctx.save();
    ctx.scale(scale, scale);              // one scale handles both DPR and size
    ctx.clearRect(0, 0, base, base);

    const cx   = base / 2, cy = base / 2;
    const sin1 = Math.sin(t * 0.0018);
    const sin2 = Math.sin(t * 0.0011);

    // Background dark gradient
    const bg = ctx.createRadialGradient(cx, cy - 2, 0, cx, cy, 18);
    bg.addColorStop(0, `hsl(${hue},55%,12%)`);
    bg.addColorStop(1, '#04040e');
    _nftRoundRect(ctx, 0, 0, base, base, 7);
    ctx.fillStyle = bg;
    ctx.fill();

    // Helmet body — trapezoid
    ctx.beginPath();
    ctx.moveTo(8, 9); ctx.lineTo(22, 9);
    ctx.lineTo(24, 27); ctx.lineTo(6, 27);
    ctx.closePath();
    const hg = ctx.createLinearGradient(8, 9, 22, 27);
    hg.addColorStop(0, `hsl(${hue},48%,18%)`);
    hg.addColorStop(1, `hsl(${hue},38%,8%)`);
    ctx.fillStyle = hg;
    ctx.fill();

    // Dome top
    ctx.beginPath();
    ctx.ellipse(cx, 10, 8, 6, 0, Math.PI, 0);
    ctx.fillStyle = `hsl(${hue},42%,14%)`;
    ctx.fill();

    // Visor — animated brightness flicker
    const vA = 0.72 + 0.28 * sin1;
    const vg  = ctx.createLinearGradient(6, 16, 24, 21);
    vg.addColorStop(0,    `hsla(${hue}, 100%,65%,0)`);
    vg.addColorStop(0.25, `hsla(${hue}, 100%,65%,${vA})`);
    vg.addColorStop(0.75, `hsla(${hue2},100%,62%,${vA * 0.9})`);
    vg.addColorStop(1,    `hsla(${hue2},100%,62%,0)`);
    _nftRoundRect(ctx, 6, 14.5, 18, 5, 2);
    ctx.fillStyle = vg;
    ctx.fill();

    // Visor scanline highlight
    _nftRoundRect(ctx, 8, 15, 14, 1.5, 1);
    ctx.fillStyle = `rgba(255,255,255,${0.1 + 0.07 * sin2})`;
    ctx.fill();

    // Visor outer glow stroke
    ctx.shadowColor = `hsl(${hue},100%,65%)`;
    ctx.shadowBlur  = 5 * dpr;
    _nftRoundRect(ctx, 6, 14.5, 18, 5, 2);
    ctx.strokeStyle = `hsla(${hue},100%,72%,0.65)`;
    ctx.lineWidth   = 0.6;
    ctx.stroke();
    ctx.shadowBlur  = 0;

    // Circuit detail lines — chin area
    ctx.beginPath();
    ctx.moveTo(9,  23); ctx.lineTo(9,  25);
    ctx.moveTo(15, 23); ctx.lineTo(15, 26);
    ctx.moveTo(21, 23); ctx.lineTo(21, 25);
    ctx.strokeStyle = `hsla(${hue},80%,65%,0.35)`;
    ctx.lineWidth   = 0.5;
    ctx.stroke();

    // Border glow pulse
    const bA = 0.35 + 0.25 * sin2;
    _nftRoundRect(ctx, 0.5, 0.5, base - 1, base - 1, 6.5);
    ctx.strokeStyle = `hsla(${hue},100%,65%,${bA})`;
    ctx.lineWidth   = 1;
    ctx.stroke();

    // Floating neon particles
    for (const p of pts) {
      p.x += p.vx; p.y += p.vy;
      if (p.x < 1 || p.x > base - 1) p.vx *= -1;
      if (p.y < 1 || p.y > base - 1) p.vy *= -1;
      const pa = 0.35 + 0.65 * Math.abs(Math.sin(t * 0.002 + p.x * 0.3));
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle   = `hsla(${hue2},100%,72%,${pa})`;
      ctx.shadowColor = `hsl(${hue2},100%,65%)`;
      ctx.shadowBlur  = 4 * dpr;
      ctx.fill();
      ctx.shadowBlur  = 0;
    }

    ctx.restore();
    _nftAnims.set(canvasId, requestAnimationFrame(draw));
  }

  _nftAnims.set(canvasId, requestAnimationFrame(draw));
}
