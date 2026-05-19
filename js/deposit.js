// ============================================================
// STATE
// ============================================================
// (module-level — no window needed)
let _dMethod = null;
let _dAmt    = 0;
let _dBonus  = true;

// ============================================================
// OPEN DEPOSIT
// ============================================================
async function openDepositModal() {
  // Real-time auth check — window.currentUserId ကို မှီမနေ
  const uid = await getAuthUid();
  if (!uid) { openAuthModal('login'); return; }
  window.currentUserId = uid; // sync

  const modal = document.getElementById('depositModal');
  if (!modal) { console.error('depositModal not in DOM'); return; }

  modal.classList.add('open');
  document.getElementById('depStep1').style.display = 'block';
  document.getElementById('depStep2').style.display = 'none';
  document.getElementById('depBalShow').textContent =
    document.getElementById('statBalance')?.textContent || '0.00';

  // Reset state
  _dMethod = null; _dAmt = 0; _dBonus = true;
  document.querySelectorAll('.amt-btn').forEach(b => b.classList.remove('selected'));
  document.getElementById('depAmtInput').value = '';
  document.getElementById('bOptYes').classList.add('selected');
  document.getElementById('bOptNo').classList.remove('selected');
  document.getElementById('depPreview').style.display = 'block';
  updatePreview();
  fetchDepMethods();
}

// ============================================================
// FETCH PAYMENT METHODS
// ============================================================
async function fetchDepMethods() {
  const grid = document.getElementById('depMethodGrid');
  if (!grid) return;
  grid.innerHTML = `<div style="grid-column:span 2;padding:20px;text-align:center;">
    <div class="md-spin" style="margin:0 auto;"></div></div>`;

  const { data, error } = await window.DB
    .from('payment_methods')
    .select('id,provider_name,account_name,account_number,is_recommended')
    .eq('is_active', true);

  if (error || !data?.length) {
    grid.innerHTML = `<div style="grid-column:span 2;text-align:center;
      color:#555;font-size:12px;padding:20px;">ငွေသွင်းနည်းလမ်း မရှိသေးပါ</div>`;
    return;
  }

  window._depMethods = data;
  grid.innerHTML = data.map((m, i) => `
    <div class="pm-card" onclick="pickMethod(this,${i})">
      ${m.is_recommended ? '<div class="pm-badge">ဦးစားပေး</div>' : ''}
      <div class="pm-logo">${getProvSvg(m.provider_name, 40)}</div>
      <div class="pm-info">
        <div class="pm-name">${m.provider_name}</div>
        <div class="pm-num">${maskNum(m.account_number)}</div>
      </div>
      <span class="pm-check">${icon('check', 14, '#f5c518')}</span>
    </div>`).join('');
}

// ============================================================
// AMOUNT / BONUS
// ============================================================
function pickMethod(el, idx) {
  _dMethod = window._depMethods[idx];
  document.querySelectorAll('#depMethodGrid .pm-card').forEach(c => c.classList.remove('selected'));
  el.classList.add('selected');
}

function pickAmt(el, amt) {
  _dAmt = amt;
  document.querySelectorAll('.amt-btn').forEach(b => b.classList.remove('selected'));
  el.classList.add('selected');
  document.getElementById('depAmtInput').value = amt;
  updatePreview();
}

function onAmtType(val) {
  _dAmt = parseFloat(val) || 0;
  document.querySelectorAll('.amt-btn').forEach(b => b.classList.remove('selected'));
  updatePreview();
}

function pickBonus(yes) {
  _dBonus = yes;
  document.getElementById('bOptYes').classList.toggle('selected', yes);
  document.getElementById('bOptNo').classList.toggle('selected', !yes);
  document.getElementById('depPreview').style.display = yes ? 'block' : 'none';
  updatePreview();
}

