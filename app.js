// ============================================================
// [1] SUPABASE INIT
// ============================================================
const supabaseUrl = "https://xjqrwcsxiaybpztzestb.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhqcXJ3Y3N4aWF5YnB6dHplc3RiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg3NzQxMDksImV4cCI6MjA5NDM1MDEwOX0.Kn5sLOTBdNtlooaH-q8ml0cOEswMlgMTSP7GFe7mbxg";
const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

// ============================================================
// [2] STATE
// ============================================================
let currentUser = null;
let currentRefCode = null;
let lang = 'my';

// ============================================================
// [3] DOM READY
// ============================================================
document.addEventListener("DOMContentLoaded", () => {

  // Auto-read ?ref= from URL
  const urlParams = new URLSearchParams(window.location.search);
  const invitedBy = urlParams.get('ref');
  if (invitedBy) {
    const refInput = document.getElementById('referrer_code_input');
    if (refInput) { refInput.value = invitedBy; refInput.readOnly = true; }
    switchTab('register');
    document.getElementById('authModal').classList.add('active');
  }

  initBanner();
  loadGamesFromDB();
  initNav();
  initAuth();
  initAgent();
  initCountdown();
});

// ============================================================
// [4] BANNER SLIDER
// ============================================================
function initBanner() {
  let current = 0, timer = null;
  const track  = document.getElementById("bannerTrack");
  const dots   = document.querySelectorAll("#bannerDots .dot");
  const wrap   = document.getElementById("bannerWrap");
  if (!track) return;

  const update = () => {
    track.style.transform = `translateX(-${current * 100}%)`;
    dots.forEach((d, i) => d.classList.toggle("active", i === current));
  };
  const go = n => { current = ((n % 3) + 3) % 3; update(); };
  const start = () => { clearInterval(timer); timer = setInterval(() => go(current + 1), 4000); };

  dots.forEach(d => d.addEventListener("click", () => { go(+d.dataset.i); start(); }));
  let sx = 0;
  wrap.addEventListener("touchstart", e => { sx = e.touches[0].clientX; }, { passive: true });
  wrap.addEventListener("touchend",   e => {
    const diff = sx - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 40) go(diff > 0 ? current + 1 : current - 1);
    start();
  }, { passive: true });

  update(); start();
}

// ============================================================
// [5] LOAD GAMES FROM DB
// ============================================================
async function loadGamesFromDB() {
  const { data: games, error } = await supabase.from('games').select('*');
  const grid = document.getElementById('gameGrid');
  if (!grid) return;

  if (error || !games || games.length === 0) {
    grid.innerHTML = `<div style="color:var(--muted);font-size:12px;padding:20px;grid-column:span 3;text-align:center;">Games loading...</div>`;
    return;
  }

  grid.innerHTML = "";
  games.forEach((game, idx) => {
    const hue    = (idx * 37) % 360;
    const hasImg = game.image_url && !game.image_url.includes('placehold');
    grid.innerHTML += `
      <div class="game-card" onclick="alert('Launch ${game.name}')">
        ${hasImg
          ? `<img src="${game.image_url}" class="gc-bg" onerror="this.style.display='none'">`
          : `<div class="gc-bg" style="background:linear-gradient(145deg,hsl(${hue},60%,30%),hsl(${hue+20},70%,20%));"></div>
             <div class="gc-char">
               <svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.6">
                 <rect x="3" y="3" width="18" height="18" rx="4"/><circle cx="12" cy="12" r="3"/>
               </svg>
             </div>`}
        <div class="gc-label"><span>${game.name}</span></div>
      </div>`;
  });
}

// ============================================================
// [6] NAVIGATION
// ============================================================
function initNav() {
  const sidebar      = document.getElementById('sidebar');
  const homePageArea = document.getElementById('homePageArea');
  const agentPage    = document.getElementById('agentPage');

  function showPage(nav) {
    sidebar.style.display      = 'none';
    homePageArea.style.display = 'none';
    agentPage.classList.remove('active');

    if (nav === 'home') {
      sidebar.style.display      = 'flex';
      homePageArea.style.display = 'block';
    } else if (nav === 'agent') {
      agentPage.classList.add('active');
    }
    // tasks, cs, account → expand later
  }

  document.querySelectorAll(".bnav-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".bnav-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      showPage(btn.dataset.nav);
    });
  });

  document.querySelectorAll(".cat-item").forEach(item => {
    item.addEventListener("click", () => {
      document.querySelectorAll(".cat-item").forEach(el => el.classList.remove("active"));
      item.classList.add("active");
    });
  });

  // Language toggle
  document.getElementById("langBtn").addEventListener("click", () => {
    lang = lang === 'my' ? 'en' : 'my';
    document.getElementById('langLabel').textContent = lang === 'my' ? 'မြန်မာ' : 'EN';
  });
}

