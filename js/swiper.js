// ============================================================
// DiamondSwiper — Custom Smooth Swiper Module
// Diamond-BETT v1.0
// Replaces initBanner() in ui.js
// ============================================================

class DiamondSwiper {
  constructor(wrapSel, opts = {}) {
    this.wraps    = Array.from(document.querySelectorAll(wrapSel));
    if (!this.wraps.length) return;

    this.opts     = Object.assign({ interval: 4000, resistance: 0.28 }, opts);
    this.cur      = 0;
    this._timer   = null;

    // Drag state
    this._drag    = false;
    this._sx      = 0;          // startX
    this._sy      = 0;          // startY
    this._dx      = 0;          // current diffX (px)
    this._ts      = 0;          // touchstart timestamp (for velocity)
    this._scroll  = null;       // null | true | false — scroll direction lock
    this._tw      = 0;          // track width px

    this._bindEvents();
    this._render(false);
    this._startAuto();

    // Backward-compat hook used by games.js after loadBanners()
    window._restartBanner = () => this.restart();
  }

  // ── Slide count (read live from DOM for dynamic content) ──
  get count() {
    const t = this._track(0);
    return t ? t.querySelectorAll('.banner-slide').length : 0;
  }

  // ── Track element helper ──
  _track(i) {
    return this.wraps[i] ? this.wraps[i].querySelector('.banner-track') : null;
  }

  // ── All dot containers (may live outside wrap) ──
  get _dotWraps() {
    return Array.from(document.querySelectorAll('.banner-dots'));
  }

  // ── Clamp index ──
  _clamp(n) {
    const c = this.count;
    if (!c) return 0;
    return ((n % c) + c) % c;
  }

  // ── Render: set translateX on all tracks ──
  _render(animate, extraPx) {
    if (animate === undefined) animate = true;
    if (extraPx === undefined) extraPx = 0;
    this.wraps.forEach((wrap, i) => {
      const track = this._track(i);
      if (!track) return;
      if (extraPx === 0) {
        track.style.transition = animate ? '' : 'none';
        track.style.transform  = 'translateX(-' + (this.cur * 100) + '%)';
      } else {
        track.style.transition = 'none';
        track.style.transform  = 'translateX(calc(-' + (this.cur * 100) + '% + ' + extraPx + 'px))';
      }
    });

    // Sync all dot indicators
    this._dotWraps.forEach(function(dw) {
      dw.querySelectorAll('.dot').forEach(function(d, i) {
        d.classList.toggle('active', i === this.cur);
      }.bind(this));
    }.bind(this));
  }

  // ── Re-enable CSS transition after drag ──
  _restoreTransition() {
    this.wraps.forEach((wrap, i) => {
      const t = this._track(i);
      if (t) t.style.transition = '';
    });
  }

  // ── Go to slide n ──
  goto(n) {
    if (!this.count) return;
    this.cur = this._clamp(n);
    this._restoreTransition();
    this._render(true);
  }

  // ── Restart (called by games.js after dynamic banner load) ──
  restart() {
    this.cur = 0;
    this._restoreTransition();
    this._render(true);
    this._startAuto();
  }

  // ── Auto-play ──
  _startAuto() {
    clearInterval(this._timer);
    var self = this;
    this._timer = setInterval(function() { self.goto(self.cur + 1); }, self.opts.interval);
  }
  _stopAuto() { clearInterval(this._timer); }

  // ── Event binding ──
  _bindEvents() {
    // Dot navigation (delegated to document)
    var self = this;
    document.addEventListener('click', function(e) {
      var dot = e.target.closest('.dot');
      if (!dot) return;
      self.goto(+dot.dataset.i);
      self._startAuto();
    });

    this.wraps.forEach(function(wrap) {
      wrap.addEventListener('touchstart',  function(e) { self._tStart(e); }, { passive: true });
      wrap.addEventListener('touchmove',   function(e) { self._tMove(e);  }, { passive: true });
      wrap.addEventListener('touchend',    function(e) { self._tEnd(e);   }, { passive: true });
      wrap.addEventListener('touchcancel', function()  { self._cancel();  }, { passive: true });
    });
  }

  // ── Touch Start ──
  _tStart(e) {
    var t     = e.touches[0];
    this._drag   = true;
    this._sx     = t.clientX;
    this._sy     = t.clientY;
    this._dx     = 0;
    this._ts     = Date.now();
    this._scroll = null;
    this._tw     = this.wraps[0] ? this.wraps[0].offsetWidth : window.innerWidth;
    this._stopAuto();
  }

  // ── Touch Move ──
  _tMove(e) {
    if (!this._drag) return;
    var t  = e.touches[0];
    var dx = t.clientX - this._sx;
    var dy = t.clientY - this._sy;

    // Lock direction on first meaningful move
    if (this._scroll === null && (Math.abs(dx) > 5 || Math.abs(dy) > 5)) {
      this._scroll = Math.abs(dy) > Math.abs(dx);
    }
    if (this._scroll) return; // let page scroll vertically

    this._dx = dx;

    // Boundary resistance at first / last slide
    var c = this.count;
    var offset = dx;
    if ((this.cur === 0     && dx > 0) ||
        (this.cur === c - 1 && dx < 0)) {
      offset = dx * this.opts.resistance;
    }

    this._render(false, offset);
  }

  // ── Touch End ──
  _tEnd(e) {
    if (!this._drag) return;
    this._drag = false;

    if (this._scroll) {
      this._restoreTransition();
      this._render(true);
      this._startAuto();
      return;
    }

    var w        = this._tw;
    var dx       = this._dx;
    var dt       = Math.max(Date.now() - this._ts, 1);
    var velocity = Math.abs(dx) / dt;          // px/ms
    var fastFlick = velocity > 0.35;           // quick flick regardless of distance
    var distOk    = Math.abs(dx) > w * 0.18;  // 18% of track width

    this._restoreTransition();

    if      (dx < 0 && (fastFlick || distOk)) { this.goto(this.cur + 1); }
    else if (dx > 0 && (fastFlick || distOk)) { this.goto(this.cur - 1); }
    else                                       { this._render(true);      } // snap back

    this._startAuto();
  }

  // ── Cancel (incoming call / focus loss) ──
  _cancel() {
    this._drag = false;
    this._restoreTransition();
    this._render(true);
    this._startAuto();
  }
}

// ============================================================
// initBanner — drop-in replacement called from main.js
// ============================================================
function initBanner() {
  new DiamondSwiper('.banner-wrap', { interval: 4000 });
}
