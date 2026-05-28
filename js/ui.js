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
// ANIME HYBRID NFT AVATAR — 6 Unique Archetypes | Gen-Z Futuristic
// ============================================================
const _nftAnims = new Map();

function _nftRoundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y);
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

  const dpr = Math.max(window.devicePixelRatio || 1, 1);
  const base = 30;
  const scale = (sz / base) * dpr;
  canvas.width = sz * dpr; canvas.height = sz * dpr;
  canvas.style.width = sz + 'px'; canvas.style.height = sz + 'px';
  const ctx = canvas.getContext('2d');

  // Deterministic identity hash
  const s = String(userId || 'anon');
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) & 0x7fffffff;

  const charType  = h % 6;                        // 0-5 archetype
  const hue       = (h >> 3) % 360;               // main accent hue
  const hue2      = (hue + 140 + (h >> 10) % 80) % 360;
  const hairIdx   = (h >> 8) % 8;
  const HAIR_COLS = ['#e8e8f0','#a78bfa','#3b82f6','#ec4899','#06b6d4','#22c55e','#f59e0b','#ef4444'];
  const hairCol   = HAIR_COLS[hairIdx];
  const eyeHue    = (h >> 4) % 360;
  const skinPal   = (h >> 14) % 3;
  const SKINS     = [['#f9c8a0','#e8a070','#c07848'],['#fde68a','#f59e0b','#b45309'],['#fca5a5','#f87171','#dc2626']];
  const skin      = SKINS[skinPal];

  // Particles — unique per user
  const pts = Array.from({length:5},(_,i)=>({
    x:3+((h>>(i*4))&0x1f)%24, y:3+((h>>(i*3))&0x1f)%24,
    vx:(((h>>(i*7+2))&3)-1.5)*0.17, vy:(((h>>(i*6+1))&3)-1.5)*0.17,
    r:0.4+((h>>i)&1)*0.35,
  }));

  function draw(t) {
    ctx.save();
    ctx.scale(scale, scale);
    ctx.clearRect(0, 0, base, base);
    const cx = base/2, cy = base/2;
    const g1 = Math.sin(t*0.0014)*0.5+0.5;
    const g2 = Math.sin(t*0.0021+1.3)*0.5+0.5;
    const g3 = Math.sin(t*0.0009+2.1)*0.5+0.5;

    _nftRoundRect(ctx, 0, 0, base, base, 7);
    ctx.save(); ctx.clip();

    // ═══════════════════════════════════════════════
    if (charType === 0) {
      // ── TYPE 0: CYBER ANDROID ─── silver hair, tech overlays, blue bg
      const bgG = ctx.createLinearGradient(0,0,base,base);
      bgG.addColorStop(0, `hsl(${200+hue%40},70%,12%)`);
      bgG.addColorStop(1, `hsl(${190+hue%40},60%,6%)`);
      ctx.fillStyle = bgG; ctx.fillRect(0,0,base,base);
      // scan line
      const scanY = (t * 0.025) % (base+4) - 2;
      ctx.fillStyle = `rgba(0,220,255,${0.04+g1*0.03})`;
      ctx.fillRect(0, scanY, base, 1.2);

      // Neck
      _nftRoundRect(ctx,12.5,20.5,5,4,1); ctx.fillStyle=skin[1]; ctx.fill();
      // Shoulders — dark suit
      ctx.beginPath(); ctx.moveTo(0,base); ctx.lineTo(5,22); ctx.lineTo(25,22); ctx.lineTo(base,base); ctx.closePath();
      ctx.fillStyle=`hsl(${200+hue%40},50%,9%)`; ctx.fill();
      ctx.beginPath(); ctx.moveTo(5,22); ctx.lineTo(25,22);
      ctx.strokeStyle=`hsla(${190},100%,65%,${0.5+g1*0.4})`; ctx.lineWidth=0.5; ctx.stroke();

      // Face
      const fG=ctx.createRadialGradient(cx-1,12,0,cx,15,9);
      fG.addColorStop(0,'#f0f0f8'); fG.addColorStop(0.7,'#d8d8e8'); fG.addColorStop(1,'#b0b0c8');
      ctx.beginPath(); ctx.ellipse(cx,15,7.5,9,0,0,Math.PI*2); ctx.fillStyle=fG; ctx.fill();

      // Hair — white/silver short
      ctx.beginPath(); ctx.ellipse(cx,9,8.5,9,0,Math.PI,0); ctx.fillStyle='#e8eaf0'; ctx.fill();
      ctx.beginPath(); ctx.moveTo(7,10); ctx.quadraticCurveTo(5,16,7,21); ctx.strokeStyle='#dde0ec'; ctx.lineWidth=2.8; ctx.stroke();
      ctx.beginPath(); ctx.moveTo(23,10); ctx.quadraticCurveTo(25,16,23,21); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(7,9); ctx.quadraticCurveTo(cx,5.5,cx,6.5); ctx.quadraticCurveTo(cx+3,5.5,23,9.5); ctx.lineTo(22,8); ctx.lineTo(cx,5); ctx.lineTo(7,8); ctx.closePath(); ctx.fillStyle='#e0e3f0'; ctx.fill();
      ctx.beginPath(); ctx.moveTo(10,7); ctx.quadraticCurveTo(cx,5,cx+4,7); ctx.strokeStyle='rgba(255,255,255,0.45)'; ctx.lineWidth=0.9; ctx.stroke();

      // Tech headband
      ctx.beginPath(); ctx.moveTo(6.5,9); ctx.lineTo(23.5,9); ctx.strokeStyle=`hsla(${190+hue%40},100%,65%,0.85)`; ctx.lineWidth=0.7; ctx.stroke();
      for(let i=0;i<4;i++){ctx.beginPath();ctx.arc(8+i*4.5,9,0.45,0,Math.PI*2);ctx.fillStyle=`hsla(${190+hue%40},100%,75%,${0.7+g1*0.3})`;ctx.fill();}

      // Eyes — large android style
      const ey=14.5,lx=11,rx=19;
      [lx,rx].forEach(ex=>{
        const eg=ctx.createRadialGradient(ex,ey,0,ex,ey,3);
        eg.addColorStop(0,`hsla(195,100%,70%,${0.5+g2*0.4})`); eg.addColorStop(1,'transparent');
        ctx.fillStyle=eg; ctx.beginPath(); ctx.ellipse(ex,ey,3,3,0,0,Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(ex,ey,2.1,1.5,0,0,Math.PI*2); ctx.fillStyle='#fff'; ctx.fill();
        ctx.beginPath(); ctx.ellipse(ex,ey,1.2,1.2,0,0,Math.PI*2); ctx.fillStyle=`hsl(195,100%,55%)`; ctx.fill();
        ctx.beginPath(); ctx.ellipse(ex,ey,0.6,0.6,0,0,Math.PI*2); ctx.fillStyle='#000d1a'; ctx.fill();
        ctx.beginPath(); ctx.ellipse(ex-0.4,ey-0.5,0.32,0.32,0,0,Math.PI*2); ctx.fillStyle='rgba(255,255,255,0.95)'; ctx.fill();
        // Scan line on eye
        ctx.beginPath(); ctx.moveTo(ex-2,ey); ctx.lineTo(ex+2,ey); ctx.strokeStyle=`rgba(0,220,255,${0.3+g1*0.3})`; ctx.lineWidth=0.25; ctx.stroke();
        ctx.beginPath(); ctx.ellipse(ex,ey-0.6,2.3,0.65,0,Math.PI,0); ctx.fillStyle='#0a0a1e'; ctx.fill();
      });
      // Tech patch on right cheek
      _nftRoundRect(ctx,18.5,16,5,3,0.6); ctx.fillStyle=`hsl(${200+hue%40},50%,14%)`; ctx.fill();
      ctx.strokeStyle=`hsla(195,100%,60%,${0.6+g1*0.3})`; ctx.lineWidth=0.35; ctx.stroke();
      for(let i=0;i<2;i++){ctx.beginPath();ctx.arc(19.5+i*2.5,17+0.5,0.4,0,Math.PI*2);ctx.fillStyle=i===0?`hsla(195,100%,70%,${0.8+g2*0.2})`:'#f59e0b';ctx.fill();}
      // Ear cable
      ctx.beginPath(); ctx.moveTo(23,15.5); ctx.quadraticCurveTo(26,16,25.5,20); ctx.strokeStyle=`hsla(195,80%,50%,0.6)`; ctx.lineWidth=0.5; ctx.stroke();

    } else if (charType === 1) {
      // ── TYPE 1: ANIME WARRIOR ─── intense eyes, face mark, dramatic
      const bgG=ctx.createRadialGradient(cx,cy,0,cx,cy,20);
      bgG.addColorStop(0,`hsl(${hue},40%,8%)`); bgG.addColorStop(1,'#050106');
      ctx.fillStyle=bgG; ctx.fillRect(0,0,base,base);
      // dramatic vignette
      const vig=ctx.createRadialGradient(cx,cy,8,cx,cy,18);
      vig.addColorStop(0,'transparent'); vig.addColorStop(1,'rgba(0,0,0,0.6)');
      ctx.fillStyle=vig; ctx.fillRect(0,0,base,base);

      // Neck + high collar
      _nftRoundRect(ctx,12.5,21,5,3,1); ctx.fillStyle=skin[0]; ctx.fill();
      ctx.beginPath(); ctx.moveTo(3,base); ctx.lineTo(7,22); ctx.lineTo(23,22); ctx.lineTo(27,base); ctx.closePath();
      ctx.fillStyle=`hsl(${hue},50%,10%)`; ctx.fill();
      ctx.beginPath(); ctx.moveTo(7,22); ctx.lineTo(cx-2,22); ctx.moveTo(cx+2,22); ctx.lineTo(23,22);
      ctx.strokeStyle=`hsl(${hue},90%,55%)`; ctx.lineWidth=0.55; ctx.stroke();
      // collar accent
      ctx.beginPath(); ctx.moveTo(cx-2,22); ctx.lineTo(cx,21); ctx.lineTo(cx+2,22);
      ctx.strokeStyle=`hsl(${hue},100%,65%)`; ctx.lineWidth=0.6; ctx.stroke();

      // Face
      const fG=ctx.createRadialGradient(cx,13,0,cx,15,9);
      fG.addColorStop(0,skin[0]); fG.addColorStop(0.7,skin[1]); fG.addColorStop(1,skin[2]);
      ctx.beginPath(); ctx.ellipse(cx,15,7.5,9,0,0,Math.PI*2); ctx.fillStyle=fG; ctx.fill();

      // Hair — long dramatic
      ctx.beginPath(); ctx.ellipse(cx,9,9,9.5,0,Math.PI,0); ctx.fillStyle=hairCol; ctx.fill();
      // Long side strands
      ctx.strokeStyle=hairCol; ctx.lineWidth=3.2;
      ctx.beginPath(); ctx.moveTo(7.5,11); ctx.quadraticCurveTo(4,18,5,30); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(22.5,11); ctx.quadraticCurveTo(26,18,25,30); ctx.stroke();
      // Front layer
      ctx.beginPath(); ctx.moveTo(7,9); ctx.quadraticCurveTo(cx-3,6,cx-1,6.5); ctx.quadraticCurveTo(cx+2,5.5,23,9); ctx.lineTo(22,7.5); ctx.lineTo(cx,4.8); ctx.lineTo(7,7.5); ctx.closePath(); ctx.fillStyle=hairCol; ctx.fill();
      ctx.lineWidth=2; ctx.beginPath(); ctx.moveTo(cx-2,6); ctx.quadraticCurveTo(cx,4,cx+1,6); ctx.strokeStyle=hairCol; ctx.stroke();
      ctx.beginPath(); ctx.moveTo(10,7.5); ctx.quadraticCurveTo(cx,5,cx+4,7.5); ctx.strokeStyle='rgba(255,255,255,0.2)'; ctx.lineWidth=0.9; ctx.stroke();

      // Warrior eye mark (under right eye)
      ctx.beginPath(); ctx.moveTo(18.5,17); ctx.lineTo(21.5,15.5); ctx.strokeStyle=`hsl(${hue},100%,60%)`; ctx.lineWidth=0.7; ctx.stroke();
      ctx.beginPath(); ctx.moveTo(19.5,17.5); ctx.lineTo(22,16.5); ctx.strokeStyle=`hsl(${hue},100%,70%)`; ctx.lineWidth=0.45; ctx.stroke();

      // Eyes — intense, slightly narrower
      const ey=14,lx=11,rx=19;
      [lx,rx].forEach(ex=>{
        const eg=ctx.createRadialGradient(ex,ey,0,ex,ey,2.5);
        eg.addColorStop(0,`hsla(${eyeHue},100%,65%,${0.55+g2*0.35})`); eg.addColorStop(1,'transparent');
        ctx.fillStyle=eg; ctx.beginPath(); ctx.ellipse(ex,ey,2.5,2.5,0,0,Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(ex,ey,2.1,1.25,0,0,Math.PI*2); ctx.fillStyle='#fefefe'; ctx.fill();
        ctx.beginPath(); ctx.ellipse(ex,ey,1.15,1.15,0,0,Math.PI*2); ctx.fillStyle=`hsl(${eyeHue},90%,55%)`; ctx.fill();
        ctx.beginPath(); ctx.ellipse(ex,ey,0.58,0.58,0,0,Math.PI*2); ctx.fillStyle='#04040c'; ctx.fill();
        ctx.beginPath(); ctx.ellipse(ex-0.4,ey-0.4,0.3,0.3,0,0,Math.PI*2); ctx.fillStyle='rgba(255,255,255,0.9)'; ctx.fill();
        // sharp lash
        ctx.beginPath(); ctx.moveTo(ex-2.2,ey-0.8); ctx.lineTo(ex+2.2,ey-0.8); ctx.quadraticCurveTo(ex+2.5,ey-1.2,ex+2.2,ey-0.4);
        ctx.lineWidth=0.9; ctx.strokeStyle='#050512'; ctx.stroke();
      });
      // Nose + lips
      ctx.beginPath(); ctx.moveTo(cx-0.8,18.5); ctx.lineTo(cx,19.5); ctx.lineTo(cx+0.8,18.5); ctx.strokeStyle='rgba(0,0,0,0.2)'; ctx.lineWidth=0.55; ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx-2,21); ctx.quadraticCurveTo(cx,22.5,cx+2,21); ctx.strokeStyle='#c06858'; ctx.lineWidth=0.85; ctx.stroke();

    } else if (charType === 2) {
      // ── TYPE 2: STREET NFT PUNK ─── vivid bg, face tattoo, attitude
      const BKGS = [`hsl(0,80%,15%)`,`hsl(270,60%,12%)`,`hsl(180,70%,10%)`,`hsl(45,80%,12%)`];
      ctx.fillStyle=BKGS[(h>>12)%4]; ctx.fillRect(0,0,base,base);
      const bgLine=ctx.createLinearGradient(0,0,base,base);
      bgLine.addColorStop(0,`hsla(${hue},80%,50%,0.08)`); bgLine.addColorStop(1,'transparent');
      ctx.fillStyle=bgLine; ctx.fillRect(0,0,base,base);

      // Shoulders
      ctx.beginPath(); ctx.moveTo(0,base); ctx.lineTo(4,22); ctx.lineTo(26,22); ctx.lineTo(base,base); ctx.closePath();
      ctx.fillStyle=`hsl(${hue},60%,14%)`; ctx.fill();
      ctx.strokeStyle=`hsl(${hue},100%,60%)`; ctx.lineWidth=0.55;
      ctx.beginPath(); ctx.moveTo(4,22); ctx.lineTo(26,22); ctx.stroke();

      // Face
      const fG=ctx.createRadialGradient(cx,13,0,cx,15,9);
      fG.addColorStop(0,skin[0]); fG.addColorStop(0.7,skin[1]); fG.addColorStop(1,skin[2]);
      ctx.beginPath(); ctx.ellipse(cx,15,7.5,9,0,0,Math.PI*2); ctx.fillStyle=fG; ctx.fill();

      // Hair — bold/spiky
      const spikeCol=hairCol;
      ctx.fillStyle=spikeCol;
      // Base hair
      ctx.beginPath(); ctx.ellipse(cx,9,8,8.5,0,Math.PI,0); ctx.fill();
      // Spikes
      for(let i=0;i<5;i++){
        const sx=8+i*3.5, sh=5+((h>>(i*3))&3);
        ctx.beginPath(); ctx.moveTo(sx-1.5,9); ctx.lineTo(sx,9-sh); ctx.lineTo(sx+1.5,9); ctx.closePath(); ctx.fill();
      }
      ctx.beginPath(); ctx.moveTo(11,7); ctx.quadraticCurveTo(cx,5.2,cx+3,7); ctx.strokeStyle='rgba(255,255,255,0.2)'; ctx.lineWidth=0.8; ctx.stroke();

      // Eyes — street style
      const ey=14.5,lx=11,rx=19;
      [lx,rx].forEach(ex=>{
        ctx.beginPath(); ctx.ellipse(ex,ey,2.1,1.4,0,0,Math.PI*2); ctx.fillStyle='#fff'; ctx.fill();
        ctx.beginPath(); ctx.ellipse(ex,ey,1.15,1.15,0,0,Math.PI*2); ctx.fillStyle=`hsl(${eyeHue},90%,50%)`; ctx.fill();
        ctx.beginPath(); ctx.ellipse(ex,ey,0.6,0.6,0,0,Math.PI*2); ctx.fillStyle='#04040c'; ctx.fill();
        ctx.beginPath(); ctx.ellipse(ex-0.4,ey-0.4,0.3,0.3,0,0,Math.PI*2); ctx.fillStyle='rgba(255,255,255,0.9)'; ctx.fill();
        ctx.beginPath(); ctx.ellipse(ex,ey-0.6,2.3,0.65,0,Math.PI,0); ctx.fillStyle='#0a0a0a'; ctx.fill();
      });
      // Face tattoo — left cheek geometric
      ctx.strokeStyle=`hsl(${hue},100%,65%)`; ctx.lineWidth=0.45;
      ctx.beginPath(); ctx.moveTo(8,15); ctx.lineTo(6,13); ctx.lineTo(8,12); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(8,15); ctx.lineTo(6,17); ctx.stroke();
      ctx.beginPath(); ctx.arc(8,15,0.45,0,Math.PI*2); ctx.fillStyle=`hsl(${hue},100%,65%)`; ctx.fill();
      // Nose
      ctx.beginPath(); ctx.moveTo(cx-0.8,18.5); ctx.lineTo(cx,19.5); ctx.lineTo(cx+0.8,18.5); ctx.strokeStyle='rgba(0,0,0,0.22)'; ctx.lineWidth=0.55; ctx.stroke();
      // Bold lips
      ctx.beginPath(); ctx.moveTo(cx-2.2,21); ctx.quadraticCurveTo(cx,22.8,cx+2.2,21); ctx.fillStyle=`hsl(${hue},80%,45%)`; ctx.fill();

    } else if (charType === 3) {
      // ── TYPE 3: NEON IDOL ─── soft pastel, sparkles, kawaii
      const bgG=ctx.createLinearGradient(0,0,base,base);
      bgG.addColorStop(0,`hsl(${290+hue%60},50%,10%)`); bgG.addColorStop(1,`hsl(${320+hue%40},60%,7%)`);
      ctx.fillStyle=bgG; ctx.fillRect(0,0,base,base);
      // Star sparkles bg
      [[5,5],[25,4],[3,20],[27,22],[14,3]].forEach(([sx,sy],i)=>{
        const ss=0.5+((h>>(i*4))&1)*0.4;
        ctx.beginPath(); ctx.arc(sx,sy,ss*(0.7+g1*0.5),0,Math.PI*2);
        ctx.fillStyle=`hsla(${hue+i*40},100%,85%,${0.5+g2*0.4})`; ctx.fill();
      });

      // Shoulders — idol outfit
      ctx.beginPath(); ctx.moveTo(2,base); ctx.lineTo(7,22); ctx.lineTo(23,22); ctx.lineTo(28,base); ctx.closePath();
      const idolG=ctx.createLinearGradient(0,22,0,base);
      idolG.addColorStop(0,`hsl(${290+hue%60},60%,18%)`); idolG.addColorStop(1,`hsl(${290+hue%60},50%,8%)`);
      ctx.fillStyle=idolG; ctx.fill();
      // Ribbon at collar
      ctx.beginPath(); ctx.moveTo(cx-2,22); ctx.lineTo(cx,24); ctx.lineTo(cx+2,22); ctx.fillStyle=`hsl(${hue},100%,65%)`; ctx.fill();

      // Face
      const fG=ctx.createRadialGradient(cx,13,0,cx,15,9);
      fG.addColorStop(0,'#fff0f5'); fG.addColorStop(0.6,'#ffd0e0'); fG.addColorStop(1,'#f0a0b0');
      ctx.beginPath(); ctx.ellipse(cx,15,7.5,9.2,0,0,Math.PI*2); ctx.fillStyle=fG; ctx.fill();

      // Hair — long flowing
      ctx.beginPath(); ctx.ellipse(cx,9,9,9.5,0,Math.PI,0); ctx.fillStyle=hairCol; ctx.fill();
      ctx.strokeStyle=hairCol; ctx.lineWidth=3;
      ctx.beginPath(); ctx.moveTo(7.5,11); ctx.quadraticCurveTo(4.5,18,6,28); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(22.5,11); ctx.quadraticCurveTo(25.5,18,24,28); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(7,9); ctx.quadraticCurveTo(cx-1,5.5,cx,6.5); ctx.quadraticCurveTo(cx+2,5.5,23,9.5); ctx.lineTo(22,7.5); ctx.lineTo(cx,4.5); ctx.lineTo(7,7.5); ctx.closePath(); ctx.fillStyle=hairCol; ctx.fill();
      ctx.beginPath(); ctx.moveTo(10,7.5); ctx.quadraticCurveTo(cx,5,cx+4,7.5); ctx.strokeStyle='rgba(255,255,255,0.3)'; ctx.lineWidth=1; ctx.stroke();
      // Hair bow/star accessory
      ctx.beginPath(); ctx.arc(20,7,1.5,0,Math.PI*2); ctx.fillStyle=`hsl(${hue},90%,65%)`; ctx.fill();
      ctx.beginPath(); ctx.arc(20,7,0.8,0,Math.PI*2); ctx.fillStyle=`hsl(${hue},100%,80%)`; ctx.fill();

      // Eyes — large idol eyes with sparkle
      const ey=14.3,lx=10.5,rx=19.5;
      [lx,rx].forEach(ex=>{
        const eg=ctx.createRadialGradient(ex,ey,0,ex,ey,3);
        eg.addColorStop(0,`hsla(${eyeHue},100%,70%,${0.4+g2*0.35})`); eg.addColorStop(1,'transparent');
        ctx.fillStyle=eg; ctx.beginPath(); ctx.ellipse(ex,ey,3,3,0,0,Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(ex,ey,2.3,1.7,0,0,Math.PI*2); ctx.fillStyle='#fff'; ctx.fill();
        ctx.beginPath(); ctx.ellipse(ex,ey,1.35,1.35,0,0,Math.PI*2); ctx.fillStyle=`hsl(${eyeHue},80%,60%)`; ctx.fill();
        ctx.beginPath(); ctx.ellipse(ex,ey,0.65,0.65,0,0,Math.PI*2); ctx.fillStyle='#02020c'; ctx.fill();
        // Extra sparkle in eye
        ctx.beginPath(); ctx.ellipse(ex-0.4,ey-0.5,0.35,0.35,0,0,Math.PI*2); ctx.fillStyle='rgba(255,255,255,0.95)'; ctx.fill();
        ctx.beginPath(); ctx.ellipse(ex+0.5,ey-0.2,0.2,0.2,0,0,Math.PI*2); ctx.fillStyle='rgba(255,255,255,0.7)'; ctx.fill();
        ctx.beginPath(); ctx.ellipse(ex,ey-0.7,2.5,0.7,0,Math.PI,0); ctx.fillStyle='#080818'; ctx.fill();
      });
      // Cheek blush — big idol style
      [[lx,18],[rx,18]].forEach(([bx,by])=>{
        const bl=ctx.createRadialGradient(bx,by,0,bx,by,3.2);
        bl.addColorStop(0,'rgba(255,120,150,0.25)'); bl.addColorStop(1,'transparent');
        ctx.fillStyle=bl; ctx.beginPath(); ctx.ellipse(bx,by,3.2,1.8,0,0,Math.PI*2); ctx.fill();
      });
      // Nose + lips
      ctx.beginPath(); ctx.arc(cx,19,0.5,0,Math.PI*2); ctx.fillStyle='rgba(200,100,120,0.35)'; ctx.fill();
      ctx.beginPath(); ctx.moveTo(cx-2,21.2); ctx.quadraticCurveTo(cx,23,cx+2,21.2); ctx.strokeStyle='#e06878'; ctx.lineWidth=0.9; ctx.stroke();

    } else if (charType === 4) {
      // ── TYPE 4: DARK PHANTOM ─── mysterious, one glowing eye
      ctx.fillStyle='#030207'; ctx.fillRect(0,0,base,base);
      const bgG=ctx.createRadialGradient(cx,cy,0,cx,cy,18);
      bgG.addColorStop(0,`hsl(${260+hue%80},50%,7%)`); bgG.addColorStop(1,'#010104');
      ctx.fillStyle=bgG; ctx.fillRect(0,0,base,base);

      // Neck
      _nftRoundRect(ctx,12.5,21,5,3,1); ctx.fillStyle=`hsl(${hue},15%,25%)`; ctx.fill();
      // Cloak/hood shoulders
      ctx.beginPath(); ctx.moveTo(0,base); ctx.lineTo(2,20); ctx.lineTo(28,20); ctx.lineTo(base,base); ctx.closePath();
      ctx.fillStyle=`hsl(${260+hue%80},30%,7%)`; ctx.fill();

      // Face — dark/shadow
      const fG=ctx.createRadialGradient(cx+2,13,0,cx,16,10);
      fG.addColorStop(0,`hsl(${hue},20%,28%)`); fG.addColorStop(0.6,`hsl(${hue},15%,16%)`); fG.addColorStop(1,`hsl(${hue},10%,8%)`);
      ctx.beginPath(); ctx.ellipse(cx,15,8,9.5,0,0,Math.PI*2); ctx.fillStyle=fG; ctx.fill();

      // Dark hair covering left side
      ctx.beginPath(); ctx.ellipse(cx,9.5,9.5,9.5,0,Math.PI,0); ctx.fillStyle=`hsl(${hue},30%,10%)`; ctx.fill();
      ctx.beginPath(); ctx.moveTo(6,9); ctx.quadraticCurveTo(4,16,6,30); ctx.strokeStyle=`hsl(${hue},25%,12%)`; ctx.lineWidth=6; ctx.stroke();
      // Hair covers left eye
      ctx.beginPath(); ctx.moveTo(6,8); ctx.quadraticCurveTo(cx-2,5,cx,6); ctx.quadraticCurveTo(cx+3,5,23,9); ctx.lineTo(22,7); ctx.lineTo(cx,4.5); ctx.lineTo(6,7); ctx.closePath(); ctx.fillStyle=`hsl(${hue},28%,11%)`; ctx.fill();
      ctx.beginPath(); ctx.moveTo(6,10); ctx.quadraticCurveTo(10,12,12,15); ctx.strokeStyle=`hsl(${hue},25%,14%)`; ctx.lineWidth=4; ctx.stroke();
      // Hair highlight
      ctx.beginPath(); ctx.moveTo(12,7); ctx.quadraticCurveTo(cx,5,cx+4,7.5); ctx.strokeStyle=`hsl(${hue},60%,35%)`; ctx.lineWidth=0.8; ctx.stroke();

      // ONE visible eye (right) — intense glow
      const ey=14,rx=19.5;
      const eg=ctx.createRadialGradient(rx,ey,0,rx,ey,4);
      eg.addColorStop(0,`hsla(${hue},100%,65%,${0.7+g1*0.3})`); eg.addColorStop(0.4,`hsla(${hue},90%,40%,0.3)`); eg.addColorStop(1,'transparent');
      ctx.fillStyle=eg; ctx.beginPath(); ctx.ellipse(rx,ey,4,4,0,0,Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(rx,ey,2,1.3,0,0,Math.PI*2); ctx.fillStyle='rgba(20,20,30,0.8)'; ctx.fill();
      ctx.beginPath(); ctx.ellipse(rx,ey,1.2,1.2,0,0,Math.PI*2); ctx.fillStyle=`hsl(${hue},95%,60%)`; ctx.fill();
      ctx.beginPath(); ctx.ellipse(rx,ey,0.6,0.6,0,0,Math.PI*2); ctx.fillStyle='#000408'; ctx.fill();
      ctx.beginPath(); ctx.ellipse(rx-0.4,ey-0.4,0.3,0.3,0,0,Math.PI*2); ctx.fillStyle='rgba(255,255,255,0.9)'; ctx.fill();
      ctx.beginPath(); ctx.ellipse(rx,ey-0.6,2.3,0.7,0,Math.PI,0); ctx.fillStyle='#040410'; ctx.fill();
      // Mouth — barely visible
      ctx.beginPath(); ctx.moveTo(cx-1.5,21); ctx.quadraticCurveTo(cx,22,cx+1.5,21); ctx.strokeStyle=`hsl(${hue},40%,30%)`; ctx.lineWidth=0.7; ctx.stroke();

    } else {
      // ── TYPE 5: TECH PILOT ─── headset visor, military look
      const bgG=ctx.createLinearGradient(0,0,base,base);
      bgG.addColorStop(0,`hsl(${hue},25%,8%)`); bgG.addColorStop(1,`hsl(${hue},20%,4%)`);
      ctx.fillStyle=bgG; ctx.fillRect(0,0,base,base);
      // Grid lines
      ctx.strokeStyle=`hsla(${hue},60%,40%,0.08)`; ctx.lineWidth=0.3;
      for(let i=0;i<30;i+=5){ctx.beginPath();ctx.moveTo(i,0);ctx.lineTo(i,30);ctx.stroke();ctx.beginPath();ctx.moveTo(0,i);ctx.lineTo(30,i);ctx.stroke();}

      // Shoulders — pilot jacket
      ctx.beginPath(); ctx.moveTo(0,base); ctx.lineTo(4,21); ctx.lineTo(26,21); ctx.lineTo(base,base); ctx.closePath();
      const pilotG=ctx.createLinearGradient(0,21,0,base);
      pilotG.addColorStop(0,`hsl(${hue},35%,14%)`); pilotG.addColorStop(1,`hsl(${hue},30%,7%)`);
      ctx.fillStyle=pilotG; ctx.fill();
      ctx.strokeStyle=`hsl(${hue},80%,50%)`; ctx.lineWidth=0.45;
      ctx.beginPath(); ctx.moveTo(4,21); ctx.lineTo(26,21); ctx.stroke();
      // Insignia
      ctx.beginPath(); ctx.arc(cx,21,1.2,0,Math.PI*2); ctx.fillStyle=`hsl(${hue},90%,55%)`; ctx.fill();
      ctx.beginPath(); ctx.arc(cx,21,0.7,0,Math.PI*2); ctx.fillStyle=`hsl(${hue},100%,70%)`; ctx.fill();

      // Neck
      _nftRoundRect(ctx,12.5,20.5,5,2.8,1); ctx.fillStyle=skin[1]; ctx.fill();

      // Face
      const fG=ctx.createRadialGradient(cx,13,0,cx,15,9);
      fG.addColorStop(0,skin[0]); fG.addColorStop(0.7,skin[1]); fG.addColorStop(1,skin[2]);
      ctx.beginPath(); ctx.ellipse(cx,15,7.5,9,0,0,Math.PI*2); ctx.fillStyle=fG; ctx.fill();

      // Hair — short military / tucked
      ctx.beginPath(); ctx.ellipse(cx,9,8,7,0,Math.PI,0); ctx.fillStyle=hairCol; ctx.fill();
      ctx.beginPath(); ctx.moveTo(7,9); ctx.quadraticCurveTo(cx,5.5,23,9); ctx.lineTo(22,8); ctx.lineTo(cx,4.8); ctx.lineTo(7,8); ctx.closePath(); ctx.fillStyle=hairCol; ctx.fill();
      ctx.beginPath(); ctx.moveTo(10,7.5); ctx.quadraticCurveTo(cx,5.2,cx+3,7.5); ctx.strokeStyle='rgba(255,255,255,0.22)'; ctx.lineWidth=0.85; ctx.stroke();

      // HEADSET — wraps around head
      ctx.strokeStyle=`hsl(${hue},50%,30%)`; ctx.lineWidth=1;
      ctx.beginPath(); ctx.moveTo(6.5,10); ctx.arc(cx,10,8.5,Math.PI,0,false); ctx.stroke();
      // Ear cups
      ctx.beginPath(); _nftRoundRect(ctx,3.5,9,3,4,1); ctx.fillStyle=`hsl(${hue},40%,18%)`; ctx.fill();
      ctx.strokeStyle=`hsl(${hue},80%,50%)`; ctx.lineWidth=0.35; ctx.stroke();
      ctx.beginPath(); _nftRoundRect(ctx,23.5,9,3,4,1); ctx.fillStyle=`hsl(${hue},40%,18%)`; ctx.fill();
      ctx.strokeStyle=`hsl(${hue},80%,50%)`; ctx.lineWidth=0.35; ctx.stroke();
      // Ear cup lights
      ctx.beginPath(); ctx.arc(5,11,0.5,0,Math.PI*2); ctx.fillStyle=`hsl(${hue},100%,65%)`; ctx.fill();
      ctx.beginPath(); ctx.arc(25,11,0.5,0,Math.PI*2); ctx.fillStyle=`hsl(${hue},100%,65%)`; ctx.fill();
      // Visor strip across eyes
      _nftRoundRect(ctx,7,13,16,3.5,1.5);
      const vizG=ctx.createLinearGradient(7,13,23,16.5);
      vizG.addColorStop(0,`hsla(${hue},80%,30%,0.75)`); vizG.addColorStop(0.5,`hsla(${hue},100%,50%,0.6)`); vizG.addColorStop(1,`hsla(${hue},80%,30%,0.75)`);
      ctx.fillStyle=vizG; ctx.fill();
      ctx.strokeStyle=`hsl(${hue},100%,65%)`; ctx.lineWidth=0.35; ctx.stroke();
      // Visor scan line
      const vs = 7 + ((t*0.018)%16);
      ctx.beginPath(); ctx.moveTo(vs,13); ctx.lineTo(vs,16.5);
      ctx.strokeStyle=`hsla(${hue},100%,80%,${0.35+g1*0.25})`; ctx.lineWidth=0.3; ctx.stroke();
      // HUD data on visor
      ctx.fillStyle=`hsla(${hue},100%,75%,0.7)`; ctx.font=`${0.9/scale*dpr}px monospace`;

      // Nose + lips
      ctx.beginPath(); ctx.moveTo(cx-0.8,18.8); ctx.lineTo(cx,19.8); ctx.lineTo(cx+0.8,18.8); ctx.strokeStyle='rgba(0,0,0,0.2)'; ctx.lineWidth=0.55; ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx-2,21); ctx.quadraticCurveTo(cx,22.4,cx+2,21); ctx.strokeStyle='#b06050'; ctx.lineWidth=0.8; ctx.stroke();
    }

    // ═══════════════════════════════════════════════
    // Shared: cheek blush (types 0,1,5)
    if ([0,1,5].includes(charType)) {
      [[11,18.5],[19,18.5]].forEach(([bx,by])=>{
        const bl=ctx.createRadialGradient(bx,by,0,bx,by,2.5);
        bl.addColorStop(0,'rgba(255,140,140,0.14)'); bl.addColorStop(1,'transparent');
        ctx.fillStyle=bl; ctx.beginPath(); ctx.ellipse(bx,by,2.5,1.4,0,0,Math.PI*2); ctx.fill();
      });
    }
    // Shared nose (types 0,1,3)
    if (charType===0||charType===3) {
      ctx.beginPath(); ctx.moveTo(cx-0.8,18.8); ctx.lineTo(cx,19.8); ctx.lineTo(cx+0.8,18.8); ctx.strokeStyle='rgba(0,0,0,0.2)'; ctx.lineWidth=0.55; ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx-2,21); ctx.quadraticCurveTo(cx,22.5,cx+2,21); ctx.strokeStyle='#c06858'; ctx.lineWidth=0.85; ctx.stroke();
    }

    // Shared: floating neon particles
    ctx.restore(); // end clip
    ctx.save(); ctx.scale(scale,scale); // re-enter scale for particles (no clip)
    _nftRoundRect(ctx,0,0,base,base,7); ctx.save(); ctx.clip();
    pts.forEach(p=>{
      p.x+=p.vx; p.y+=p.vy;
      if(p.x<0.5||p.x>base-0.5)p.vx*=-1;
      if(p.y<0.5||p.y>base-0.5)p.vy*=-1;
      const pg=ctx.createRadialGradient(p.x,p.y,0,p.x,p.y,p.r*3);
      pg.addColorStop(0,`hsla(${hue},100%,78%,0.8)`); pg.addColorStop(1,'transparent');
      ctx.fillStyle=pg; ctx.beginPath(); ctx.arc(p.x,p.y,p.r*3,0,Math.PI*2); ctx.fill();
    });
    ctx.restore();

    ctx.restore();
    _nftAnims.set(canvasId, requestAnimationFrame(draw));
  }
  _nftAnims.set(canvasId, requestAnimationFrame(draw));
}