function updatePreview() {
  const bonus = _dBonus ? _dAmt : 0;
  setEl('pvDep',   _dAmt.toLocaleString() + ' ကျပ်');
  setEl('pvBonus', '+ ' + bonus.toLocaleString() + ' ကျပ်');
  setEl('pvTotal', (_dAmt + bonus).toLocaleString() + ' ကျပ်');
}

// ============================================================
// STEP 2
// ============================================================
function goStep2() {
  if (!_dMethod)               { gToast('ငွေပေးချေနည်းလမ်း ရွေးပါ');      return; }
  if (!_dAmt || _dAmt < 3000) { gToast('အနည်းဆုံး 3,000 ကျပ် ထည့်ပါ'); return; }

  document.getElementById('depStep1').style.display = 'none';
  document.getElementById('depStep2').style.display = 'block';

  document.getElementById('dep2Logo').innerHTML = getProvSvg(_dMethod.provider_name, 40);
  setEl('dep2Name',  _dMethod.provider_name);
  setEl('dep2Phone', _dMethod.account_number);
  setEl('dep2Amt',   _dAmt.toLocaleString() + ' ကျပ်');

  const ord = 'DEP-' + Date.now().toString().slice(-8);
  window._depOrd = ord;
  setEl('dep2Order', ord);

  document.querySelectorAll('.slip-box').forEach(b => b.value = '');
  startCd(30 * 60);
}

function startCd(sec) {
  clearInterval(window._cdTimer);
  const el = document.getElementById('depCd');
  let rem = sec;
  const tick = () => {
    const m = Math.floor(rem / 60), s = rem % 60;
    if (el) el.textContent = String(m).padStart(2,'0') + ':' + String(s).padStart(2,'0');
    if (rem <= 0) {
      clearInterval(window._cdTimer);
      const badge = el?.closest('.countdown-badge');
      if (badge) badge.style.background = '#444';
    }
    rem--;
  };
  tick();
  window._cdTimer = setInterval(tick, 1000);
}

function slipMove(el, idx) {
  const boxes = document.querySelectorAll('.slip-box');
  if (el.value && idx < boxes.length - 1) boxes[idx + 1].focus();
}

function cpText(id) {
  const val = document.getElementById(id)?.textContent;
  if (val) navigator.clipboard.writeText(val).then(() => gToast('ကူးပြီးပါပြီ', 'success'));
}

function cpVal(val) {
  if (!val) return;
  navigator.clipboard.writeText(String(val)).then(() => gToast('ကူးပြီးပါပြီ', 'success'));
}

// ============================================================
// SUBMIT SLIP
// ============================================================
async function submitSlip() {
  const boxes = document.querySelectorAll('.slip-box');
  const slip  = Array.from(boxes).map(b => b.value.trim()).join('');
  if (slip.length < 5) { gToast('Slip နောက်ဆုံး ၅ လုံး ထည့်ပါ'); return; }

  const btn = document.getElementById('dep2Btn');
  btn.disabled = true; btn.textContent = 'တင်နေသည်...';

  try {
    const { error } = await window.DB.from('transactions').insert([{
      user_id        : window.currentUserId,
      type           : 'deposit',
      amount         : _dAmt,
      payment_method : _dMethod.provider_name,
      payment_details: slip,
      bonus_opted    : _dBonus,
      status         : 'pending',
      reference      : window._depOrd || null
    }]);
    if (error) throw error;

    clearInterval(window._cdTimer);
    document.getElementById('depositModal')?.classList.remove('open');
    gToast('ငွေသွင်း တောင်းဆိုမှု အောင်မြင်ပါသည်\nမိနစ် 5–10 အတွင်း Wallet ထဲ ရောက်ပါမည်', 'success');
  } catch (e) {
    gToast('မအောင်မြင်ပါ: ' + (e.message || 'ထပ်စမ်းပါ'), 'error');
    btn.disabled = false;
    btn.textContent = 'ငွေသွင်းပြီး အတည်ပြုမည်';
  }
}
