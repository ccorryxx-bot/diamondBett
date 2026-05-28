// ============================================================
// HOME PAGE ASSETS — Social Icons + License Logos
// Loads from Supabase table: home_page_assets
// type: 'icon'    → social media icons (7)
// type: 'license' → license / provider logos (9)
// ============================================================

async function loadHomePageAssets() {
  if (!window.DB) return;

  try {
    const { data, error } = await window.DB
      .from('home_page_assets')
      .select('id, type, name, image_url, link_url, sort_order')
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (error || !data?.length) return;

    const icons    = data.filter(d => d.type === 'icon');
    const licenses = data.filter(d => d.type === 'license');

    _renderSocialIcons(icons);
    _renderLicenseLogos(licenses);
  } catch (e) {
    console.warn('loadHomePageAssets error:', e);
  }
}

function _renderSocialIcons(icons) {
  const row = document.getElementById('hpSocialRow');
  if (!row) return;
  if (!icons.length) { row.innerHTML = ''; return; }

  row.innerHTML = icons.map(ic => {
    const href = ic.link_url ? `onclick="if('${ic.link_url}'!=='null')window.open('${ic.link_url}','_blank')"` : '';
    return `<div class="hp-social-icon" title="${ic.name}" ${href}>
      <img src="${ic.image_url}" alt="${ic.name}" loading="lazy" onerror="this.style.display='none'">
    </div>`;
  }).join('');
}

function _renderLicenseLogos(licenses) {
  const wrap = document.getElementById('hpLicenseRow');
  if (!wrap) return;
  if (!licenses.length) { wrap.innerHTML = ''; return; }

  wrap.innerHTML = licenses.map(lic => {
    const href = lic.link_url ? `onclick="window.open('${lic.link_url}','_blank')"` : '';
    return `<img
      class="hp-license-icon"
      src="${lic.image_url}"
      alt="${lic.name}"
      title="${lic.name}"
      loading="lazy"
      onerror="this.style.display='none'"
      ${href}>`;
  }).join('');
}
