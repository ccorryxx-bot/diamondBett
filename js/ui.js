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
  const initLang = localStorage.getItem('_db_lang') || 'mm';
  if (typeof window.applyLang === 'function') window.applyLang(initLang);

  document.getElementById('langBtn')?.addEventListener('click', () => {
    const cur  = localStorage.getItem('_db_lang') || 'mm';
    const next = cur === 'mm' ? 'en' : 'mm';
    if (typeof window.selectLang === 'function') {
      window.selectLang(next);
    } else if (typeof window.applyLang === 'function') {
      window.applyLang(next);
    }
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
// ANIME HYBRID NFT — 6 Archetypes, clean single-pass draw
// ============================================================
const _nftAnims = new Map();

function _nftRR(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x+r,y); ctx.lineTo(x+w-r,y);
  ctx.arcTo(x+w,y,x+w,y+r,r); ctx.lineTo(x+w,y+h-r);
  ctx.arcTo(x+w,y+h,x+w-r,y+h,r); ctx.lineTo(x+r,y+h);
  ctx.arcTo(x,y+h,x,y+h-r,r); ctx.lineTo(x,y+r);
  ctx.arcTo(x,y,x+r,y,r); ctx.closePath();
}

function generateNFTAvatar(userId, canvasId = 'nftAvatar', sz = 30) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  if (_nftAnims.has(canvasId)) { cancelAnimationFrame(_nftAnims.get(canvasId)); _nftAnims.delete(canvasId); }

  const dpr   = Math.min(Math.max(window.devicePixelRatio||1,1),3);
  const B     = 30; // logical space
  const sc    = (sz/B)*dpr;
  canvas.width=sz*dpr; canvas.height=sz*dpr;
  canvas.style.width=sz+'px'; canvas.style.height=sz+'px';
  const ctx   = canvas.getContext('2d');

  // Hash
  const s = String(userId||'anon');
  let h=0; for(let i=0;i<s.length;i++) h=(h*31+s.charCodeAt(i))&0x7fffffff;

  const type  = h%6;
  const hue   = (h>>3)%360;
  const hue2  = (hue+145+(h>>11)%70)%360;
  const eyeH  = (h>>5)%360;
  const hairI = (h>>8)%8;
  const skinI = (h>>14)%3;
  const HAIRS = ['#e2e8f0','#a78bfa','#3b82f6','#ec4899','#06b6d4','#22c55e','#fbbf24','#f87171'];
  const SKINS = [['#f9c8a0','#e8a070','#c07848'],['#fde68a','#f0a050','#b06020'],['#fecaca','#fca5a5','#ef4444']];
  const hair  = HAIRS[hairI];
  const sk    = SKINS[skinI];

  // Particles — deterministic
  const pts=Array.from({length:5},(_,i)=>({
    x:2+((h>>(i*4))&0x1f)%26, y:2+((h>>(i*3))&0x1f)%26,
    vx:(((h>>(i*7+2))&3)-1.5)*0.15, vy:(((h>>(i*6+1))&3)-1.5)*0.15,
    r:0.5+((h>>(i+2))&1)*0.35,
  }));

  function draw(t) {
    // ── Single save/restore — no nesting bugs ──────────────
    ctx.save();
    ctx.scale(sc,sc);
    ctx.clearRect(0,0,B,B);
    _nftRR(ctx,0,0,B,B,7); ctx.clip(); // clip everything to rounded rect

    const cx=B/2, cy=B/2;
    const g1=Math.sin(t*0.0014)*0.5+0.5;   // 0→1 slow breathe
    const g2=Math.sin(t*0.0023+1.4)*0.5+0.5;

    // ══════════════════════════════════════════════════════
    //  TYPE 0 — CYBER ANDROID
    //  White/silver hair · tech headband · eye scan · cheek panel
    // ══════════════════════════════════════════════════════
    if (type===0) {
      // BG — deep blue
      const bg=ctx.createLinearGradient(0,0,B,B);
      bg.addColorStop(0,`hsl(210,60%,9%)`); bg.addColorStop(1,`hsl(200,55%,5%)`);
      ctx.fillStyle=bg; ctx.fillRect(0,0,B,B);
      // scan line
      const sl=(t*0.028)%(B+4)-2;
      ctx.fillStyle=`rgba(0,220,255,${0.06+g1*0.04})`; ctx.fillRect(0,sl,B,1.2);

      // Shoulders
      ctx.beginPath(); ctx.moveTo(0,B); ctx.lineTo(5,22); ctx.lineTo(25,22); ctx.lineTo(B,B); ctx.closePath();
      ctx.fillStyle=`hsl(210,50%,10%)`; ctx.fill();
      ctx.strokeStyle=`hsla(195,100%,60%,${0.55+g1*0.35})`; ctx.lineWidth=0.5;
      ctx.beginPath(); ctx.moveTo(5,22); ctx.lineTo(25,22); ctx.stroke();

      // Neck
      _nftRR(ctx,12.5,20.5,5,3,1); ctx.fillStyle=sk[1]; ctx.fill();

      // Face — pale android
      const fg=ctx.createRadialGradient(cx-1,12,0,cx,15,9);
      fg.addColorStop(0,'#eeeef8'); fg.addColorStop(0.7,'#d8d8ec'); fg.addColorStop(1,'#a8a8c0');
      ctx.beginPath(); ctx.ellipse(cx,15,7.8,9.2,0,0,Math.PI*2); ctx.fillStyle=fg; ctx.fill();

      // Hair — white/silver
      ctx.fillStyle='#e0e3f2';
      ctx.beginPath(); ctx.ellipse(cx,9,8.5,9,0,Math.PI,0); ctx.fill();
      ctx.strokeStyle='#d8ddef'; ctx.lineWidth=2.8;
      ctx.beginPath(); ctx.moveTo(7,10); ctx.quadraticCurveTo(5,16,7,22); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(23,10); ctx.quadraticCurveTo(25,16,23,22); ctx.stroke();
      ctx.fillStyle='#dde0f0';
      ctx.beginPath(); ctx.moveTo(7,9); ctx.quadraticCurveTo(cx,5.5,cx,6.5); ctx.quadraticCurveTo(cx+3,5.5,23,9.5); ctx.lineTo(22,8); ctx.lineTo(cx,5); ctx.lineTo(7,8); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(10,7.5); ctx.quadraticCurveTo(cx,5.2,cx+4,7.5); ctx.strokeStyle='rgba(255,255,255,0.45)'; ctx.lineWidth=0.9; ctx.stroke();

      // Tech headband
      ctx.strokeStyle=`hsla(195,100%,65%,${0.75+g1*0.2})`; ctx.lineWidth=0.7;
      ctx.beginPath(); ctx.moveTo(6.5,9); ctx.lineTo(23.5,9); ctx.stroke();
      for(let i=0;i<4;i++){ctx.beginPath();ctx.arc(8+i*4.5,9,0.48,0,Math.PI*2);ctx.fillStyle=`hsla(195,100%,72%,${0.7+g2*0.3})`;ctx.fill();}

      // Eyes — android glow
      [11,19].forEach(ex=>{
        const ey=14.5;
        let eg=ctx.createRadialGradient(ex,ey,0,ex,ey,2.8); eg.addColorStop(0,`hsla(195,100%,65%,${0.55+g2*0.35})`); eg.addColorStop(1,'transparent');
        ctx.fillStyle=eg; ctx.beginPath(); ctx.ellipse(ex,ey,2.8,2.8,0,0,Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(ex,ey,2.1,1.4,0,0,Math.PI*2); ctx.fillStyle='#fff'; ctx.fill();
        ctx.beginPath(); ctx.ellipse(ex,ey,1.15,1.15,0,0,Math.PI*2); ctx.fillStyle='hsl(195,100%,55%)'; ctx.fill();
        ctx.beginPath(); ctx.ellipse(ex,ey,0.58,0.58,0,0,Math.PI*2); ctx.fillStyle='#000c1a'; ctx.fill();
        ctx.beginPath(); ctx.ellipse(ex-0.4,ey-0.45,0.32,0.32,0,0,Math.PI*2); ctx.fillStyle='rgba(255,255,255,0.92)'; ctx.fill();
        // scan line
        ctx.strokeStyle=`rgba(0,220,255,${0.3+g1*0.25})`; ctx.lineWidth=0.25;
        ctx.beginPath(); ctx.moveTo(ex-2,ey); ctx.lineTo(ex+2,ey); ctx.stroke();
        ctx.beginPath(); ctx.ellipse(ex,ey-0.6,2.3,0.65,0,Math.PI,0); ctx.fillStyle='#06060f'; ctx.fill();
      });

      // Tech patch right cheek
      _nftRR(ctx,18.5,16,5,3,0.6); ctx.fillStyle='hsl(210,45%,13%)'; ctx.fill();
      ctx.strokeStyle=`hsla(195,100%,60%,${0.55+g1*0.3})`; ctx.lineWidth=0.35; ctx.stroke();
      ctx.beginPath(); ctx.arc(19.8,17.5,0.42,0,Math.PI*2); ctx.fillStyle=`hsla(195,100%,70%,${0.8+g2*0.2})`; ctx.fill();
      ctx.beginPath(); ctx.arc(22,17.5,0.42,0,Math.PI*2); ctx.fillStyle='#f59e0b'; ctx.fill();
      // ear cable
      ctx.strokeStyle=`hsla(195,70%,50%,0.55)`; ctx.lineWidth=0.5;
      ctx.beginPath(); ctx.moveTo(23,15.5); ctx.quadraticCurveTo(26,17,25.5,21); ctx.stroke();

      // Nose + lips
      ctx.strokeStyle='rgba(0,0,0,0.2)'; ctx.lineWidth=0.55;
      ctx.beginPath(); ctx.moveTo(cx-0.8,19); ctx.lineTo(cx,20); ctx.lineTo(cx+0.8,19); ctx.stroke();
      ctx.strokeStyle='#a06880'; ctx.lineWidth=0.85;
      ctx.beginPath(); ctx.moveTo(cx-2,21.2); ctx.quadraticCurveTo(cx,22.8,cx+2,21.2); ctx.stroke();
    }

    // ══════════════════════════════════════════════════════
    //  TYPE 1 — ANIME WARRIOR
    //  Long hair · intense eyes · warrior face mark · high collar
    // ══════════════════════════════════════════════════════
    else if (type===1) {
      const bg=ctx.createRadialGradient(cx,cy,0,cx,cy,20);
      bg.addColorStop(0,`hsl(${hue},35%,9%)`); bg.addColorStop(1,'#040106');
      ctx.fillStyle=bg; ctx.fillRect(0,0,B,B);
      // vignette
      const vig=ctx.createRadialGradient(cx,cy,8,cx,cy,18);
      vig.addColorStop(0,'transparent'); vig.addColorStop(1,'rgba(0,0,0,0.55)');
      ctx.fillStyle=vig; ctx.fillRect(0,0,B,B);

      // High collar
      ctx.beginPath(); ctx.moveTo(3,B); ctx.lineTo(7,22); ctx.lineTo(23,22); ctx.lineTo(27,B); ctx.closePath();
      ctx.fillStyle=`hsl(${hue},50%,12%)`; ctx.fill();
      ctx.strokeStyle=`hsl(${hue},90%,55%)`; ctx.lineWidth=0.55;
      ctx.beginPath(); ctx.moveTo(7,22); ctx.lineTo(cx-2,22); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx+2,22); ctx.lineTo(23,22); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx-2,22); ctx.lineTo(cx,20.5); ctx.lineTo(cx+2,22); ctx.stroke();

      // Neck
      _nftRR(ctx,12.5,21,5,3,1); ctx.fillStyle=sk[0]; ctx.fill();

      // Face
      const fg=ctx.createRadialGradient(cx,12,0,cx,15,9);
      fg.addColorStop(0,sk[0]); fg.addColorStop(0.7,sk[1]); fg.addColorStop(1,sk[2]);
      ctx.beginPath(); ctx.ellipse(cx,15,7.5,9,0,0,Math.PI*2); ctx.fillStyle=fg; ctx.fill();

      // Long dramatic hair
      ctx.fillStyle=hair;
      ctx.beginPath(); ctx.ellipse(cx,9,9,9.5,0,Math.PI,0); ctx.fill();
      ctx.strokeStyle=hair; ctx.lineWidth=3.2;
      ctx.beginPath(); ctx.moveTo(7.5,11); ctx.quadraticCurveTo(4,18,5,B); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(22.5,11); ctx.quadraticCurveTo(26,18,25,B); ctx.stroke();
      ctx.fillStyle=hair;
      ctx.beginPath(); ctx.moveTo(7,9); ctx.quadraticCurveTo(cx-3,6,cx-1,6.5); ctx.quadraticCurveTo(cx+2,5.5,23,9); ctx.lineTo(22,7.5); ctx.lineTo(cx,4.8); ctx.lineTo(7,7.5); ctx.closePath(); ctx.fill();
      ctx.lineWidth=2;
      ctx.beginPath(); ctx.moveTo(cx-2,6); ctx.quadraticCurveTo(cx,4,cx+1,6); ctx.strokeStyle=hair; ctx.stroke();
      ctx.beginPath(); ctx.moveTo(10,7.5); ctx.quadraticCurveTo(cx,5,cx+4,7.5); ctx.strokeStyle='rgba(255,255,255,0.22)'; ctx.lineWidth=0.9; ctx.stroke();

      // Warrior eye marks (right cheek)
      ctx.strokeStyle=`hsl(${hue},100%,62%)`; ctx.lineWidth=0.7;
      ctx.beginPath(); ctx.moveTo(18.5,17); ctx.lineTo(21.5,15.5); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(19.5,17.8); ctx.lineTo(22,16.8); ctx.stroke();

      // Eyes — intense
      [11,19].forEach(ex=>{
        const ey=14;
        let eg=ctx.createRadialGradient(ex,ey,0,ex,ey,2.5); eg.addColorStop(0,`hsla(${eyeH},100%,65%,${0.55+g2*0.35})`); eg.addColorStop(1,'transparent');
        ctx.fillStyle=eg; ctx.beginPath(); ctx.ellipse(ex,ey,2.5,2.5,0,0,Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(ex,ey,2.1,1.3,0,0,Math.PI*2); ctx.fillStyle='#fefefe'; ctx.fill();
        ctx.beginPath(); ctx.ellipse(ex,ey,1.15,1.15,0,0,Math.PI*2); ctx.fillStyle=`hsl(${eyeH},88%,55%)`; ctx.fill();
        ctx.beginPath(); ctx.ellipse(ex,ey,0.58,0.58,0,0,Math.PI*2); ctx.fillStyle='#040410'; ctx.fill();
        ctx.beginPath(); ctx.ellipse(ex-0.4,ey-0.4,0.3,0.3,0,0,Math.PI*2); ctx.fillStyle='rgba(255,255,255,0.9)'; ctx.fill();
        // sharp lash
        ctx.beginPath(); ctx.moveTo(ex-2.2,ey-0.7); ctx.lineTo(ex+2.2,ey-0.7); ctx.strokeStyle='#04041a'; ctx.lineWidth=0.95; ctx.stroke();
      });

      // Nose + lips
      ctx.strokeStyle='rgba(0,0,0,0.2)'; ctx.lineWidth=0.55;
      ctx.beginPath(); ctx.moveTo(cx-0.8,18.5); ctx.lineTo(cx,19.5); ctx.lineTo(cx+0.8,18.5); ctx.stroke();
      ctx.strokeStyle='#c06858'; ctx.lineWidth=0.85;
      ctx.beginPath(); ctx.moveTo(cx-2,21); ctx.quadraticCurveTo(cx,22.5,cx+2,21); ctx.stroke();
    }

    // ══════════════════════════════════════════════════════
    //  TYPE 2 — STREET NFT PUNK
    //  Spiky hair · vivid solid BG · face tattoo · bold lips
    // ══════════════════════════════════════════════════════
    else if (type===2) {
      const BKGS=['hsl(0,75%,14%)','hsl(270,55%,11%)','hsl(175,65%,9%)','hsl(40,75%,11%)'];
      ctx.fillStyle=BKGS[(h>>12)%4]; ctx.fillRect(0,0,B,B);
      // BG texture strip
      const bgL=ctx.createLinearGradient(0,0,B,B);
      bgL.addColorStop(0,`hsla(${hue},80%,55%,0.07)`); bgL.addColorStop(1,'transparent');
      ctx.fillStyle=bgL; ctx.fillRect(0,0,B,B);

      // Shoulders
      ctx.beginPath(); ctx.moveTo(0,B); ctx.lineTo(4,22); ctx.lineTo(26,22); ctx.lineTo(B,B); ctx.closePath();
      ctx.fillStyle=`hsl(${hue},55%,14%)`; ctx.fill();
      ctx.strokeStyle=`hsl(${hue},100%,58%)`; ctx.lineWidth=0.55;
      ctx.beginPath(); ctx.moveTo(4,22); ctx.lineTo(26,22); ctx.stroke();

      // Face
      const fg=ctx.createRadialGradient(cx,13,0,cx,15,9);
      fg.addColorStop(0,sk[0]); fg.addColorStop(0.7,sk[1]); fg.addColorStop(1,sk[2]);
      ctx.beginPath(); ctx.ellipse(cx,15,7.5,9,0,0,Math.PI*2); ctx.fillStyle=fg; ctx.fill();

      // Spiky hair
      ctx.fillStyle=hair;
      ctx.beginPath(); ctx.ellipse(cx,9.5,8,8.5,0,Math.PI,0); ctx.fill();
      for(let i=0;i<5;i++){
        const sx=8+i*3.5, sh=5.5+((h>>(i*3))&3);
        ctx.beginPath(); ctx.moveTo(sx-1.5,9.5); ctx.lineTo(sx,9.5-sh); ctx.lineTo(sx+1.5,9.5); ctx.closePath(); ctx.fill();
      }
      ctx.beginPath(); ctx.moveTo(10,7.5); ctx.quadraticCurveTo(cx,5.2,cx+3,7.5); ctx.strokeStyle='rgba(255,255,255,0.22)'; ctx.lineWidth=0.85; ctx.stroke();

      // Eyes
      [11,19].forEach(ex=>{
        const ey=14.5;
        ctx.beginPath(); ctx.ellipse(ex,ey,2.1,1.4,0,0,Math.PI*2); ctx.fillStyle='#fff'; ctx.fill();
        ctx.beginPath(); ctx.ellipse(ex,ey,1.15,1.15,0,0,Math.PI*2); ctx.fillStyle=`hsl(${eyeH},88%,52%)`; ctx.fill();
        ctx.beginPath(); ctx.ellipse(ex,ey,0.6,0.6,0,0,Math.PI*2); ctx.fillStyle='#040410'; ctx.fill();
        ctx.beginPath(); ctx.ellipse(ex-0.4,ey-0.4,0.3,0.3,0,0,Math.PI*2); ctx.fillStyle='rgba(255,255,255,0.9)'; ctx.fill();
        ctx.beginPath(); ctx.ellipse(ex,ey-0.6,2.3,0.65,0,Math.PI,0); ctx.fillStyle='#080818'; ctx.fill();
      });

      // Face tattoo — left cheek geometric
      ctx.strokeStyle=`hsl(${hue},100%,65%)`; ctx.lineWidth=0.5;
      ctx.beginPath(); ctx.moveTo(8,15.5); ctx.lineTo(5.5,13); ctx.lineTo(8,12); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(8,15.5); ctx.lineTo(5.5,18); ctx.stroke();
      ctx.beginPath(); ctx.arc(8,15.5,0.5,0,Math.PI*2); ctx.fillStyle=`hsl(${hue},100%,65%)`; ctx.fill();

      // Nose + Bold lips
      ctx.strokeStyle='rgba(0,0,0,0.2)'; ctx.lineWidth=0.55;
      ctx.beginPath(); ctx.moveTo(cx-0.8,18.5); ctx.lineTo(cx,19.5); ctx.lineTo(cx+0.8,18.5); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx-2.3,21); ctx.quadraticCurveTo(cx,22.8,cx+2.3,21); ctx.closePath();
      ctx.fillStyle=`hsl(${hue},75%,48%)`; ctx.fill();
    }

    // ══════════════════════════════════════════════════════
    //  TYPE 3 — NEON IDOL
    //  Soft pastel face · huge sparkle eyes · hair bow · sparkle bg
    // ══════════════════════════════════════════════════════
    else if (type===3) {
      const bg=ctx.createLinearGradient(0,0,B,B);
      bg.addColorStop(0,`hsl(${290+hue%60},50%,10%)`); bg.addColorStop(1,`hsl(${320+hue%40},55%,7%)`);
      ctx.fillStyle=bg; ctx.fillRect(0,0,B,B);
      // sparkle stars in bg
      [[4,4],[26,5],[2,22],[27,21],[13,2]].forEach(([sx,sy],i)=>{
        ctx.beginPath(); ctx.arc(sx,sy,(0.5+((h>>(i*4))&1)*0.4)*(0.7+g1*0.5),0,Math.PI*2);
        ctx.fillStyle=`hsla(${hue+i*40},100%,85%,${0.5+g2*0.4})`; ctx.fill();
      });

      // Idol collar + shoulders
      ctx.beginPath(); ctx.moveTo(2,B); ctx.lineTo(7,22); ctx.lineTo(23,22); ctx.lineTo(28,B); ctx.closePath();
      const cg=ctx.createLinearGradient(0,22,0,B);
      cg.addColorStop(0,`hsl(${290+hue%60},55%,18%)`); cg.addColorStop(1,`hsl(${290+hue%60},45%,8%)`);
      ctx.fillStyle=cg; ctx.fill();
      // ribbon bow
      ctx.fillStyle=`hsl(${hue},90%,60%)`;
      ctx.beginPath(); ctx.moveTo(cx-2,22); ctx.lineTo(cx,24); ctx.lineTo(cx+2,22); ctx.fill();

      // Neck
      _nftRR(ctx,12.5,21,5,3,1); ctx.fillStyle='#ffe0ec'; ctx.fill();

      // Face — soft rosy
      const fg=ctx.createRadialGradient(cx-1,12,0,cx,15,9.5);
      fg.addColorStop(0,'#fff0f5'); fg.addColorStop(0.6,'#ffd8e8'); fg.addColorStop(1,'#f0a8b8');
      ctx.beginPath(); ctx.ellipse(cx,15,7.8,9.3,0,0,Math.PI*2); ctx.fillStyle=fg; ctx.fill();

      // Long flowing hair
      ctx.fillStyle=hair;
      ctx.beginPath(); ctx.ellipse(cx,9,9.2,9.5,0,Math.PI,0); ctx.fill();
      ctx.strokeStyle=hair; ctx.lineWidth=3;
      ctx.beginPath(); ctx.moveTo(7.5,11); ctx.quadraticCurveTo(4.5,18,6,B); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(22.5,11); ctx.quadraticCurveTo(25.5,18,24,B); ctx.stroke();
      ctx.fillStyle=hair;
      ctx.beginPath(); ctx.moveTo(7,9); ctx.quadraticCurveTo(cx-1,5.5,cx,6.5); ctx.quadraticCurveTo(cx+2,5.5,23,9.5); ctx.lineTo(22,7.5); ctx.lineTo(cx,4.5); ctx.lineTo(7,7.5); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(10,7.5); ctx.quadraticCurveTo(cx,5,cx+4,7.5); ctx.strokeStyle='rgba(255,255,255,0.3)'; ctx.lineWidth=1; ctx.stroke();
      // Hair star accessory
      ctx.beginPath(); ctx.arc(20.5,7,1.8,0,Math.PI*2); ctx.fillStyle=`hsl(${hue},88%,65%)`; ctx.fill();
      ctx.beginPath(); ctx.arc(20.5,7,0.9,0,Math.PI*2); ctx.fillStyle=`hsl(${hue},100%,82%)`; ctx.fill();

      // LARGE idol eyes
      [10.5,19.5].forEach(ex=>{
        const ey=14.2;
        let eg=ctx.createRadialGradient(ex,ey,0,ex,ey,3.2); eg.addColorStop(0,`hsla(${eyeH},100%,70%,${0.4+g2*0.35})`); eg.addColorStop(1,'transparent');
        ctx.fillStyle=eg; ctx.beginPath(); ctx.ellipse(ex,ey,3.2,3.2,0,0,Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(ex,ey,2.4,1.8,0,0,Math.PI*2); ctx.fillStyle='#fff'; ctx.fill();
        ctx.beginPath(); ctx.ellipse(ex,ey,1.4,1.4,0,0,Math.PI*2); ctx.fillStyle=`hsl(${eyeH},80%,62%)`; ctx.fill();
        ctx.beginPath(); ctx.ellipse(ex,ey,0.68,0.68,0,0,Math.PI*2); ctx.fillStyle='#020210'; ctx.fill();
        ctx.beginPath(); ctx.ellipse(ex-0.45,ey-0.5,0.38,0.38,0,0,Math.PI*2); ctx.fillStyle='rgba(255,255,255,0.95)'; ctx.fill();
        ctx.beginPath(); ctx.ellipse(ex+0.5,ey-0.25,0.22,0.22,0,0,Math.PI*2); ctx.fillStyle='rgba(255,255,255,0.7)'; ctx.fill();
        ctx.beginPath(); ctx.ellipse(ex,ey-0.75,2.6,0.72,0,Math.PI,0); ctx.fillStyle='#06060e'; ctx.fill();
      });

      // BIG cheek blush
      [[10.5,18.5],[19.5,18.5]].forEach(([bx,by])=>{
        const bl=ctx.createRadialGradient(bx,by,0,bx,by,3.3);
        bl.addColorStop(0,'rgba(255,120,155,0.28)'); bl.addColorStop(1,'transparent');
        ctx.fillStyle=bl; ctx.beginPath(); ctx.ellipse(bx,by,3.3,1.9,0,0,Math.PI*2); ctx.fill();
      });

      // Nose + lips
      ctx.beginPath(); ctx.arc(cx,19,0.55,0,Math.PI*2); ctx.fillStyle='rgba(210,110,130,0.35)'; ctx.fill();
      ctx.strokeStyle='#e06878'; ctx.lineWidth=0.9;
      ctx.beginPath(); ctx.moveTo(cx-2.1,21.2); ctx.quadraticCurveTo(cx,23,cx+2.1,21.2); ctx.stroke();
    }

    // ══════════════════════════════════════════════════════
    //  TYPE 4 — DARK PHANTOM
    //  Nearly all shadow · ONE glowing eye · hair over face · mystery
    // ══════════════════════════════════════════════════════
    else if (type===4) {
      const bg=ctx.createRadialGradient(cx,cy,0,cx,cy,18);
      bg.addColorStop(0,`hsl(${260+hue%80},45%,8%)`); bg.addColorStop(1,'#010104');
      ctx.fillStyle=bg; ctx.fillRect(0,0,B,B);

      // Cloak
      ctx.beginPath(); ctx.moveTo(0,B); ctx.lineTo(2,20); ctx.lineTo(28,20); ctx.lineTo(B,B); ctx.closePath();
      ctx.fillStyle=`hsl(${260+hue%80},28%,8%)`; ctx.fill();

      // Face — dark, barely visible
      const fg=ctx.createRadialGradient(cx+2,13,0,cx,16,11);
      fg.addColorStop(0,`hsl(${hue},18%,30%)`); fg.addColorStop(0.65,`hsl(${hue},12%,18%)`); fg.addColorStop(1,`hsl(${hue},8%,9%)`);
      ctx.beginPath(); ctx.ellipse(cx,15,8,9.5,0,0,Math.PI*2); ctx.fillStyle=fg; ctx.fill();

      // Dark hair covers left side (shadow)
      ctx.fillStyle=`hsl(${hue},25%,11%)`;
      ctx.beginPath(); ctx.ellipse(cx,9.5,9.5,9.5,0,Math.PI,0); ctx.fill();
      ctx.strokeStyle=`hsl(${hue},22%,13%)`; ctx.lineWidth=6;
      ctx.beginPath(); ctx.moveTo(6,9); ctx.quadraticCurveTo(4,16,6,B); ctx.stroke();
      ctx.lineWidth=4;
      ctx.beginPath(); ctx.moveTo(6,10); ctx.quadraticCurveTo(10,13,12,16); ctx.stroke();
      ctx.fillStyle=`hsl(${hue},24%,12%)`;
      ctx.beginPath(); ctx.moveTo(6,8); ctx.quadraticCurveTo(cx-2,5,cx,6); ctx.quadraticCurveTo(cx+3,5,23,9); ctx.lineTo(22,7); ctx.lineTo(cx,4.5); ctx.lineTo(6,7); ctx.closePath(); ctx.fill();
      // Hair streak
      ctx.beginPath(); ctx.moveTo(12,7.5); ctx.quadraticCurveTo(cx,5.2,cx+4,7.5); ctx.strokeStyle=`hsl(${hue},60%,38%)`; ctx.lineWidth=0.85; ctx.stroke();

      // SINGLE glowing eye (right) — dramatic
      const rex=19.5, rey=14;
      let eg=ctx.createRadialGradient(rex,rey,0,rex,rey,4.5);
      eg.addColorStop(0,`hsla(${hue},100%,65%,${0.75+g1*0.25})`);
      eg.addColorStop(0.4,`hsla(${hue},85%,45%,0.3)`); eg.addColorStop(1,'transparent');
      ctx.fillStyle=eg; ctx.beginPath(); ctx.ellipse(rex,rey,4.5,4.5,0,0,Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(rex,rey,2.1,1.35,0,0,Math.PI*2); ctx.fillStyle='rgba(18,18,28,0.85)'; ctx.fill();
      ctx.beginPath(); ctx.ellipse(rex,rey,1.25,1.25,0,0,Math.PI*2); ctx.fillStyle=`hsl(${hue},95%,62%)`; ctx.fill();
      ctx.beginPath(); ctx.ellipse(rex,rey,0.62,0.62,0,0,Math.PI*2); ctx.fillStyle='#000408'; ctx.fill();
      ctx.beginPath(); ctx.ellipse(rex-0.4,rey-0.4,0.32,0.32,0,0,Math.PI*2); ctx.fillStyle='rgba(255,255,255,0.9)'; ctx.fill();
      ctx.beginPath(); ctx.ellipse(rex,rey-0.6,2.35,0.72,0,Math.PI,0); ctx.fillStyle='#030310'; ctx.fill();

      // Faint mouth
      ctx.strokeStyle=`hsl(${hue},35%,32%)`; ctx.lineWidth=0.72;
      ctx.beginPath(); ctx.moveTo(cx-1.5,21); ctx.quadraticCurveTo(cx,22,cx+1.5,21); ctx.stroke();
    }

    // ══════════════════════════════════════════════════════
    //  TYPE 5 — TECH PILOT
    //  Headset earphones · glowing visor strip · pilot insignia
    // ══════════════════════════════════════════════════════
    else {
      const bg=ctx.createLinearGradient(0,0,B,B);
      bg.addColorStop(0,`hsl(${hue},22%,9%)`); bg.addColorStop(1,`hsl(${hue},18%,5%)`);
      ctx.fillStyle=bg; ctx.fillRect(0,0,B,B);
      // grid
      ctx.strokeStyle=`hsla(${hue},55%,40%,0.08)`; ctx.lineWidth=0.3;
      for(let i=0;i<=B;i+=5){ctx.beginPath();ctx.moveTo(i,0);ctx.lineTo(i,B);ctx.stroke();ctx.beginPath();ctx.moveTo(0,i);ctx.lineTo(B,i);ctx.stroke();}

      // Pilot jacket
      ctx.beginPath(); ctx.moveTo(0,B); ctx.lineTo(4,21); ctx.lineTo(26,21); ctx.lineTo(B,B); ctx.closePath();
      const pjg=ctx.createLinearGradient(0,21,0,B);
      pjg.addColorStop(0,`hsl(${hue},32%,15%)`); pjg.addColorStop(1,`hsl(${hue},28%,7%)`);
      ctx.fillStyle=pjg; ctx.fill();
      ctx.strokeStyle=`hsl(${hue},80%,50%)`; ctx.lineWidth=0.45;
      ctx.beginPath(); ctx.moveTo(4,21); ctx.lineTo(26,21); ctx.stroke();
      // insignia
      ctx.beginPath(); ctx.arc(cx,21.5,1.3,0,Math.PI*2); ctx.fillStyle=`hsl(${hue},90%,55%)`; ctx.fill();
      ctx.beginPath(); ctx.arc(cx,21.5,0.72,0,Math.PI*2); ctx.fillStyle=`hsl(${hue},100%,72%)`; ctx.fill();

      // Neck
      _nftRR(ctx,12.5,20.5,5,2.8,1); ctx.fillStyle=sk[1]; ctx.fill();

      // Face
      const fg=ctx.createRadialGradient(cx,13,0,cx,15,9);
      fg.addColorStop(0,sk[0]); fg.addColorStop(0.7,sk[1]); fg.addColorStop(1,sk[2]);
      ctx.beginPath(); ctx.ellipse(cx,15,7.5,9,0,0,Math.PI*2); ctx.fillStyle=fg; ctx.fill();

      // Short hair
      ctx.fillStyle=hair;
      ctx.beginPath(); ctx.ellipse(cx,9,8,7,0,Math.PI,0); ctx.fill();
      ctx.beginPath(); ctx.moveTo(7,9); ctx.quadraticCurveTo(cx,5.5,23,9); ctx.lineTo(22,8); ctx.lineTo(cx,4.8); ctx.lineTo(7,8); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(10,7.5); ctx.quadraticCurveTo(cx,5.2,cx+3,7.5); ctx.strokeStyle='rgba(255,255,255,0.22)'; ctx.lineWidth=0.85; ctx.stroke();

      // HEADSET — arc over head + ear cups
      ctx.strokeStyle=`hsl(${hue},45%,28%)`; ctx.lineWidth=1.1;
      ctx.beginPath(); ctx.arc(cx,10,8.5,Math.PI,0,false); ctx.stroke();
      // Left ear cup
      _nftRR(ctx,3.5,9.5,3,4,1); ctx.fillStyle=`hsl(${hue},38%,18%)`; ctx.fill();
      ctx.strokeStyle=`hsl(${hue},80%,52%)`; ctx.lineWidth=0.4; ctx.stroke();
      ctx.beginPath(); ctx.arc(5,11.5,0.5,0,Math.PI*2); ctx.fillStyle=`hsl(${hue},100%,65%)`; ctx.fill();
      // Right ear cup
      _nftRR(ctx,23.5,9.5,3,4,1); ctx.fillStyle=`hsl(${hue},38%,18%)`; ctx.fill();
      ctx.strokeStyle=`hsl(${hue},80%,52%)`; ctx.lineWidth=0.4; ctx.stroke();
      ctx.beginPath(); ctx.arc(25,11.5,0.5,0,Math.PI*2); ctx.fillStyle=`hsl(${hue},100%,65%)`; ctx.fill();

      // Glowing visor
      _nftRR(ctx,7.5,13,15,3.5,1.5);
      const vzg=ctx.createLinearGradient(7.5,13,22.5,16.5);
      vzg.addColorStop(0,`hsla(${hue},80%,28%,0.78)`); vzg.addColorStop(0.5,`hsla(${hue},100%,48%,0.65)`); vzg.addColorStop(1,`hsla(${hue},80%,28%,0.78)`);
      ctx.fillStyle=vzg; ctx.fill();
      ctx.strokeStyle=`hsl(${hue},100%,65%)`; ctx.lineWidth=0.38; ctx.stroke();
      // Visor scan sweep
      const vs=7.5+((t*0.02)%15);
      ctx.strokeStyle=`hsla(${hue},100%,80%,${0.38+g1*0.28})`; ctx.lineWidth=0.32;
      ctx.beginPath(); ctx.moveTo(vs,13); ctx.lineTo(vs,16.5); ctx.stroke();

      // Nose + lips
      ctx.strokeStyle='rgba(0,0,0,0.2)'; ctx.lineWidth=0.55;
      ctx.beginPath(); ctx.moveTo(cx-0.8,19); ctx.lineTo(cx,20); ctx.lineTo(cx+0.8,19); ctx.stroke();
      ctx.strokeStyle='#b06050'; ctx.lineWidth=0.82;
      ctx.beginPath(); ctx.moveTo(cx-2,21); ctx.quadraticCurveTo(cx,22.4,cx+2,21); ctx.stroke();
    }

    // ══════════════════════════════════════════════════════
    //  SHARED — cheek blush for non-covered types
    // ══════════════════════════════════════════════════════
    if (type!==4) {
      const blx = type===3 ? [[10.5,18.5],[19.5,18.5]] : [[11,18.5],[19,18.5]];
      blx.forEach(([bx,by])=>{
        const bl=ctx.createRadialGradient(bx,by,0,bx,by,2.6);
        bl.addColorStop(0,'rgba(255,135,150,0.15)'); bl.addColorStop(1,'transparent');
        ctx.fillStyle=bl; ctx.beginPath(); ctx.ellipse(bx,by,2.6,1.5,0,0,Math.PI*2); ctx.fill();
      });
    }

    // ══════════════════════════════════════════════════════
    //  SHARED — floating neon particles (all types)
    // ══════════════════════════════════════════════════════
    pts.forEach(p=>{
      p.x+=p.vx; p.y+=p.vy;
      if(p.x<0.5||p.x>B-0.5)p.vx*=-1;
      if(p.y<0.5||p.y>B-0.5)p.vy*=-1;
      const pg=ctx.createRadialGradient(p.x,p.y,0,p.x,p.y,p.r*2.8);
      pg.addColorStop(0,`hsla(${hue},100%,78%,0.82)`); pg.addColorStop(1,'transparent');
      ctx.fillStyle=pg; ctx.beginPath(); ctx.arc(p.x,p.y,p.r*2.8,0,Math.PI*2); ctx.fill();
    });

    // ── Single restore — clean state each frame ────────────
    ctx.restore();
    _nftAnims.set(canvasId, requestAnimationFrame(draw));
  }
  _nftAnims.set(canvasId, requestAnimationFrame(draw));
}