// ============================================================
// [7] AUTH
// ============================================================
function initAuth() {
  const modal       = document.getElementById("authModal");
  const showAuthBtn = document.getElementById("showAuthBtn");

  showAuthBtn.addEventListener("click", () => {
    modal.classList.add('active');
    switchTab('login');
  });
  document.getElementById('modalCloseBtn').addEventListener("click", () => {
    modal.classList.remove('active');
  });
  modal.addEventListener("click", e => {
    if (e.target === modal) modal.classList.remove('active');
  });

  // Register
  document.getElementById('registerBtn').addEventListener('click', handleRegister);

  // Login
  document.getElementById('loginBtn').addEventListener('click', handleLogin);
}

async function handleRegister() {
  const phone    = document.getElementById('regPhone').value.trim();
  const password = document.getElementById('regPassword').value.trim();
  const name     = document.getElementById('regName').value.trim();
  const refCode  = document.getElementById('referrer_code_input').value.trim();
  const checked  = document.getElementById('ageCheck').checked;

  if (!phone || !password || !name) return alert("အချက်အလက်များ ပြည့်စုံစွာ ဖြည့်ပါ");
  if (!checked) return alert("အသက် 18+ သတ်မှတ်ချက်ကို ဝန်ခံပါ");

  try {
    const resp = await fetch("https://xjqrwcsxiaybpztzestb.supabase.co/functions/v1/register-user", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": supabaseKey,
        "Authorization": "Bearer " + supabaseKey
      },
      body: JSON.stringify({ phone, password, fullname: name, referrer_code: refCode || null })
    });
    const result = await resp.json();
    if (resp.ok) {
      alert("မှတ်ပုံတင်ခြင်း အောင်မြင်သည်!\nReferral Code: " + result.ref_code);
      document.getElementById('authModal').classList.remove('active');
      onLoginSuccess({ phone, name }, result.ref_code);
    } else {
      alert("အမှားအယွင်း: " + result.error);
    }
  } catch (err) {
    console.error(err);
    alert("Edge Function နဲ့ ချိတ်ဆက်လို့ မရပါ");
  }
}

async function handleLogin() {
  const phone    = document.getElementById('loginPhone').value.trim();
  const password = document.getElementById('loginPassword').value.trim();
  if (!phone || !password) return alert("Phone & Password ဖြည့်ပါ");

  const { data, error } = await supabase.auth.signInWithPassword({
    email: `${phone}@diamondbett.com`,
    password
  });

  if (error) {
    alert("Login မအောင်မြင်ပါ: " + error.message);
  } else {
    const { data: userData } = await supabase
      .from('users').select('ref_code,fullname,phone').eq('id', data.user.id).single();
    document.getElementById('authModal').classList.remove('active');
    onLoginSuccess(userData || { phone }, userData?.ref_code);
  }
}

