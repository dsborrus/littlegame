// renderer.js — Hex Collapse: Canvas rendering layer
// Vanilla JS, no modules. Exposed via window.Renderer.

(function () {
  'use strict';

  var SQRT3 = Math.sqrt(3);
  var TAU = Math.PI * 2;
  var DEG2RAD = Math.PI / 180;

  // ─── Renderer Class ─────────────────────────────────────────────────
  function Renderer(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.width = 0;
    this.height = 0;
    this.centerX = 0;
    this.centerY = 0;
    this.dpr = window.devicePixelRatio || 1;

    // Visual theme from GDD
    this.bgColor = '#0a0a1a';
    this.gridLineColor = '#1a1a3a';
    this.hoverColor = '#00ffcc';
    this.textColor = '#e0e0ff';
    this.accentColor = '#00ffcc';
    this.warningColor = '#ff4444';

    // Offscreen grid cache
    this.gridCanvas = document.createElement('canvas');
    this.gridCtx = this.gridCanvas.getContext('2d');
    this.gridDirty = true;

    this._resize();
    var self = this;
    window.addEventListener('resize', function () {
      self._resize();
      self.gridDirty = true;
    });
  }

  Renderer.prototype._resize = function () {
    this.dpr = window.devicePixelRatio || 1;
    var w = this.canvas.parentElement
      ? this.canvas.parentElement.clientWidth
      : window.innerWidth;
    var h = this.canvas.parentElement
      ? this.canvas.parentElement.clientHeight
      : window.innerHeight;
    this.canvas.width = w * this.dpr;
    this.canvas.height = h * this.dpr;
    this.canvas.style.width = w + 'px';
    this.canvas.style.height = h + 'px';
    this.width = w;
    this.height = h;
    this.centerX = w / 2;
    // Shift grid center down slightly to leave room for HUD
    this.centerY = h / 2 + 30;

    this.gridCanvas.width = this.canvas.width;
    this.gridCanvas.height = this.canvas.height;
    this.gridDirty = true;
  };

  // Mouse position relative to canvas
  Renderer.prototype.getMousePos = function (evt) {
    var rect = this.canvas.getBoundingClientRect();
    return { x: evt.clientX - rect.left, y: evt.clientY - rect.top };
  };

  // Screen pixel -> grid-local coords (origin at grid center)
  Renderer.prototype.screenToGrid = function (sx, sy) {
    return { x: sx - this.centerX, y: sy - this.centerY };
  };

  // Grid-local -> screen pixel
  Renderer.prototype.gridToScreen = function (gx, gy) {
    return { x: gx + this.centerX, y: gy + this.centerY };
  };

  // ─── Hex Geometry ────────────────────────────────────────────────────
  Renderer.prototype._drawHexPath = function (ctx, cx, cy, size) {
    ctx.beginPath();
    for (var i = 0; i < 6; i++) {
      var angle = 60 * i * DEG2RAD;
      var vx = cx + size * Math.cos(angle);
      var vy = cy + size * Math.sin(angle);
      if (i === 0) ctx.moveTo(vx, vy);
      else ctx.lineTo(vx, vy);
    }
    ctx.closePath();
  };

  // ─── Static Grid Cache ──────────────────────────────────────────────
  Renderer.prototype._renderGridCache = function (grid) {
    if (!this.gridDirty) return;
    this.gridDirty = false;

    var ctx = this.gridCtx;
    var dpr = this.dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, this.width, this.height);

    var self = this;
    ctx.strokeStyle = this.gridLineColor;
    ctx.lineWidth = 1;

    grid.forEachCell(function (q, r) {
      var px = grid.hexToPixel(q, r);
      var sp = self.gridToScreen(px.x, px.y);
      self._drawHexPath(ctx, sp.x, sp.y, grid.hexSize);
      ctx.stroke();
    });
  };

  // ─── Main Render ────────────────────────────────────────────────────
  Renderer.prototype.render = function (gs) {
    var ctx = this.ctx;
    var dpr = this.dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Background
    ctx.fillStyle = this.bgColor;
    ctx.fillRect(0, 0, this.width, this.height);

    if (!gs || !gs.grid) return;

    // Static grid lines
    this._renderGridCache(gs.grid);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(this.gridCanvas, 0, 0);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Tiles
    this._renderTiles(ctx, gs.grid);

    // Hover
    if (gs.hoverHex && gs.state === 'PLAYING' && !gs.animating) {
      this._renderHover(ctx, gs.grid, gs.hoverHex, gs.currentColorHex);
    }

    // Particles
    if (gs.particles) this._renderParticles(ctx, gs.particles);

    // Gravity indicator
    if (gs.gravity) this._renderGravityIndicator(ctx, gs.grid, gs.gravity);

    // Board fill warning
    this._renderBoardWarning(ctx, gs.grid);

    // Score popups
    if (gs.scorePopups) this._renderScorePopups(ctx, gs.scorePopups);
  };

  // ─── Tiles ──────────────────────────────────────────────────────────
  Renderer.prototype._renderTiles = function (ctx, grid) {
    var self = this;
    grid.cells.forEach(function (tile) {
      if (!tile) return;
      var px = grid.hexToPixel(tile.q, tile.r);
      var sp = self.gridToScreen(px.x, px.y);
      var x = sp.x + (tile.animX || 0);
      var y = sp.y + (tile.animY || 0);
      var scale = tile.animScale != null ? tile.animScale : 1;
      var alpha = tile.animAlpha != null ? tile.animAlpha : 1;

      ctx.save();
      ctx.globalAlpha = alpha;

      if (tile.type === 'stone') {
        self._drawHexPath(ctx, x, y, grid.hexSize * scale * 0.9);
        ctx.fillStyle = '#333344';
        ctx.fill();
        ctx.strokeStyle = '#555566';
        ctx.lineWidth = 2;
        ctx.stroke();
        // Texture lines
        ctx.strokeStyle = '#44445560';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x - 6, y - 4); ctx.lineTo(x + 4, y + 2);
        ctx.moveTo(x + 2, y - 6); ctx.lineTo(x - 4, y + 5);
        ctx.stroke();

      } else if (tile.type === 'cracked') {
        self._drawHexPath(ctx, x, y, grid.hexSize * scale * 0.9);
        ctx.fillStyle = '#333344';
        ctx.fill();
        var crackCol = tile.hp < 2 ? '#ff884480' : '#55556680';
        ctx.strokeStyle = crackCol;
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.strokeStyle = crackCol;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(x - 5, y - 8); ctx.lineTo(x + 1, y); ctx.lineTo(x + 6, y + 7);
        ctx.moveTo(x + 1, y); ctx.lineTo(x - 7, y + 5);
        ctx.stroke();

      } else {
        // Colored tile
        var baseColor = TILE_COLORS[tile.color] || '#888';
        var glowColor = TILE_GLOW[tile.color] || '#88888880';

        // Glow
        ctx.shadowColor = glowColor;
        ctx.shadowBlur = 12;
        self._drawHexPath(ctx, x, y, grid.hexSize * scale * 0.88);
        ctx.fillStyle = baseColor;
        ctx.fill();
        ctx.shadowBlur = 0;

        // Neon outline
        ctx.strokeStyle = baseColor;
        ctx.lineWidth = 2;
        ctx.stroke();

        // Flash overlay for match highlight
        if (tile.animFlash > 0) {
          ctx.globalAlpha = alpha * tile.animFlash * 0.6;
          self._drawHexPath(ctx, x, y, grid.hexSize * scale * 0.88);
          ctx.fillStyle = '#ffffff';
          ctx.fill();
          ctx.globalAlpha = alpha;
        }

        // Special overlays
        if (tile.type === 'wildcard') {
          self._drawWildcard(ctx, x, y, grid.hexSize * scale * 0.7);
        } else if (tile.type === 'bomb') {
          self._drawBomb(ctx, x, y, grid.hexSize * scale * 0.5);
        } else if (tile.type === 'anchor') {
          self._drawAnchor(ctx, x, y, grid.hexSize * scale * 0.35);
        }
      }
      ctx.restore();
    });
  };

  Renderer.prototype._drawWildcard = function (ctx, x, y, size) {
    var t = performance.now() / 500;
    ctx.save();
    ctx.globalAlpha = 0.7;
    ctx.strokeStyle = 'hsl(' + ((t * 60) % 360) + ', 100%, 70%)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (var i = 0; i < 6; i++) {
      var a = (i * 60 + t * 30) * DEG2RAD;
      ctx.moveTo(x + Math.cos(a) * size * 0.4, y + Math.sin(a) * size * 0.4);
      ctx.lineTo(x + Math.cos(a) * size, y + Math.sin(a) * size);
    }
    ctx.stroke();
    ctx.restore();
  };

  Renderer.prototype._drawBomb = function (ctx, x, y, radius) {
    var t = performance.now() / 400;
    var pulse = 0.8 + 0.2 * Math.sin(t);
    ctx.save();
    ctx.globalAlpha = 0.8;
    ctx.strokeStyle = '#ff8822';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, radius * pulse, 0, TAU);
    ctx.stroke();
    ctx.restore();
  };

  Renderer.prototype._drawAnchor = function (ctx, x, y, s) {
    ctx.save();
    ctx.globalAlpha = 0.9;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, y - s);
    ctx.lineTo(x, y + s * 0.5);
    ctx.moveTo(x - s * 0.6, y + s * 0.5);
    ctx.lineTo(x + s * 0.6, y + s * 0.5);
    ctx.moveTo(x - s * 0.4, y - s * 0.3);
    ctx.lineTo(x + s * 0.4, y - s * 0.3);
    ctx.moveTo(x - s * 0.5, y + s);
    ctx.quadraticCurveTo(x, y + s * 1.4, x + s * 0.5, y + s);
    ctx.stroke();
    ctx.restore();
  };

  // ─── Hover ──────────────────────────────────────────────────────────
  Renderer.prototype._renderHover = function (ctx, grid, hex, colorHex) {
    if (!grid.isValid(hex.q, hex.r)) return;
    if (!grid.isEmpty(hex.q, hex.r)) return;

    var px = grid.hexToPixel(hex.q, hex.r);
    var sp = this.gridToScreen(px.x, px.y);

    this._drawHexPath(ctx, sp.x, sp.y, grid.hexSize);
    ctx.strokeStyle = this.hoverColor;
    ctx.lineWidth = 2;
    ctx.stroke();

    if (colorHex) {
      ctx.save();
      ctx.globalAlpha = 0.3;
      this._drawHexPath(ctx, sp.x, sp.y, grid.hexSize * 0.88);
      ctx.fillStyle = colorHex;
      ctx.fill();
      ctx.restore();
    }
  };

  // ─── Particles ──────────────────────────────────────────────────────
  Renderer.prototype._renderParticles = function (ctx, ps) {
    var particles = ps.particles;
    for (var i = 0; i < particles.length; i++) {
      var p = particles[i];
      var a = p.life / p.maxLife;
      var sp = this.gridToScreen(p.x, p.y);
      ctx.save();
      ctx.globalAlpha = a;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(sp.x, sp.y, p.size * a, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
  };

  // ─── Gravity Indicator ──────────────────────────────────────────────
  Renderer.prototype._renderGravityIndicator = function (ctx, grid, gravity) {
    var angleRad = (gravity.animAngle - 90) * DEG2RAD;
    var indicatorR = (grid.radius + 1.5) * grid.hexSize * 1.1;
    var cx = this.centerX;
    var cy = this.centerY;

    var ax = cx + Math.cos(angleRad) * indicatorR;
    var ay = cy + Math.sin(angleRad) * indicatorR;

    var pulse = 1;
    if (gravity.movesUntilShift() <= 2) {
      pulse = 0.7 + 0.3 * Math.abs(Math.sin(performance.now() / 200));
    }

    ctx.save();
    ctx.globalAlpha = pulse;
    ctx.translate(ax, ay);
    ctx.rotate(angleRad + Math.PI / 2);
    ctx.fillStyle = this.accentColor;
    ctx.beginPath();
    ctx.moveTo(0, -10);
    ctx.lineTo(-7, 6);
    ctx.lineTo(7, 6);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  };

  // ─── Board Warning ──────────────────────────────────────────────────
  Renderer.prototype._renderBoardWarning = function (ctx, grid) {
    var empty = grid.getEmptyCells().length;
    var total = grid.validCells.size;
    var ratio = empty / total;
    if (ratio >= 0.15) return;

    var pulse = 0.1 + 0.15 * Math.abs(Math.sin(performance.now() / 300));
    ctx.save();
    ctx.strokeStyle = ratio < 0.08 ? this.warningColor : '#ff444488';
    ctx.lineWidth = ratio < 0.08 ? 4 : 2;
    ctx.globalAlpha = pulse;
    ctx.strokeRect(4, 4, this.width - 8, this.height - 8);
    ctx.restore();
  };

  // ─── Score Popups ───────────────────────────────────────────────────
  Renderer.prototype._renderScorePopups = function (ctx, popups) {
    for (var i = 0; i < popups.length; i++) {
      var p = popups[i];
      var a = p.life / p.maxLife;
      var sp = this.gridToScreen(p.x, p.y - (1 - a) * 40);
      ctx.save();
      ctx.globalAlpha = a;
      ctx.font = 'bold 16px monospace';
      ctx.fillStyle = p.color || '#ffffff';
      ctx.textAlign = 'center';
      ctx.fillText('+' + p.score, sp.x, sp.y);
      ctx.restore();
    }
  };

  // ─── Expose ─────────────────────────────────────────────────────────
  window.Renderer = Renderer;

})();
