// ============================================================
// OPEN / CLOSE AUTH MODAL
// ============================================================
function openAuthModal(tab = 'login') {
  document.getElementById('authModal')?.classList.add('active');
  switchTab(tab);
}

// ============================================================
// SESSION RESTORE
// ============================================================
async function restoreSession(userId) {
  try {
    const { data: ud } = await window.DB
      .from('users')
      .select('ref_code,fullname,phone,balance')
      .eq('id', userId)
      .single();

    window.currentUserId  = userId;
    window.currentAgentId = userId;
    onLoginSuccess(ud || {}, ud?.ref_code, ud?.balance || 0, userId);
  } catch (e) {
    console.error('Session restore failed:', e);
  }
}

// ============================================================
// REGISTER (အလိုအလျောက် Auto-Login ဝင်ပြီး uid ပါးစ်လုပ်ရန် ပြင်ဆင်ပြီး)
// ============================================================
async function registerUser() {
  const phone    = document.getElementById('regPhone').value.trim();
  const password = document.getElementById('regPassword').value.trim();
  const name     = document.getElementById('regName').value.trim();
  const refCode  = document.getElementById('referrer_code_input').value.trim();
  const checked  = document.getElementById('ageCheck').checked;

  if (!phone || !password || !name) { gToast('အချက်အလက်များ ပြည့်စုံစွာ ဖြည့်ပါ'); return; }
  if (!checked) { gToast('အသက် 18+ သတ်မှတ်ချက်ကို ဝန်ခံပါ'); return; }

  // Validation: No spaces and no Myanmar characters in name
  if (/\s/.test(name) || /[\u1000-\u109F]/.test(name)) {
    gToast('နာမည်တွင် Space နှင့် မြန်မာစာ မသုံးရပါ (English Only)', 'error');
    return;
  }
  // Validation: No Myanmar characters in password
  if (/[\u1000-\u109F]/.test(password)) {
    gToast('စကားဝှက်တွင် မြန်မာစာ မသုံးရပါ', 'error');
    return;
  }

  const btn = document.getElementById('registerBtn');
  btn.disabled = true; btn.textContent = 'မှတ်ပုံတင်နေသည်...';

  try {
    const resp = await fetch(`${SUPA_URL}/functions/v1/register-user`, {
      method : 'POST',
      headers: {
        'Content-Type' : 'application/json',
        'apikey'       : SUPA_KEY,
        'Authorization': 'Bearer ' + SUPA_KEY
      },
      body: JSON.stringify({ phone, password, fullname: name, referrer_code: refCode || null })
    });
    const result = await resp.json();
    
    if (resp.ok) {
      // မှတ်ပုံတင်အောင်မြင်ရင် Auto Login တစ်ခါတည်းဝင်ပြီး uid ဆွဲထုတ်မယ်
      const { data: signData, error: signError } = await window.DB.auth.signInWithPassword({
        email: `${phone}@diamondbett.com`, password
      });
      
      if (signError) {
        gToast('မှတ်ပုံတင်အောင်မြင်သော်လည်း Login မဝင်နိုင်ပါ၊ ပြန်လည် Login ဝင်ပေးပါ', 'warning');
        switchTab('login');
        return;
      }

      const uid = signData?.user?.id || null;
      gToast('မှတ်ပုံတင်ခြင်း အောင်မြင်သည်', 'success');
      document.getElementById('authModal')?.classList.remove('active');
      onLoginSuccess({ phone, fullname: name, ref_code: result.ref_code }, result.ref_code, 0, uid);
    } else {
      // Handle Supabase error message more gracefully
      let errMsg = result.error || 'မသိရသောအမှား';
      if (errMsg.includes('already been registered')) {
        errMsg = 'ဤဖုန်းနံပါတ်ဖြင့် အကောင့်ရှိပြီးသားဖြစ်သည်';
      }
      gToast('အမှားအယွင်း: ' + errMsg, 'error');
    }
  } catch (err) {
    console.error(err);
    gToast('Edge Function ချိတ်ဆက်မရပါ', 'error');
  } finally {
    btn.disabled = false; btn.textContent = 'မှတ်ပုံတင်မည်';
  }
}