function onLoginSuccess(user, refCode) {
  currentUser    = user;
  currentRefCode = refCode;

  // Swap login btn → wallet btns
  document.getElementById('showAuthBtn').style.display = 'none';
  document.getElementById('walletBtns').style.display  = 'flex';

  // Agent data
  const phone    = user.phone || user.name || '—';
  const shareLink = refCode
    ? `https://diamond-bett.vercel.app/?ref=${refCode}`
    : '—';
  const today = new Date().toLocaleDateString('en-GB').replace(/\//g, '/');

  document.getElementById('agentUserPhone').textContent  = phone;
  document.getElementById('agentPhoneDisplay').textContent = phone;
  document.getElementById('agentJoinDate').textContent   = today;
  document.getElementById('agentShareLinkInput').value   = shareLink;

  // Unlock agent panel
  document.getElementById('agentLocked').style.display   = 'none';
  document.getElementById('agentUnlocked').style.display = 'block';

  // Ticker update
  const ticker = document.getElementById('agentTickerText');
  if (ticker && refCode) {
    const t = `🎰 သာ ကော်မရှင်: 0.00 &nbsp;&nbsp;&nbsp; 💎 Agent ID: ${refCode} &nbsp;&nbsp;&nbsp;`;
    ticker.innerHTML = t + t;
  }
}

// ============================================================
// [8] AGENT PAGE
// ============================================================
function initAgent() {
  // Agent login btn
  document.getElementById('agentLoginBtn').addEventListener("click", () => {
    document.getElementById('authModal').classList.add('active');
    switchTab('login');
  });

  // Agent tab switching
  document.getElementById('agentTabBar').addEventListener('click', e => {
    const btn = e.target.closest('.atab');
    if (!btn) return;
    document.querySelectorAll('.atab').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.atab-content').forEach(c => c.classList.remove('active'));
    btn.classList.add('active');
    const target = document.getElementById('atab-' + btn.dataset.atab);
    if (target) target.classList.add('active');
  });

  // Copy link button
  document.getElementById('agentCopyLinkBtn').addEventListener('click', copyAgentLink);
  document.getElementById('copyPhoneBtn').addEventListener('click', () => {
    const phone = document.getElementById('agentPhoneDisplay').textContent;
    navigator.clipboard.writeText(phone).then(() => alert("ကူးယူပြီးပါပြီ! ✓"));
  });

  // Native share
  document.getElementById('shareNativeBtn').addEventListener('click', async () => {
    const link = document.getElementById('agentShareLinkInput').value;
    if (!link || link === '—') return;
    if (navigator.share) {
      await navigator.share({ title: 'Diamond-BETT', text: 'Diamond-BETT မှ ဖိတ်ကြားပါသည်', url: link });
    } else {
      copyAgentLink();
    }
  });
}

function copyAgentLink() {
  const input = document.getElementById('agentShareLinkInput');
  if (!input.value || input.value === '—') return;
  navigator.clipboard.writeText(input.value)
    .then(() => alert("Link ကူးယူပြီးပါပြီ! ✓"))
    .catch(() => { input.select(); document.execCommand('copy'); alert("Link ကူးယူပြီးပါပြီ! ✓"); });
}

// ============================================================
// [9] SHARE VIA PLATFORM
// ============================================================
function shareVia(platform) {
  const link = document.getElementById('agentShareLinkInput')?.value;
  if (!link || link === '—') return alert("Login ဝင်ပြီးမှ Share လုပ်ပါ");
  const text = encodeURIComponent(`Diamond-BETT မှ ဖိတ်ကြားပါသည်! ${link}`);
  const urls = {
    telegram: `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${text}`,
    viber:    `viber://forward?text=${text}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(link)}`,
    whatsapp: `https://wa.me/?text=${text}`
  };
  if (urls[platform]) window.open(urls[platform], '_blank');
}

// ============================================================
// [10] COMMISSION COUNTDOWN
// ============================================================
function initCountdown() {
  const el = document.getElementById('commissionCountdown');
  if (!el) return;

  function update() {
    const now  = new Date();
    const next = new Date();
    next.setHours(24, 0, 0, 0); // midnight
    const diff = next - now;
    const h = String(Math.floor(diff / 3600000)).padStart(2, '0');
    const m = String(Math.floor((diff % 3600000) / 60000)).padStart(2, '0');
    const s = String(Math.floor((diff % 60000) / 1000)).padStart(2, '0');
    el.textContent = `(နောက်ခြေချချိန်: ${h}:${m}:${s})`;
  }
  update();
  setInterval(update, 1000);
}

// ============================================================
// GLOBAL HELPERS
// ============================================================
function switchTab(tab) {
  document.getElementById('registerForm').style.display = tab === 'register' ? 'block' : 'none';
  document.getElementById('loginForm').style.display    = tab === 'login'    ? 'block' : 'none';
  document.getElementById('tabRegister').classList.toggle('active', tab === 'register');
  document.getElementById('tabLogin').classList.toggle('active',    tab === 'login');
}

function toggleEye(inputId, btn) {
  const inp  = document.getElementById(inputId);
  const show = inp.type === 'password';
  inp.type   = show ? 'text' : 'password';
  btn.style.color = show ? '#f5c518' : 'rgba(255,255,255,.5)';
                                                 }
