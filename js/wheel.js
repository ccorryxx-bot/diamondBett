let WHEEL_SLOTS = [
  { label: '5,000',   amount: 5000,  color: '#6B1010' },
  { label: '15,000',  amount: 15000, color: '#3D0707' },
  { label: '30,000',  amount: 30000, color: '#6B1010' },
  { label: '50,000',  amount: 50000, color: '#3D0707' },
  { label: '65,000',  amount: 65000, color: '#6B1010' },
  { label: '80,000',  amount: 80000, color: '#3D0707' },
  { label: 'ဗလာ',    amount: 0,     color: '#151525' },
  { label: 'ဗလာ',    amount: 0,     color: '#0D0D18' },
];
const TURNOVER_MULT = { 5000: 5, 15000: 6, 30000: 7, 50000: 10, 65000: 12, 80000: 15 };

let _wheelAngle = 0, _isSpinning = false, _animId = null;

// ============================================================
// DRAW  — HD canvas (device pixel ratio aware)
// ============================================================
function drawWheel(angle) {
  // FIX 1: Guard against NaN angle (caused by bad RPC data → slot_index undefined)
  if (typeof angle !== 'number' || isNaN(angle)) {
    angle = 0;
    _wheelAngle = 0;
  }

  const canvas = document.getElementById('wheelCanvas');
  if (!canvas) return;

  // FIX 2: Scale canvas buffer by devicePixelRatio for HD/crisp text on high-DPI screens
  const dpr      = Math.max(window.devicePixelRatio || 1, 1);
  const logical  = 260; // CSS size stays 260px

  if (canvas.width !== logical * dpr || canvas.height !== logical * dpr) {
    canvas.width        = logical * dpr;
    canvas.height       = logical * dpr;
    canvas.style.width  = logical + 'px';
    canvas.style.height = logical + 'px';
  }

  const ctx = canvas.getContext('2d');
  ctx.save();
  ctx.scale(dpr, dpr); // All coordinates now in logical (CSS) px

  const sz = logical, cx = sz / 2, cy = sz / 2, r = 118, sa = (Math.PI * 2) / 8;

  ctx.clearRect(0, 0, sz, sz);

  // Outer gold ring
  ctx.beginPath(); ctx.arc(cx, cy, r + 4, 0, Math.PI * 2);
  ctx.strokeStyle = '#C9A227'; ctx.lineWidth = 4; ctx.stroke();

  // Sector slices
  WHEEL_SLOTS.forEach((slot, i) => {
    const start = angle + i * sa, end = start + sa;
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, r, start, end); ctx.closePath();
    ctx.fillStyle = slot.color; ctx.fill();
    ctx.strokeStyle = '#C9A227'; ctx.lineWidth = 1.5; ctx.stroke();

    // Label text — HD font size adjusted for DPR
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(start + sa / 2);
    ctx.fillStyle     = slot.amount === 0 ? '#444' : '#FFD700';
    ctx.font          = 'bold 11px "Segoe UI",Arial,sans-serif';
    ctx.textAlign     = 'center';
    ctx.textBaseline  = 'middle';
    ctx.shadowColor   = 'rgba(0,0,0,.95)';
    ctx.shadowBlur    = 5;
    ctx.fillText(slot.label, r * 0.62, 0);
    ctx.restore();
  });

  // Center hub — gold radial gradient
  const cg = ctx.createRadialGradient(cx - 5, cy - 5, 3, cx, cy, 22);
  cg.addColorStop(0, '#FFE55C');
  cg.addColorStop(1, '#8B6014');
  ctx.beginPath(); ctx.arc(cx, cy, 22, 0, Math.PI * 2);
  ctx.fillStyle = cg; ctx.fill();
  ctx.strokeStyle = '#C9A227'; ctx.lineWidth = 2; ctx.stroke();

  // Diamond center icon
  ctx.beginPath();
  ctx.moveTo(cx, cy - 9); ctx.lineTo(cx + 7, cy);
  ctx.lineTo(cx, cy + 9); ctx.lineTo(cx - 7, cy);
  ctx.closePath();
  ctx.fillStyle = 'rgba(255,255,255,.92)'; ctx.fill();

  ctx.restore(); // Undo DPR scale
}

