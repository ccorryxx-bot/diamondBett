// ============================================================
// OPEN WITHDRAW
// ============================================================
async function openWithdrawModal() {
  // Real-time auth check
  const uid = await getAuthUid();
  if (!uid) { openAuthModal('login'); return; }
  window.currentUserId = uid; // sync

  const modal = document.getElementById('withdrawModal');
  if (!modal) { console.error('withdrawModal not in DOM'); return; }

  modal.classList.add('open');
  const bal = document.getElementById('statBalance')?.textContent || '0.00';
  setEl('wdBalShow', bal);
  setEl('wdBalAmt',  bal + ' ကျပ်');
  await initLinked();
  switchWdTab('wd', document.querySelectorAll('.wd-tab')[0]);
}

function switchWdTab(tab, el) {
  document.querySelectorAll('.wd-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.wd-content').forEach(c => c.classList.remove('active'));
  if (el) el.classList.add('active');
  const c = document.getElementById('wdTab-' + tab);
  if (c) c.classList.add('active');
  if (tab === 'hist') loadTxHistory();
}

// ============================================================
// LINKED ACCOUNT — DB is source of truth (Issue 2 fix)
// localStorage is used only as a display cache (speed).
// Actual withdrawal always reads from DB — not from cache.
// ============================================================
async function initLinked() {
  const uid = window.currentUserId;
  if (!uid || !window.DB) return;

  // Show cached data instantly while DB fetch runs (UX)
  const cached = localStorage.getItem('db_linked');
  if (cached) {
    try {
      window._linked = JSON.parse(cached);
      renderLinked();
    } catch(e) {
      localStorage.removeItem('db_linked');
    }
  }

  // Always sync from DB — DB is the source of truth
  try {
    const { data, error } = await window.DB
      .from('users')
      .select('withdrawal_method, withdrawal_account, withdrawal_name')
      .eq('id', uid)
      .single();

    if (error || !data?.withdrawal_account) {
      window._linked = null;
      localStorage.removeItem('db_linked');
      const noAcct  = document.getElementById('wdNoAcct');
      const hasAcct = document.getElementById('wdHasAcct');
      if (noAcct)  noAcct.style.display  = 'block';
      if (hasAcct) hasAcct.style.display = 'none';
      return;
    }

    const provider = (data.withdrawal_method || '').toLowerCase().includes('wave') ? 'wave' : 'kbz';
    window._linked = {
      provider,
      name  : data.withdrawal_name    || '',
      number: data.withdrawal_account || '',
    };
    // Refresh localStorage cache with verified DB data
    localStorage.setItem('db_linked', JSON.stringify(window._linked));
    renderLinked();
  } catch(e) {
    // Network error — keep showing cached data if any, but flag as unverified
    console.warn('initLinked: DB sync failed, using cache', e);
  }
}

function renderLinked() {
  if (!window._linked) return;
  document.getElementById('wdNoAcct').style.display  = 'none';
  document.getElementById('wdHasAcct').style.display = 'block';
  document.getElementById('wdLinkedLogo').innerHTML  = getProvLogo(window._linked.provider, 40);
  setEl('wdLinkedName', (window._linked.provider === 'kbz' ? 'KBZ Pay' : 'Wave Money')
    + ' · ' + window._linked.name);
  setEl('wdLinkedNum', maskNum(window._linked.number));
  updateLinkTab();
}

function updateLinkTab() {
  if (!window._linked) return;
  const isKbz   = window._linked.provider === 'kbz';
  const itemId  = isKbz ? 'kbzItem'      : 'waveItem';
  const txtId   = isKbz ? 'kbzLinkedTxt' : 'waveLinkedTxt';
  const btnId   = isKbz ? 'kbzLinkBtn'   : 'waveLinkBtn';
  const otherBtn= isKbz ? 'waveLinkBtn'  : 'kbzLinkBtn';

  document.getElementById(itemId)?.classList.add('linked');
  setEl(txtId, window._linked.name + ' · ' + maskNum(window._linked.number));

  const btn = document.getElementById(btnId);
  if (btn) { btn.textContent = 'ချိတ်ပြီး'; btn.classList.add('linked'); btn.disabled = true; }

  if (!document.querySelector('#' + itemId + ' .acct-linked-badge')) {
    const badge = document.createElement('div');
    badge.className   = 'acct-linked-badge';
    badge.textContent = 'ချိတ်ပြီး';
    document.getElementById(itemId)?.prepend(badge);
  }

  const ob = document.getElementById(otherBtn);
  if (ob) { ob.disabled = true; ob.style.opacity = '.35'; }
}

