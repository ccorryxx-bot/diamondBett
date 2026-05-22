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
    const { data: ud, error } = await window.DB
      .from('users')
      .select('ref_code,fullname,phone,balance,is_admin,role,total_deposited')
      .eq('id', userId)
      .single();

    if (error || !ud) { console.warn('restoreSession: user not found'); return; }

    window.currentUserId  = userId;
    window.currentAgentId = userId;
    window.currentIsAdmin = !!(ud.is_admin);
    const adminBtn = document.getElementById('adminDashBtn');
    if (adminBtn) adminBtn.style.display = window.currentIsAdmin ? 'flex' : 'none';
    onLoginSuccess(ud, ud.ref_code, ud.balance || 0, userId);
  } catch (e) {
    console.error('Session restore failed:', e);
  }
}

// ── Pre-fill LOGIN form from last credentials ─────────────────────────────
function prefillLoginForm() {
  const phone = localStorage.getItem('_db_phone') || '';
  const pass  = localStorage.getItem('_db_pass')  || '';
  if (!phone && !pass) return;

  // Always switch to LOGIN tab first (not register)
  if (typeof switchTab === 'function') switchTab('login');

  const phoneEl = document.getElementById('loginPhone');
  const passEl  = document.getElementById('loginPassword');
  if (phoneEl && phone) phoneEl.value = phone;
  if (passEl  && pass)  passEl.value  = pass;

  // Clear register form so browser autofill doesn't bleed over
  const regName  = document.getElementById('regName');
  const regPhone = document.getElementById('regPhone');
  const regPass  = document.getElementById('regPassword');
  if (regName)  regName.value  = '';
  if (regPhone) regPhone.value = '';
  if (regPass)  regPass.value  = '';
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
      .select('ref_code,fullname,phone,balance,is_admin,role,total_deposited')
      .eq('id', data.user.id)
      .single();

    document.getElementById('authModal')?.classList.remove('active');
    window.currentUserId  = data.user.id;
    window.currentAgentId = data.user.id;
    window.currentIsAdmin = !!(ud?.is_admin);
    // Show admin button if applicable
    const adminBtn = document.getElementById('adminDashBtn');
    if (adminBtn) adminBtn.style.display = window.currentIsAdmin ? 'flex' : 'none';
    // Save credentials for pre-fill + clear logout flag
    localStorage.setItem('_db_phone', phone);
    localStorage.setItem('_db_pass',  password);
    localStorage.removeItem('_db_logout');
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

  const displayName = user.fullname || user.name || phone;
  const fmt2 = bal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // Update all header instances (Home & Agent)
  document.querySelectorAll('#showAuthBtn').forEach(el => el.style.display = 'none');
  document.querySelectorAll('#walletBtns').forEach(el => el.style.display = 'flex');
  document.querySelectorAll('#qnavBalanceWrap').forEach(el => el.style.display = 'flex');
  document.querySelectorAll('#payLogos').forEach(el => el.style.display = 'flex');

  // Populate all balance/username fields
  document.querySelectorAll('#balUsername').forEach(el => el.textContent = displayName);
  document.querySelectorAll('#qnavBalance').forEach(el => el.textContent = fmt2);
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

  // ── Spin count: check DB for today's spin history ──────
  window.availableSpins = 0;
  setEl('availableSpins', 0);
  if (document.getElementById('spinBtn')) document.getElementById('spinBtn').disabled = true;

  if (userId && window.DB) {
    const todayISO = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    
    // Optimization: Run independent async tasks in parallel
    const loginTasks = [];

    // Task 1: Check lucky wheel
    loginTasks.push(
      window.DB.from('lucky_wheel_history')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .gte('spun_at', todayISO + 'T00:00:00')
        .then(({ count, error }) => {
          const spunToday = !error && count > 0;
          window.availableSpins = spunToday ? 0 : 1;
          setEl('availableSpins', window.availableSpins);
          const spinBtn = document.getElementById('spinBtn');
          if (spinBtn) spinBtn.disabled = spunToday;
        })
    );

    // Task 2: Load dashboard stats
    if (typeof loadDashboardStats === 'function') {
      loginTasks.push(loadDashboardStats(userId));
    }

    // Task 3: Initialize linked accounts
    if (typeof initLinked === 'function') {
      initLinked(); // This is local, but good to keep in sequence
    }

    Promise.all(loginTasks).catch(err => console.error('onLoginSuccess parallel tasks failed:', err));
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

  // ── Load VIP + subscribe Realtime ─────────────────────
  if (userId && window.DB) {
    // Optimization: Since we already have the user object in restoreSession/loginUser, 
    // we should use the balance/deposited from there if possible, 
    // but here we ensure loadUserVip gets the latest data.
    const dep = parseFloat(user.total_deposited || 0);
    
    if (typeof loadUserVip === 'function') {
      loadUserVip(userId, dep);
    }
    
    if (typeof subscribeVipRealtime === 'function') {
      subscribeVipRealtime(userId);
    }
  }
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
