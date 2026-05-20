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
      const { data: signData } = await window.DB.auth.signInWithPassword({
        email: `${phone}@diamondbett.com`, password
      });
      const uid = signData?.user?.id || null;

      gToast('မှတ်ပုံတင်ခြင်း အောင်မြင်သည်', 'success');
      document.getElementById('authModal')?.classList.remove('active');
      onLoginSuccess({ phone, name, ref_code: result.ref_code }, result.ref_code, 0, uid); // ← uid ပါးစ်လုပ်ပေးထားတယ်
    } else {
      gToast('အမှားအယွင်း: ' + result.error, 'error');
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

  document.getElementById('showAuthBtn').style.display  = 'none';
  document.getElementById('walletBtns').style.display   = 'flex';

  setEl('agentUserPhone',    phone);
  setEl('agentPhoneDisplay', phone);
  setEl('agentJoinDate',     new Date().toLocaleDateString('en-GB'));
  setEl('statBalance',       fmt(balance));
  setEl('userLevelNum',      '1');

  const linkInput = document.getElementById('agentShareLinkInput');
  if (linkInput) linkInput.value = shareLink;
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
