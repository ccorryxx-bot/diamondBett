// ============================================================
// HOME PAGE ASSETS — Social Icons (7) + License Logos (9)
// Table: home_page_assets  |  key TEXT PRIMARY KEY, image_url TEXT
// Keys: ic_1..ic_7 (icons), lc_1..lc_9 (licenses)
// ============================================================

const _HP_ICON_KEYS    = ['ic_1','ic_2','ic_3','ic_4','ic_5','ic_6','ic_7'];
const _HP_LICENSE_KEYS = ['lc_1','lc_2','lc_3','lc_4','lc_5','lc_6','lc_7','lc_8','lc_9'];

async function loadHomePageAssets() {
  if (!window.DB) return;

  try {
    const allKeys = [..._HP_ICON_KEYS, ..._HP_LICENSE_KEYS];
    const { data, error } = await window.DB
      .from('home_page_assets')
      .select('key, image_url')
      .in('key', allKeys);

    if (error) { console.warn('home_assets error:', error.message); return; }

    const map = {};
    (data || []).forEach(r => { map[r.key] = r.image_url || ''; });

    _renderSocialIcons(map);
    _renderLicenseLogos(map);
  } catch (e) {
    console.warn('loadHomePageAssets error:', e);
  }
}

function _renderSocialIcons(map) {
  const row = document.getElementById('hpSocialRow');
  if (!row) return;

  const items = _HP_ICON_KEYS
    .map(k => map[k] || '')
    .filter(url => url.trim() !== '');

  if (!items.length) { row.innerHTML = ''; return; }

  row.innerHTML = items.map(url =>
    `<div class="hp-social-icon">
      <img src="${url}" alt="" loading="lazy"
           onerror="this.parentElement.style.display='none'">
    </div>`
  ).join('');
}

function _renderLicenseLogos(map) {
  const wrap = document.getElementById('hpLicenseRow');
  if (!wrap) return;

  const items = _HP_LICENSE_KEYS
    .map(k => map[k] || '')
    .filter(url => url.trim() !== '');

  if (!items.length) { wrap.innerHTML = ''; return; }

  wrap.innerHTML = items.map(url =>
    `<img class="hp-license-icon" src="${url}" alt=""
          loading="lazy" onerror="this.style.display='none'">`
  ).join('');
}
