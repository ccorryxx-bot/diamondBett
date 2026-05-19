// ============================================================
// FORMAT / DOM HELPERS
// ============================================================
function fmt(v, d = 2) {
  const n = parseFloat(v);
  return isNaN(n) ? '0.00' : n.toFixed(d);
}
function setEl(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}
function maskNum(n) {
  if (!n || n.length < 4) return n;
  return '****' + n.slice(-4);
}

// ============================================================
// SVG ICON SYSTEM  (replaces all emoji)
// ============================================================
function icon(name, size = 16, color = 'currentColor') {
  const p = `width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2"`;
  const map = {
    deposit    : `<svg ${p}><path d="M12 5v14M5 12l7 7 7-7"/></svg>`,
    withdraw   : `<svg ${p}><path d="M12 19V5M5 12l7-7 7 7"/></svg>`,
    check      : `<svg ${p} stroke-width="2.5"><polyline points="20,6 9,17 4,12"/></svg>`,
    xmark      : `<svg ${p} stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
    warning    : `<svg ${p}><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
    gift       : `<svg ${p}><polyline points="20,12 20,22 4,22 4,12"/><rect x="2" y="7" width="20" height="5"/><line x1="12" y1="22" x2="12" y2="7"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/></svg>`,
    card       : `<svg ${p}><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>`,
    money      : `<svg ${p}><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>`,
    timer      : `<svg ${p}><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>`,
    hourglass  : `<svg ${p}><path d="M5 22h14"/><path d="M5 2h14"/><path d="M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22"/><path d="M7 2v4.172a2 2 0 0 0 .586 1.414L12 12l4.414-4.414A2 2 0 0 0 17 6.172V2"/></svg>`,
    note       : `<svg ${p}><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`,
    list       : `<svg ${p}><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>`,
    shield     : `<svg ${p}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`,
    key        : `<svg ${p}><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg>`,
    gamepad    : `<svg ${p}><rect x="2" y="6" width="20" height="12" rx="2"/><path d="M8 12h8M12 8v8"/></svg>`,
    bank       : `<svg ${p}><rect x="3" y="9" width="18" height="12" rx="1"/><path d="M3 9l9-6 9 6M9 9v12M15 9v12M3 13h18"/></svg>`,
    link       : `<svg ${p}><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>`,
    chart      : `<svg ${p}><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>`,
    pct        : `<svg ${p}><circle cx="7" cy="7" r="3"/><circle cx="17" cy="17" r="3"/><path d="M18 6L6 18"/></svg>`,
    info       : `<svg ${p}><circle cx="12" cy="12" r="10"/><path d="M12 8v4"/><circle cx="12" cy="16" r="1" fill="${color}"/></svg>`,
    user       : `<svg ${p}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`,
    copy       : `<svg ${p}><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`,
    lock       : `<svg ${p}><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`,
    arrow      : `<svg ${p}><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12,5 19,12 12,19"/></svg>`,
    target     : `<svg ${p}><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>`,
    star       : `<svg ${p}><polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"/></svg>`,
    refresh    : `<svg ${p}><polyline points="23,4 23,10 17,10"/><polyline points="1,20 1,14 7,14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>`,
    chat       : `<svg ${p}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`,
    bell       : `<svg ${p}><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>`,
    robot      : `<svg ${p}><rect x="3" y="11" width="18" height="10" rx="2"/><rect x="8" y="7" width="8" height="4" rx="1"/><circle cx="9" cy="16" r="1.5" fill="${color}" stroke="none"/><circle cx="15" cy="16" r="1.5" fill="${color}" stroke="none"/><path d="M12 7V4M9 4h6"/></svg>`,
  };
  return map[name] || '';
}

// ============================================================
// TOAST
// ============================================================
function gToast(msg, type = 'normal') {
  let t = document.getElementById('gToast');
  if (!t) return;
  t.textContent = msg;
  t.className = type === 'success' ? 'show success' : type === 'error' ? 'show error' : 'show';
  clearTimeout(window._toastTimer);
  window._toastTimer = setTimeout(() => t.className = '', type === 'success' ? 4000 : 2800);
}

// ============================================================
// PAYMENT LOGOS
// ============================================================
function kbzSvg(sz = 40) {
  return `<svg width="${sz}" height="${sz}" viewBox="0 0 48 48">
    <rect width="48" height="48" rx="12" fill="#003087"/>
    <rect x="4" y="4" width="40" height="40" rx="9" fill="#0a3fa0" opacity=".4"/>
    <text x="24" y="21" text-anchor="middle" fill="white" font-size="10.5" font-weight="900" letter-spacing="1" font-family="'Segoe UI',Arial,sans-serif">KBZ</text>
    <text x="24" y="31" text-anchor="middle" fill="#FFD700" font-size="9.5" font-weight="700" font-family="'Segoe UI',Arial,sans-serif">Pay</text>
    <rect x="13" y="35" width="22" height="2.5" rx="1.25" fill="#FFD700" opacity=".6"/>
  </svg>`;
}
function waveSvg(sz = 40) {
  return `<svg width="${sz}" height="${sz}" viewBox="0 0 48 48">
    <rect width="48" height="48" rx="12" fill="#FFAB00"/>
    <circle cx="24" cy="21" r="12" fill="none" stroke="#0091D0" stroke-width="4.5"/>
    <path d="M12 21 Q18 13 24 21 Q30 29 36 21" fill="none" stroke="#0091D0" stroke-width="4" stroke-linecap="round"/>
    <text x="24" y="41" text-anchor="middle" fill="#003087" font-size="8" font-weight="900" font-family="'Segoe UI',Arial,sans-serif">Wave</text>
  </svg>`;
}
function getProvSvg(provName, sz = 40) {
  return provName.toLowerCase().includes('kbz') ? kbzSvg(sz) : waveSvg(sz);
}

// ============================================================
// SHARE
// ============================================================
function shareVia(platform) {
  const link = document.getElementById('agentShareLinkInput')?.value;
  if (!link || link === '—') { gToast('Login ဝင်ပြီးမှ Share လုပ်ပါ'); return; }
  const text = encodeURIComponent(`Diamond-BETT မှ ဖိတ်ကြားပါသည်! ${link}`);
  const urls = {
    telegram  : `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${text}`,
    viber     : `viber://forward?text=${text}`,
    facebook  : `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(link)}`,
    whatsapp  : `https://wa.me/?text=${text}`
  };
  if (urls[platform]) window.open(urls[platform], '_blank');
}
// ============================================================
// REAL-TIME AUTH CHECK (deposit/withdraw မှာ သုံး)
// ============================================================
async function getAuthUid() {
  // window.currentUserId ရှိရင် တိုက်ရိုက်ပြန်
  if (window.currentUserId) return window.currentUserId;

  // မရှိရင် Supabase ကနေ တိုက်ရိုက်ဆွဲ
  try {
    const { data: { user } } = await window.DB.auth.getUser();
    if (user?.id) {
      window.currentUserId  = user.id;
      window.currentAgentId = user.id;
      return user.id;
    }
  } catch (e) {
    console.error('getAuthUid error:', e);
  }
  return null;
}
