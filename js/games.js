async function loadGamesFromDB() {
  const { data: games, error } = await window.DB.from('games').select('*');
  const grid = document.getElementById('gameGrid');
  if (!grid) return;

  if (error || !games?.length) {
    grid.innerHTML = `<div style="color:#555;font-size:12px;padding:20px;grid-column:span 3;text-align:center;">
      ${icon('gamepad', 24, '#555')}<br>Games loading...</div>`;
    return;
  }

  grid.innerHTML = '';
  games.forEach((g, idx) => {
    const hue    = (idx * 37) % 360;
    const hasImg = g.image_url && !g.image_url.includes('placehold');
    grid.innerHTML += `<div class="game-card" onclick="alert('Launch ${g.name}')">
      ${hasImg
        ? `<img src="${g.image_url}" class="gc-bg" onerror="this.style.display='none'">`
        : `<div class="gc-bg" style="background:linear-gradient(145deg,hsl(${hue},60%,30%),hsl(${hue+20},70%,20%));"></div>
           <div class="gc-char">${icon('gamepad', 36, 'white')}</div>`
      }
      <div class="gc-label"><span>${g.name}</span></div>
    </div>`;
  });
}
