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

// initBanner() — moved to js/swiper.js (DiamondSwiper)

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
// ANIME HYBRID NFT AVATAR — Gen-Z Futuristic | unique per userId
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

function generateNFTAvatar(userId, canvasId = 'nftAvatar', sz = 30) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;

  if (_nftAnims.has(canvasId)) { cancelAnimationFrame(_nftAnims.get(canvasId)); _nftAnims.delete(canvasId); }

  const dpr   = Math.max(window.devicePixelRatio || 1, 1);
  const base  = 30;
  const scale = (sz / base) * dpr;
  canvas.width        = sz * dpr;
  canvas.height       = sz * dpr;
  canvas.style.width  = sz + 'px';
  canvas.style.height = sz + 'px';

  const ctx = canvas.getContext('2d');

  // Deterministic hash — unique identity per user
  const s = String(userId || 'anon');
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) & 0x7fffffff;

  const bgHue    = h % 360;
  const hairIdx  = (h >> 8) % 7;
  const eyeHue   = (h >> 4) % 360;
  const outHue   = (bgHue + 165) % 360;
  const HAIR     = ['#a855f7','#3b82f6','#ec4899','#06b6d4','#e2e8f0','#22c55e','#f59e0b'];
  const hairCol  = HAIR[hairIdx];

  // Floating neon particles
  const pts = Array.from({ length: 5 }, (_, i) => ({
    x : 2 + ((h >> (i * 4)) & 0x1f) % 26,
    y : 2 + ((h >> (i * 3)) & 0x1f) % 26,
    vx: (((h >> (i * 7 + 2)) & 3) - 1.5) * 0.16,
    vy: (((h >> (i * 6 + 1)) & 3) - 1.5) * 0.16,
    r : 0.45 + ((h >> i) & 1) * 0.35,
  }));

  function draw(t) {
    ctx.save();
    ctx.scale(scale, scale);
    ctx.clearRect(0, 0, base, base);

    const cx = base / 2, cy = base / 2;
    const g1 = Math.sin(t * 0.0015) * 0.5 + 0.5;   // 0-1 slow breathe
    const g2 = Math.sin(t * 0.0023 + 1.2) * 0.5 + 0.5;

    // ── Background ─────────────────────────────────────────
    const bg = ctx.createRadialGradient(cx, cy - 1, 0, cx, cy + 4, 18);
    bg.addColorStop(0, `hsl(${bgHue},55%,9%)`);
    bg.addColorStop(0.65, `hsl(${bgHue},38%,5%)`);
    bg.addColorStop(1, '#010106');
    _nftRoundRect(ctx, 0, 0, base, base, 7);
    ctx.fillStyle = bg; ctx.fill();

    // Aura glow behind head
    const aura = ctx.createRadialGradient(cx, 13, 0, cx, 13, 13);
    aura.addColorStop(0, `hsla(${bgHue},90%,55%,${0.06 + g1 * 0.05})`);
    aura.addColorStop(1, 'transparent');
    ctx.fillStyle = aura; ctx.fillRect(0, 0, base, base);

    // ── Outfit / shoulders ──────────────────────────────────
    ctx.beginPath();
    ctx.moveTo(0, base); ctx.lineTo(6, 22); ctx.lineTo(24, 22); ctx.lineTo(base, base);
    ctx.closePath();
    const outG = ctx.createLinearGradient(0, 22, 0, base);
    outG.addColorStop(0, `hsl(${outHue},65%,13%)`);
    outG.addColorStop(1, `hsl(${outHue},50%,6%)`);
    ctx.fillStyle = outG; ctx.fill();
    // Neon collar line
    ctx.beginPath();
    ctx.moveTo(6, 22); ctx.lineTo(24, 22);
    ctx.strokeStyle = `hsla(${bgHue},100%,65%,${0.55 + g1 * 0.35})`;
    ctx.lineWidth = 0.45; ctx.stroke();
    // Collar center gem
    const gemG = ctx.createRadialGradient(cx, 22, 0, cx, 22, 1.2);
    gemG.addColorStop(0, `hsla(${bgHue},100%,80%,${0.9 + g2 * 0.1})`);
    gemG.addColorStop(1, `hsla(${bgHue},80%,50%,0.4)`);
    ctx.beginPath(); ctx.arc(cx, 22, 1.0, 0, Math.PI * 2);
    ctx.fillStyle = gemG; ctx.fill();

    // ── Neck ────────────────────────────────────────────────
    _nftRoundRect(ctx, 12.5, 20.5, 5, 3, 1);
    ctx.fillStyle = '#d4956a'; ctx.fill();

    // ── Face ────────────────────────────────────────────────
    const faceG = ctx.createRadialGradient(cx - 1, 12, 1, cx, 15, 9.5);
    faceG.addColorStop(0, '#f9c8a0');
    faceG.addColorStop(0.65, '#ebb07a');
    faceG.addColorStop(1, '#c07848');
    ctx.beginPath();
    ctx.ellipse(cx, 15, 7.8, 9.2, 0, 0, Math.PI * 2);
    ctx.fillStyle = faceG; ctx.fill();

    // ── Hair — back layer ───────────────────────────────────
    ctx.beginPath();
    ctx.ellipse(cx, 9.5, 9, 9.5, 0, Math.PI, 0);
    ctx.fillStyle = hairCol; ctx.fill();
    // Side strands
    ctx.strokeStyle = hairCol; ctx.lineWidth = 2.8;
    ctx.beginPath();
    ctx.moveTo(7, 11); ctx.quadraticCurveTo(4.5, 17, 6.5, 23);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(23, 11); ctx.quadraticCurveTo(25.5, 17, 23.5, 23);
    ctx.stroke();
    // Bangs front
    ctx.beginPath();
    ctx.moveTo(7, 9);
    ctx.quadraticCurveTo(12, 5.5, cx, 6.5);
    ctx.quadraticCurveTo(cx + 4, 5.5, 23, 9.5);
    ctx.lineTo(22, 8); ctx.lineTo(cx + 1, 5); ctx.lineTo(cx - 1, 5); ctx.lineTo(7, 8);
    ctx.closePath();
    ctx.fillStyle = hairCol; ctx.fill();
    // Hair shine highlight
    ctx.beginPath();
    ctx.moveTo(11, 7.5); ctx.quadraticCurveTo(cx, 5.2, cx + 4, 7.5);
    ctx.strokeStyle = 'rgba(255,255,255,0.22)';
    ctx.lineWidth = 0.9; ctx.stroke();

    // ── Eyes ────────────────────────────────────────────────
    const ey = 14.5, lx = 11, rx = 19;
    [lx, rx].forEach(ex => {
      // Glow aura
      const eg = ctx.createRadialGradient(ex, ey, 0, ex, ey, 3);
      eg.addColorStop(0, `hsla(${eyeHue},100%,65%,${0.45 + g2 * 0.35})`);
      eg.addColorStop(1, 'transparent');
      ctx.fillStyle = eg;
      ctx.beginPath(); ctx.ellipse(ex, ey, 3, 3, 0, 0, Math.PI * 2);
      ctx.fill();
      // White sclera
      ctx.beginPath(); ctx.ellipse(ex, ey, 2.1, 1.4, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#fff'; ctx.fill();
      // Colored iris
      ctx.beginPath(); ctx.ellipse(ex, ey, 1.15, 1.15, 0, 0, Math.PI * 2);
      ctx.fillStyle = `hsl(${eyeHue},85%,58%)`; ctx.fill();
      // Pupil
      ctx.beginPath(); ctx.ellipse(ex, ey, 0.6, 0.6, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#050510'; ctx.fill();
      // Eye shine
      ctx.beginPath(); ctx.ellipse(ex - 0.45, ey - 0.45, 0.32, 0.32, 0, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.92)'; ctx.fill();
      // Top lash
      ctx.beginPath(); ctx.ellipse(ex, ey - 0.6, 2.3, 0.65, 0, Math.PI, 0);
      ctx.fillStyle = '#0d0d18'; ctx.fill();
    });

    // ── Nose ────────────────────────────────────────────────
    ctx.beginPath();
    ctx.moveTo(cx - 0.9, 18.8); ctx.lineTo(cx, 19.8); ctx.lineTo(cx + 0.9, 18.8);
    ctx.strokeStyle = 'rgba(0,0,0,0.22)'; ctx.lineWidth = 0.55; ctx.stroke();

    // ── Lips ────────────────────────────────────────────────
    ctx.beginPath();
    ctx.moveTo(cx - 2.2, 21.2);
    ctx.quadraticCurveTo(cx, 22.8, cx + 2.2, 21.2);
    ctx.strokeStyle = '#c06858'; ctx.lineWidth = 0.85; ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx - 1.5, 21.2);
    ctx.quadraticCurveTo(cx, 22, cx + 1.5, 21.2);
    ctx.strokeStyle = 'rgba(230,130,110,0.6)'; ctx.lineWidth = 0.6; ctx.stroke();

    // ── Cheek blush ─────────────────────────────────────────
    [[lx - 0.5, 18.5], [rx + 0.5, 18.5]].forEach(([bx, by]) => {
      const bl = ctx.createRadialGradient(bx, by, 0, bx, by, 2.8);
      bl.addColorStop(0, 'rgba(255,140,140,0.16)');
      bl.addColorStop(1, 'transparent');
      ctx.fillStyle = bl;
      ctx.beginPath(); ctx.ellipse(bx, by, 2.8, 1.6, 0, 0, Math.PI * 2);
      ctx.fill();
    });

    // ── Cyber circuit overlay (right cheek) ─────────────────
    const cc = `hsla(${bgHue},100%,68%,${0.28 + g1 * 0.22})`;
    ctx.strokeStyle = cc; ctx.lineWidth = 0.38;
    ctx.beginPath();
    ctx.moveTo(19.5, 16.5); ctx.lineTo(23, 16.5);
    ctx.lineTo(23, 18); ctx.lineTo(25, 18);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(22, 15.5); ctx.lineTo(22, 13.5);
    ctx.stroke();
    ctx.beginPath(); ctx.arc(23, 16.5, 0.5, 0, Math.PI * 2);
    ctx.fillStyle = `hsla(${bgHue},100%,75%,${0.65 + g1 * 0.3})`;
    ctx.fill();
    // Left side subtle mark
    ctx.strokeStyle = `hsla(${eyeHue},90%,65%,${0.18 + g2 * 0.14})`;
    ctx.lineWidth = 0.35;
    ctx.beginPath();
    ctx.moveTo(7, 17); ctx.lineTo(5, 17); ctx.lineTo(5, 18.5);
    ctx.stroke();

    // ── Floating neon particles ──────────────────────────────
    pts.forEach(p => {
      p.x += p.vx; p.y += p.vy;
      if (p.x < 0.5 || p.x > base - 0.5) p.vx *= -1;
      if (p.y < 0.5 || p.y > base - 0.5) p.vy *= -1;
      const pg = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 2.8);
      pg.addColorStop(0, `hsla(${bgHue},100%,78%,0.85)`);
      pg.addColorStop(1, 'transparent');
      ctx.fillStyle = pg;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 2.8, 0, Math.PI * 2);
      ctx.fill();
    });

    ctx.restore();
    _nftAnims.set(canvasId, requestAnimationFrame(draw));
  }

  _nftAnims.set(canvasId, requestAnimationFrame(draw));
}