// ============================================================
// LOGIN
// ============================================================
async function loginUser() {
  const phone    = document.getElementById('loginPhone').value.trim();
  const password = document.getElementById('loginPassword').value.trim();
  if (!phone || !password) { gToast('Phone နှင့် Password ဖြည့်ပါ'); return; }

  // Validation: No Myanmar characters in password
  if (/[\u1000-\u109F]/.test(password)) {
    gToast('စကားဝှက်တွင် မြန်မာစာ မသုံးရပါ', 'error');
    return;
  }

  const btn = document.getElementById('loginBtn');
  btn.disabled = true; btn.textContent = 'ဝင်နေသည်...';

  try {
    const { data, error } = await window.DB.auth.signInWithPassword({
      email: `${phone}@diamondbett.com`, password
    });
    if (error) { gToast('Login မအောင်မြင်ပါ: ' + error.message, 'error'); return; }

    const { data: ud } = await window.DB
      .from('users')
      .select('ref_code,fullname,phone,balance')
      .eq('id', data.user.id)
      .single();

    document.getElementById('authModal')?.classList.remove('active');
    window.currentUserId  = data.user.id;
    window.currentAgentId = data.user.id;
    onLoginSuccess(ud || { phone }, ud?.ref_code, ud?.balance, data.user.id);
  } finally {
    btn.disabled = false; btn.textContent = 'ဝင်ရောက်မည်';
  }
}

// ============================================================
// ON LOGIN SUCCESS
// ============================================================
function onLoginSuccess(user, refCode, balance = 0, userId = null) {
  if (userId) {
    window.currentUserId  = userId;
    window.currentAgentId = userId;
    sessionStorage.setItem('_db_uid', userId);
  }

  const phone        = user.phone || user.name || '—';
  const agentRefCode = refCode || user.ref_code || '—';
  const shareLink    = agentRefCode !== '—'
    ? `https://diamond-bett.vercel.app/?ref=${agentRefCode}` : '—';
  const bal          = parseFloat(balance || 0);

  document.getElementById('showAuthBtn').style.display  = 'none';
  document.getElementById('walletBtns').style.display   = 'flex';

  // ── payLogos & balanceBar ──────────────────────────────────
  const payLogos = document.getElementById('payLogos');
  const balWrap  = document.getElementById('qnavBalanceWrap');
  if (payLogos) payLogos.style.display = 'flex';
  if (balWrap)  balWrap.style.display  = 'flex';

  // ── Balance Bar populate ───────────────────────────────────
  // Show fullname (not phone) in balance bar
  const displayName = user.fullname || user.name || phone;
  setEl('balUsername', displayName);
  const qnavBal = document.getElementById('qnavBalance');
  if (qnavBal) {
    qnavBal.textContent = bal.toLocaleString('en-US', {
      minimumFractionDigits: 2, maximumFractionDigits: 2
    });
  }
  // Generate unique Cyberpunk NFT avatar for this user
  if (typeof generateNFTAvatar === 'function') {
    generateNFTAvatar(userId || window.currentUserId || displayName);
  }
  // ──────────────────────────────────────────────────────────

  setEl('agentUserPhone',    phone);
  setEl('agentPhoneDisplay', phone);
  setEl('agentJoinDate',     new Date().toLocaleDateString('en-GB'));
  setEl('statBalance',       fmt(balance));
  setEl('userLevelNum',      '1');

  const linkInput = document.getElementById('agentShareLinkInput');
  if (linkInput) {
    linkInput.value = shareLink;
    // Explicitly generate QR
    if (typeof generateAgentQR === 'function') generateAgentQR(shareLink);
  }
  const invRef  = document.getElementById('inv-refcode');
  const invLink = document.getElementById('inv-link');
  if (invRef)  invRef.textContent = agentRefCode;
  if (invLink) invLink.value      = shareLink;

  document.getElementById('agentLocked').style.display   = 'none';
  document.getElementById('agentUnlocked').style.display = 'flex';

  window.availableSpins = 1;
  setEl('availableSpins', 1);
  if (document.getElementById('spinBtn'))
    document.getElementById('spinBtn').disabled = false;

  if (window.currentUserId) {
    loadDashboardStats(window.currentUserId);
    initLinked();
  }

  // ── Populate Account Page ──────────────────────────────
  const shortId = (() => {
    if (!userId) return '000000000';
    const hex = userId.replace(/-/g, '').slice(0, 10);
    return String(Math.abs(parseInt(hex, 16)) % 1000000000).padStart(9, '0');
  })();
  const acctGuest = document.getElementById('acctGuest');
  const acctBody  = document.getElementById('acctBody');
  if (acctGuest) acctGuest.style.display = 'none';
  if (acctBody)  acctBody.style.display  = 'flex';
  setEl('acctName', displayName);
  setEl('acctId',   shortId);
  const acctBalEl = document.getElementById('acctHeaderBal');
  if (acctBalEl) acctBalEl.textContent = bal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (typeof generateNFTAvatar === 'function')
    generateNFTAvatar(userId || displayName, 'acctAvatar', 52);
}

// ============================================================
// COPY LINK
// ============================================================
function copyAgentLink() {
  const input = document.getElementById('agentShareLinkInput');
  if (!input?.value || input.value === '—') return;
  navigator.clipboard.writeText(input.value)
    .then(() => gToast('Link ကူးပြီးပါပြီ', 'success'))
    .catch(() => { input.select(); document.execCommand('copy'); gToast('Link ကူးပြီးပါပြီ', 'success'); });
    }
