const WHEEL_SLOTS = [
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
// DRAW
// ============================================================
function drawWheel(angle) {
  const canvas = document.getElementById('wheelCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const sz = 260, cx = sz / 2, cy = sz / 2, r = 118, sa = (Math.PI * 2) / 8;

  ctx.clearRect(0, 0, sz, sz);
  ctx.beginPath(); ctx.arc(cx, cy, r + 4, 0, Math.PI * 2);
  ctx.strokeStyle = '#C9A227'; ctx.lineWidth = 4; ctx.stroke();

  WHEEL_SLOTS.forEach((slot, i) => {
    const start = angle + i * sa, end = start + sa;
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, r, start, end); ctx.closePath();
    ctx.fillStyle = slot.color; ctx.fill();
    ctx.strokeStyle = '#C9A227'; ctx.lineWidth = 1.5; ctx.stroke();

    ctx.save(); ctx.translate(cx, cy); ctx.rotate(start + sa / 2);
    ctx.fillStyle      = slot.amount === 0 ? '#333' : '#FFD700';
    ctx.font           = 'bold 10px "Segoe UI",sans-serif';
    ctx.textAlign      = 'center'; ctx.textBaseline = 'middle';
    ctx.shadowColor    = 'rgba(0,0,0,.9)'; ctx.shadowBlur = 4;
    ctx.fillText(slot.label, r * 0.62, 0); ctx.restore();
  });

  // Center hub
  const cg = ctx.createRadialGradient(cx - 5, cy - 5, 3, cx, cy, 22);
  cg.addColorStop(0, '#FFE55C'); cg.addColorStop(1, '#8B6014');
  ctx.beginPath(); ctx.arc(cx, cy, 22, 0, Math.PI * 2);
  ctx.fillStyle = cg; ctx.fill();
  ctx.strokeStyle = '#C9A227'; ctx.lineWidth = 2; ctx.stroke();

  // Diamond center
  ctx.beginPath();
  ctx.moveTo(cx, cy - 9); ctx.lineTo(cx + 7, cy); ctx.lineTo(cx, cy + 9); ctx.lineTo(cx - 7, cy);
  ctx.closePath(); ctx.fillStyle = 'rgba(255,255,255,.9)'; ctx.fill();
}

// ============================================================
// SPIN
// ============================================================
function spinToSlot(slotIndex, onDone) {
  if (_isSpinning) return;
  _isSpinning = true;
  document.getElementById('spinBtn').disabled = true;

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
      _animId = null; _wheelAngle = start + total; _isSpinning = false;
      onDone?.();
    }
  }
  _animId = requestAnimationFrame(animate);
}

// ============================================================
// INIT WHEEL EVENTS
// ============================================================
function initWheel() {
  drawWheel(0);

  document.getElementById('spinBtn').addEventListener('click', async () => {
    if (!window.currentUserId) { openAuthModal('login'); return; }
    if (window.availableSpins <= 0) { gToast('လှည့်ပိုင်ခွင့် မရှိသေးပါ'); return; }

    const { data, error } = await window.DB.rpc('spin_lucky_wheel', { p_user_id: window.currentUserId });
    if (error) { gToast('Spin မအောင်မြင်ပါ: ' + error.message, 'error'); return; }

    window.availableSpins--;
    setEl('availableSpins', window.availableSpins);

    const slot = WHEEL_SLOTS[(data.slot_index - 1) % 8];
    spinToSlot(data.slot_index, () => {
      const overlay = document.getElementById('spinResultOverlay');
      const content = document.getElementById('spinResultContent');

      if (slot.amount === 0) {
        content.innerHTML = `
          <div class="spin-result-blank">ကံမကောင်းပါ — ဗလာ ထွက်ပါသည်</div>
          <div class="spin-result-unit" style="margin-bottom:16px;">ထပ်ကြိုးစားပါ</div>`;
      } else {
        const to = slot.amount * TURNOVER_MULT[slot.amount];
        content.innerHTML = `
          <div class="spin-result-amount">${slot.amount.toLocaleString()}</div>
          <div class="spin-result-unit">ကျပ် ရရှိသည်</div>
          <div class="spin-result-turnover">
            Turnover: <strong style="color:var(--gold2);">${to.toLocaleString()} ကျပ်</strong><br>
            (${slot.amount.toLocaleString()} × ${TURNOVER_MULT[slot.amount]})
          </div>`;
      }
      overlay.classList.add('show');

      // History
      const list = document.getElementById('spinHistoryList');
      const now  = new Date().toLocaleString('en-GB');
      const item = document.createElement('div');
      item.className = 'history-item';
      item.innerHTML = `
        <span class="history-date">${now}</span>
        <span class="history-desc">Lucky Wheel</span>
        <span class="history-amount">${slot.amount > 0 ? '+' + slot.amount.toLocaleString() + ' ကျပ်' : 'ဗလာ'}</span>`;
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