// ============================================================
// SPIN
// ============================================================
function spinToSlot(slotIndex, onDone) {
  // FIX: guard against null / undefined / NaN slot index from RPC
  slotIndex = Math.max(1, parseInt(slotIndex) || 1);

  if (_isSpinning) return;
  _isSpinning = true;
  document.getElementById('spinBtn').disabled = true;

  // FIX: if _wheelAngle is somehow NaN, reset it
  if (isNaN(_wheelAngle)) _wheelAngle = 0;

  const idx        = (slotIndex - 1) % 8;
  const sa         = (Math.PI * 2) / 8;
  const targetBase = (3 * Math.PI / 2) - idx * sa - sa / 2;
  const curMod     = ((_wheelAngle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
  const tgtMod     = ((targetBase % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
  let diff         = tgtMod - curMod;
  if (diff < 0) diff += Math.PI * 2;

  const total = 6 * Math.PI * 2 + diff;
  const start = _wheelAngle;
  const t0    = performance.now();
  const ease  = t => 1 - Math.pow(1 - t, 3);

  function animate(now) {
    const t = Math.min((now - t0) / 5000, 1);
    _wheelAngle = start + total * ease(t);
    drawWheel(_wheelAngle);
    if (t < 1) {
      _animId = requestAnimationFrame(animate);
    } else {
      _animId = null;
      _wheelAngle = start + total;
      _isSpinning = false;
      onDone?.();
    }
  }
  _animId = requestAnimationFrame(animate);
}


// ============================================================
// LOAD WHEEL CONFIG FROM DB
// ============================================================
async function loadWheelConfig() {
  if (!window.DB) return;
  try {
    const { data, error } = await window.DB
      .from('wheel_config')
      .select('slot_index,prize_amount,turnover_multiplier')
      .order('slot_index');
    if (error || !data || !data.length) return;
    const DARK = ['#6B1010','#3D0707'];
    const BLANK = ['#151525','#0D0D18'];
    const newSlots = Array.from({ length: 8 }, (_, i) => ({
      label: 'ဗလာ', amount: 0, color: BLANK[i % 2]
    }));
    data.forEach(row => {
      const idx = (parseInt(row.slot_index) || 1) - 1;
      if (idx < 0 || idx > 7) return;
      const amt = parseInt(row.prize_amount) || 0;
      const lbl = amt > 0
        ? (amt >= 10000 ? Math.round(amt/1000)+'K' : String(amt))
        : 'ဗလာ';
      newSlots[idx] = { label: lbl, amount: amt, color: DARK[idx % 2] };
    });
    WHEEL_SLOTS = newSlots;
    data.forEach(row => {
      const amt  = parseInt(row.prize_amount) || 0;
      const mult = parseInt(row.turnover_multiplier) || 5;
      if (amt > 0) TURNOVER_MULT[amt] = mult;
    });
    drawWheel(_wheelAngle);
  } catch (e) {
    console.warn('[Wheel] DB config load failed, using defaults:', e);
  }
}

// ============================================================
// INIT WHEEL EVENTS
// ============================================================
function initWheel() {
  drawWheel(0);
  loadWheelConfig();

  document.getElementById('spinBtn').addEventListener('click', async () => {
    if (!window.currentUserId) { openAuthModal('login'); return; }

    // FIX: treat undefined as 0 (don't let NaN comparison pass)
    const spins = parseInt(window.availableSpins) || 0;
    if (spins <= 0) { gToast('လှည့်ပိုင်ခွင့် မရှိသေးပါ'); return; }

    const { data, error } = await window.DB.rpc('spin_lucky_wheel', { p_user_id: window.currentUserId });

    // RPC returns array: [{winning_amount, slot_index, req_turnover}]
    const result = Array.isArray(data) ? data[0] : data;
    if (error || !result || result.slot_index == null) {
      const msg = error?.message || 'Server response error';
      gToast('Spin မအောင်မြင်ပါ: ' + msg, 'error');
      return;
    }

    const winAmount   = Number(result.winning_amount ?? result.prize_amount ?? 0);
    const slotIdx     = parseInt(result.slot_index) || 7;
    const reqTurnover = Number(result.req_turnover  ?? result.required_turnover ?? 0);

    window.availableSpins--;
    setEl('availableSpins', window.availableSpins);

    spinToSlot(slotIdx, () => {
      const overlay = document.getElementById('spinResultOverlay');
      const content = document.getElementById('spinResultContent');

      if (winAmount === 0) {
        content.innerHTML = `
          <div class="spin-result-blank">ကံမကောင်းပါ — ဗလာ ထွက်ပါသည်</div>
          <div class="spin-result-unit" style="margin-bottom:16px;">ထပ်ကြိုးစားပါ</div>`;
      } else {
        const mult = TURNOVER_MULT[winAmount] || (reqTurnover > 0 ? Math.round(reqTurnover / winAmount) : 5);
        const to   = reqTurnover > 0 ? reqTurnover : winAmount * mult;
        content.innerHTML = `
          <div class="spin-result-amount">${winAmount.toLocaleString()}</div>
          <div class="spin-result-unit">ကျပ် ရရှိသည်</div>
          <div class="spin-result-turnover">
            Turnover: <strong style="color:var(--gold2);">${to.toLocaleString()} ကျပ်</strong><br>
            (${winAmount.toLocaleString()} × ${mult})
          </div>`;
      }
      overlay.classList.add('show');

      // History row
      const list = document.getElementById('spinHistoryList');
      const now  = new Date().toLocaleString('en-GB');
      const item = document.createElement('div');
      item.className = 'history-item';
      item.innerHTML = `
        <span class="history-date">${now}</span>
        <span class="history-desc">Lucky Wheel</span>
        <span class="history-amount">${winAmount > 0 ? '+' + winAmount.toLocaleString() + ' ကျပ်' : 'ဗလာ'}</span>`;
      if (list.querySelector('.history-empty')) list.innerHTML = '';
      list.prepend(item);

      if (window.availableSpins > 0)
        document.getElementById('spinBtn').disabled = false;
    });
  });

  document.getElementById('spinResultClose').addEventListener('click', () => {
    document.getElementById('spinResultOverlay').classList.remove('show');
  });
}

// ============================================================
// BONUS CODE
// ============================================================
async function handleBonusCode() {
  if (!window.currentUserId) { openAuthModal('login'); return; }
  const code = document.getElementById('bonusCodeInput').value.trim();
  if (!code) { gToast('Bonus Code ထည့်ပါ'); return; }

  const { data: bonusAmount, error } = await window.DB.rpc('claim_bonus_code', {
    p_user_id: window.currentUserId,
    p_code   : code.toUpperCase()
  });
  if (error) { gToast(error.message || 'Code မမှန်ပါ', 'error'); return; }

  gToast('Bonus ' + bonusAmount + ' ကျပ် ထည့်သွင်းပြီး', 'success');
  document.getElementById('bonusCodeInput').value = '';
}

// ============================================================
// DAILY TIMER
// ============================================================
function startDailyTimer() {
  function tick() {
    const now = new Date(), next = new Date();
    next.setHours(24, 0, 0, 0);
    const d = next - now;
    const h = String(Math.floor(d / 3600000)).padStart(2, '0');
    const m = String(Math.floor((d % 3600000) / 60000)).padStart(2, '0');
    const s = String(Math.floor((d % 60000) / 1000)).padStart(2, '0');
    setEl('task1Timer', `${h}:${m}:${s}`);
  }
  tick();
  setInterval(tick, 1000);
}
