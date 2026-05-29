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
    if (adminBtn) adminBtn.style.display = 'flex';
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

  // Auto-fill referral code from URL ?ref= param
  try {
    const urlRef = new URLSearchParams(window.location.search).get('ref');
    if (urlRef) {
      const refInput = document.getElementById('referrer_code_input');
      if (refInput) refInput.value = urlRef.trim();
    }
  } catch(e) {}
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
  window._authFlowActive = true;

  try {
    // Generate unique ref code e.g. "D-A3B9K"
    const refCodeNew = 'D-' + Math.random().toString(36).toUpperCase().slice(2, 7);
    const email      = `p_${phone.replace(/\D/g,'')}@diamondbett.com`;

    // Step 1: Create Supabase Auth user
    const { data: signUpData, error: signUpErr } = await window.DB.auth.signUp({ email, password });

    if (signUpErr) {
      const raw = signUpErr.message || '';
      let errMsg;
      if (raw.includes('already registered') || raw.includes('already been registered') || raw.includes('User already registered')) {
        errMsg = 'ဤဖုန်းနံပါတ်ဖြင့် အကောင့်ရှိပြီးသားဖြစ်သည် — Login ဝင်ပါ';
      } else if (raw.includes('rate') || raw.includes('Rate') || raw.includes('429') || raw.includes('exceeded')) {
        errMsg = 'ကြိုးစားမှု အများကြီး ရှိနေသည် — ခဏနေ ထပ်ကြိုးစားပါ';
      } else if (raw.includes('fetch') || raw.includes('network') || raw.includes('Network')) {
        errMsg = 'ကွန်နက်ရှင် မကောင်းပါ — internet စစ်ပြီး ထပ်ကြိုးစားပါ';
      } else if (raw.includes('invalid') || raw.includes('Invalid')) {
        errMsg = 'ဖောင် အချက်အလက် မှားယွင်းနေသည် — ထပ်စစ်ဆေးပါ';
      } else {
        errMsg = 'မှတ်ပုံတင် မအောင်မြင်ပါ — ထပ်ကြိုးစားပါ';
      }
      gToast(errMsg, 'error');
      return;
    }

    const uid = signUpData?.user?.id;
    if (!uid) { gToast('အကောင့်ဖန်တီး မအောင်မြင်ပါ', 'error'); return; }

    // Step 2: Find referrer if ref code provided
    let referrerId = null;
    if (refCode) {
      const { data: refUser } = await window.DB
        .from('users')
        .select('id')
        .eq('ref_code', refCode)
        .single();
      if (refUser) referrerId = refUser.id;
    }

    // Step 3: Insert into users table
    const { error: insertErr } = await window.DB.from('users').insert([{
      id          : uid,
      phone,
      fullname    : name,
      balance     : 0,
      role        : 'player',
      ref_code    : refCodeNew,
      referrer_id : referrerId,
      is_admin    : false,
    }]);

    if (insertErr) {
      // If duplicate (user already exists in users table), just continue
      if (!insertErr.message?.includes('duplicate') && !insertErr.code?.includes('23505')) {
        gToast('ပရိုဖိုင် ဖန်တီး မအောင်မြင်ပါ: ' + insertErr.message, 'error');
        return;
      }
    }

    // Step 4: Use session from signUp directly (mailer_autoconfirm=true means session is returned immediately).
    // DO NOT call signInWithPassword here — doing so fires SIGNED_OUT on the signUp session,
    // which triggers the onAuthStateChange handler to re-open the auth modal (the bug).
    const autoSession = signUpData?.session;
    if (!autoSession) {
      // Fallback: autoconfirm may be off — ask user to log in manually
      gToast('မှတ်ပုံတင်အောင်မြင်သည် — Login ဝင်ပေးပါ', 'success');
      if (typeof switchTab === 'function') switchTab('login');
      return;
    }

    gToast('မှတ်ပုံတင်ခြင်း အောင်မြင်သည် 🎉', 'success');
    document.getElementById('authModal')?.classList.remove('active');
    localStorage.setItem('_db_phone', phone);
    localStorage.setItem('_db_pass',  password);
    localStorage.removeItem('_db_logout');
    onLoginSuccess({ phone, fullname: name, ref_code: refCodeNew }, refCodeNew, 0, uid);

  } catch (err) {
    console.error('registerUser error:', err);
    gToast('မှတ်ပုံတင် မအောင်မြင်ပါ — ထပ်ကြိုးစားပါ', 'error');
  } finally {
    btn.disabled = false; btn.textContent = 'မှတ်ပုံတင်မည်';
    window._authFlowActive = false;
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
  window._authFlowActive = true;

  try {
    const { data, error } = await window.DB.auth.signInWithPassword({
      email: `p_${phone.replace(/\D/g,'')}@diamondbett.com`, password
    });
    if (error) {
      const raw = error.message || '';
      let errMsg;
      if (raw.includes('Invalid login') || raw.includes('invalid credentials') || raw.includes('Invalid credentials')) {
        errMsg = 'ဖုန်းနံပါတ် သို့မဟုတ် စကားဝှက် မှားနေသည်';
      } else if (raw.includes('Email not confirmed') || raw.includes('email not confirmed')) {
        errMsg = 'အကောင့် မှတ်ပုံတင်မပြီးသေးပါ — CS ကို ဆက်သွယ်ပါ';
      } else if (raw.includes('rate') || raw.includes('Rate') || raw.includes('429') || raw.includes('exceeded')) {
        errMsg = 'ကြိုးစားမှု အများကြီး ရှိနေသည် — မိနစ်အနည်းငယ် နေပြီး ထပ်ကြိုးစားပါ';
      } else if (raw.includes('fetch') || raw.includes('network') || raw.includes('Network') || raw.includes('Failed')) {
        errMsg = 'ကွန်နက်ရှင် မကောင်းပါ — internet စစ်ပြီး ထပ်ကြိုးစားပါ';
      } else {
        errMsg = 'Login မအောင်မြင်ပါ — ထပ်ကြိုးစားပါ';
      }
      gToast(errMsg, 'error');
      return;
    }

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
    if (adminBtn) adminBtn.style.display = 'flex';
    // Save credentials for pre-fill + clear logout flag
    localStorage.setItem('_db_phone', phone);
    localStorage.setItem('_db_pass',  password);
    localStorage.removeItem('_db_logout');
    onLoginSuccess(ud || { phone }, ud?.ref_code, ud?.balance, data.user.id);
  } finally {
    btn.disabled = false; btn.textContent = 'ဝင်ရောက်မည်';
    window._authFlowActive = false;
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

  // Compute shortId early so it can be used anywhere in this function
  const shortId = (() => {
    const uid = userId || window.currentUserId;
    if (!uid) return '000000000';
    const hex = uid.replace(/-/g, '').slice(0, 10);
    return String(Math.abs(parseInt(hex, 16)) % 1000000000).padStart(9, '0');
  })();

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

  setEl('agentUserPhone',    agentRefCode);
  setEl('agentPhoneDisplay', agentRefCode);
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
  // (shortId already computed above)
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