// ============================================================
// LINK SHEET
// ============================================================
function openSheet(prov) {
  if (window._linked) { gToast('အကောင် ချိတ်ပြီးသားဖြစ်၍ မပြောင်းနိုင်ပါ'); return; }
  window._curProv = prov;
  document.getElementById('acctSheet')?.classList.add('open');
  setEl('sheetTitle', (prov === 'kbz' ? 'KBZ Pay' : 'Wave Money') + ' ချိတ်ဆောင်ရန်');
  const icon = document.getElementById('sheetProvIcon');
  if (icon) icon.innerHTML = getProvLogo(prov, 24);
  document.getElementById('lnkName').value = '';
  document.getElementById('lnkNum').value  = '';
}

function closeSheet() {
  document.getElementById('acctSheet')?.classList.remove('open');
}

async function doPaste(id) {
  try {
    document.getElementById(id).value = await navigator.clipboard.readText();
  } catch { /* permission denied */ }
}

// FIX (Issue 2): confirmLink now awaits DB save — data is in DB before UI updates.
// localStorage is only written after DB confirms success.
async function confirmLink() {
  const name = document.getElementById('lnkName').value.trim();
  const num  = document.getElementById('lnkNum').value.trim();
  if (!name)              { gToast('နာမည် ထည့်ပါ');             return; }
  if (!num || num.length < 9) { gToast('ဖုန်းနံပါတ် မှန်ကန်စွာ ထည့်ပါ'); return; }

  if (!window.currentUserId) { gToast('Login ဝင်ပါ', 'error'); return; }

  // Disable confirm button during save
  const confirmBtn = document.querySelector('#acctSheet button[onclick*="confirmLink"]');
  if (confirmBtn) { confirmBtn.disabled = true; confirmBtn.textContent = 'သိမ်းနေသည်...'; }

  try {
    const { error } = await window.DB.from('users').update({
      withdrawal_method : window._curProv === 'kbz' ? 'KBZ Pay' : 'Wave Money',
      withdrawal_account: num,
      withdrawal_name   : name,
    }).eq('id', window.currentUserId);

    if (error) throw error;

    // DB saved — now safe to update cache and in-memory state
    window._linked = { provider: window._curProv, name, number: num };
    localStorage.setItem('db_linked', JSON.stringify(window._linked));

    closeSheet();
    renderLinked();
    updateLinkTab();
    gToast('အကောင် ချိတ်ဆောင်ပြီးပါပြီ', 'success');
  } catch(e) {
    gToast('သိမ်းမရပါ: ' + (e.message || 'ထပ်ကြိုးစားပါ'), 'error');
  } finally {
    if (confirmBtn) { confirmBtn.disabled = false; confirmBtn.textContent = 'ချိတ်ဆောင်မည်'; }
  }
}

// ============================================================
// WITHDRAW REQUEST
// FIX (Issue 2): wallet info is fetched FRESH from DB on every
// submit — localStorage/window._linked are never used as the
// payment target, so they cannot be tampered with.
// ============================================================
async function doWithdraw() {
  if (!window.currentUserId) return;
  const amount = parseFloat(document.getElementById('wdAmtInput').value);
  if (!amount || amount <= 0) { gToast('ပမာဏ ထည့်ပါ'); return; }

  const btn = document.getElementById('wdSubmitBtn');
  btn.disabled = true; btn.textContent = 'စစ်ဆေးနေသည်...';

  try {
    // Fetch user balance + verified wallet info + site limits in parallel
    const [uRes, sRes] = await Promise.all([
      window.DB.from('users')
        .select('balance,remaining_turnover,withdrawal_method,withdrawal_account,withdrawal_name')
        .eq('id', window.currentUserId).single(),
      window.DB.from('site_settings')
        .select('min_withdrawal,max_withdrawal')
        .eq('id', 1).single()
    ]);

    if (uRes.error || sRes.error) throw new Error('ဒေတာ ဆွဲမရပါ');

    // ── Verified wallet from DB (not from localStorage) ──────────────────
    const walletMethod  = uRes.data?.withdrawal_method  || null;
    const walletNumber  = uRes.data?.withdrawal_account || null;
    if (!walletMethod || !walletNumber) {
      gToast('ငွေထုတ်မည့် ဖုန်းအကောင် မချိတ်ရသေးပါ', 'error');
      resetWdBtn(); return;
    }

    const tv  = parseFloat(uRes.data?.remaining_turnover || 0);
    const bal = parseFloat(uRes.data?.balance || 0);
    const min = parseFloat(sRes.data?.min_withdrawal || 10000);
    const max = parseFloat(sRes.data?.max_withdrawal || 1000000);

    if (tv > 0) {
      setEl('tvAmtVal', tv.toLocaleString());
      document.getElementById('tvModal')?.classList.add('open');
      document.getElementById('wdTvBar').style.display = 'block';
      setEl('wdTvAmt', tv.toLocaleString() + ' ကျပ်');
      resetWdBtn(); return;
    }
    if (amount < min) { gToast('အနည်းဆုံး ' + min.toLocaleString() + ' ကျပ်', 'error'); resetWdBtn(); return; }
    if (amount > max) { gToast('အများဆုံး ' + max.toLocaleString() + ' ကျပ်', 'error'); resetWdBtn(); return; }
    if (amount > bal) { gToast('Balance မလုံလောက်ပါ', 'error'); resetWdBtn(); return; }

    const { error: txErr } = await window.DB.from('transactions').insert([{
      user_id        : window.currentUserId,
      type           : 'withdrawal',
      amount,
      payment_method : walletMethod,
      payment_details: walletNumber,
      status         : 'pending'
    }]);
    if (txErr) throw txErr;

    document.getElementById('withdrawModal')?.classList.remove('open');
    gToast('ငွေထုတ် တောင်းဆိုမှု အောင်မြင်ပါသည်\nဒိုင်မှ မိနစ် ၃၀ အတွင်း ဆက်သွယ်ပါမည်', 'success');
  } catch (e) {
    gToast('မအောင်မြင်ပါ: ' + (e.message || 'ထပ်စမ်းပါ'), 'error');
    resetWdBtn();
  }
}

function resetWdBtn() {
  const btn = document.getElementById('wdSubmitBtn');
  if (btn) { btn.disabled = false; btn.textContent = 'ငွေထုတ်တောင်းဆိုမည်'; }
}

// ============================================================
// TRANSACTION HISTORY
// ============================================================
async function loadTxHistory() {
  if (!window.currentUserId) return;
  const { data, error } = await window.DB
    .from('transactions')
    .select('*')
    .eq('user_id', window.currentUserId)
    .order('created_at', { ascending: false })
    .limit(25);

  const list  = document.getElementById('txList');
  const empty = document.getElementById('txEmpty');
  if (!list) return;

  if (error || !data?.length) { if (empty) empty.style.display = 'flex'; return; }
  if (empty) empty.style.display = 'none';

  list.innerHTML = data.map(tx => {
    const isDep  = tx.type === 'deposit';
    const date   = new Date(tx.created_at).toLocaleDateString('en-GB');
    const sc     = tx.status === 'approved' ? 'approved'
                 : tx.status === 'rejected' ? 'rejected' : 'pending';
    const stxt   = sc === 'approved' ? 'အတည်ပြုပြီး'
                 : sc === 'rejected' ? 'ငြင်းပယ်ပြီး' : 'စောင့်ဆိုင်း';
    const color  = isDep ? '#22c55e' : '#ef4444';
    return `<div class="tx-item">
      <div class="tx-ico ${isDep ? 'dep' : 'wd'}">
        ${isDep ? icon('deposit',16,color) : icon('withdraw',16,color)}
      </div>
      <div class="tx-info">
        <div class="tx-type">${isDep ? 'ငွေသွင်း' : 'ငွေထုတ်'}</div>
        <div class="tx-date">${date} · ${tx.payment_method || '—'}</div>
        <div class="tx-badge ${sc}">${stxt}</div>
      </div>
      <div class="tx-amount" style="color:${color}">
        ${isDep ? '+' : '-'}${parseFloat(tx.amount).toLocaleString()}
        <div style="font-size:9px;color:#555;font-weight:400;margin-top:2px;">ကျပ်</div>
      </div>
    </div>`;
  }).join('');
}
