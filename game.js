// game.js — Hex Collapse: Main game loop, state machine, UI integration
// Vanilla JS, no modules. Exposed via window.game.
// Integrates with the HTML overlay UI (index.html) and levels.js (window.LEVELS).

(function () {
  'use strict';

  // ─── Animation Queue ────────────────────────────────────────────────
  function AnimQueue() {
    this.queue = [];
    this.current = null;
    this.elapsed = 0;
  }
  AnimQueue.prototype.push = function (a) { this.queue.push(a); };
  AnimQueue.prototype.busy = function () { return this.current !== null || this.queue.length > 0; };
  AnimQueue.prototype.update = function (dt) {
    if (!this.current) {
      if (!this.queue.length) return;
      this.current = this.queue.shift();
      this.elapsed = 0;
      if (this.current.onStart) this.current.onStart();
    }
    this.elapsed += dt;
    var t = Math.min(1, this.elapsed / this.current.duration);
    if (this.current.onUpdate) this.current.onUpdate(t);
    if (t >= 1) {
      if (this.current.onEnd) this.current.onEnd();
      this.current = null;
    }
  };
  AnimQueue.prototype.clear = function () {
    this.queue.length = 0; this.current = null; this.elapsed = 0;
  };

  // ─── Score Popup ────────────────────────────────────────────────────
  function ScorePopup(x, y, score, color) {
    this.x = x; this.y = y; this.score = score; this.color = color || '#00ffcc';
    this.life = 1.0; this.maxLife = 1.0;
  }

  // ─── UI Helper: show/hide overlay ───────────────────────────────────
  function showOverlay(id) {
    var el = document.getElementById(id);
    if (el) { el.classList.remove('hidden'); el.classList.add('visible'); }
  }
  function hideOverlay(id) {
    var el = document.getElementById(id);
    if (el) { el.classList.remove('visible'); el.classList.add('hidden'); }
  }
  function hideAllOverlays() {
    ['startScreen', 'pauseMenu', 'levelComplete', 'gameOver', 'levelSelect'].forEach(hideOverlay);
  }

  // ─── The Game Object ────────────────────────────────────────────────
  var game = {
    // State
    state: 'MENU',        // MENU, PLAYING, PAUSED, LEVEL_COMPLETE, GAME_OVER
    currentLevel: 1,
    score: 0,
    targetScore: 0,
    levelConfig: null,

    // Engine objects
    grid: null,
    gravity: null,
    particles: null,
    renderer: null,
    animQueue: new AnimQueue(),

    // Color queue (color names)
    colorQueue: [],
    colorPool: [],         // array of color-name strings for this level

    // Input
    hoverHex: null,
    mouseX: 0,
    mouseY: 0,

    // Score popups
    scorePopups: [],

    // Cascade
    cascadeDepth: 0,
    isGravityShiftCascade: false,

    // Timing
    lastTime: 0,

    // ──────────────────────────────────────────────────────────────
    //  BOOT
    // ──────────────────────────────────────────────────────────────
    init: function () {
      var canvas = document.getElementById('gameCanvas');
      if (!canvas) return;

      this.renderer = new Renderer(canvas);
      this.particles = new ParticleSystem();
      this.gravity = new GravitySystem();

      this._bindInput(canvas);

      // Bind UI click sounds to all buttons
      var btns = document.querySelectorAll('.btn, .hud-icon-btn, .level-card');
      for (var b = 0; b < btns.length; b++) {
        btns[b].addEventListener('click', function () {
          if (window.GameAudio) window.GameAudio.uiClick();
        });
      }

      // Show start screen
      this.state = 'MENU';
      showOverlay('startScreen');

      var self = this;
      this.lastTime = performance.now();
      requestAnimationFrame(function (t) { self._loop(t); });
    },

    // ──────────────────────────────────────────────────────────────
    //  PUBLIC API — called from HTML buttons
    // ──────────────────────────────────────────────────────────────
    start: function () {
      this.loadLevel(1);
    },

    loadLevel: function (num) {
      var levels = window.LEVELS || [];
      var cfg = null;
      for (var i = 0; i < levels.length; i++) {
        if (levels[i].id === num) { cfg = levels[i]; break; }
      }
      if (!cfg) {
        // No such level — return to menu (e.g., after completing final level)
        this.goToMenu();
        return;
      }

      this.currentLevel = num;
      this.levelConfig = cfg;
      this.score = 0;
      this.targetScore = cfg.targetScore;
      this.cascadeDepth = 0;
      this.isGravityShiftCascade = false;
      this.scorePopups = [];

      // Build grid
      var hexSize = this._calcHexSize(cfg.gridRadius);
      this.grid = new HexGrid(cfg.gridRadius, hexSize);

      // Place obstacles
      this._placeObstacles(cfg.obstacles);

      // Place pre-placed tiles
      this._placePreplaced(cfg.preplacedTiles);

      // Gravity
      this.gravity.reset();
      this.gravity.movesPerShift = cfg.gravityShiftInterval;

      // Build color pool (map hex codes to color names)
      this.colorPool = [];
      for (var c = 0; c < cfg.colors.length; c++) {
        var name = HEX_TO_NAME[cfg.colors[c].toLowerCase()];
        if (name) this.colorPool.push(name);
      }
      if (this.colorPool.length === 0) {
        this.colorPool = COLOR_NAMES.slice(0, cfg.numColors);
      }

      // Fill queue
      this.colorQueue = [];
      var qLen = (cfg.queuePreview || 1) + 1; // current + previews
      for (var j = 0; j < qLen; j++) {
        this.colorQueue.push(this._genNextTileColor());
      }

      // Clear anim / particles
      this.animQueue.clear();
      this.particles.clear();

      // UI
      hideAllOverlays();
      this._showHUD(true);
      this._syncHUD();
      this.renderer.gridDirty = true;
      this.state = 'PLAYING';
    },

    restart: function () {
      this.loadLevel(this.currentLevel);
    },

    pause: function () {
      if (this.state !== 'PLAYING') return;
      this.state = 'PAUSED';
      showOverlay('pauseMenu');
    },

    resume: function () {
      if (this.state !== 'PAUSED') return;
      this.state = 'PLAYING';
      hideOverlay('pauseMenu');
    },

    goToMenu: function () {
      this.state = 'MENU';
      hideAllOverlays();
      this._showHUD(false);
      showOverlay('startScreen');
      // Clear board so renderer shows nothing
      this.grid = null;
    },

    // ──────────────────────────────────────────────────────────────
    //  GAME LOOP
    // ──────────────────────────────────────────────────────────────
    _loop: function (ts) {
      var dt = (ts - this.lastTime) / 1000;
      this.lastTime = ts;
      if (dt > 0.1) dt = 0.1;

      this._update(dt);
      this._render();

      var self = this;
      requestAnimationFrame(function (t) { self._loop(t); });
    },

    _update: function (dt) {
      // Animations
      this.animQueue.update(dt);
      this.particles.update(dt);

      // Gravity arrow lerp
      if (this.gravity) {
        var diff = this.gravity.targetAngle - this.gravity.animAngle;
        if (Math.abs(diff) > 0.5) {
          this.gravity.animAngle += diff * Math.min(1, dt * 6);
        } else {
          this.gravity.animAngle = this.gravity.targetAngle;
        }
      }

      // Score popups
      for (var i = this.scorePopups.length - 1; i >= 0; i--) {
        this.scorePopups[i].life -= dt;
        if (this.scorePopups[i].life <= 0) this.scorePopups.splice(i, 1);
      }

      // Hover
      if (this.state === 'PLAYING' && this.grid && !this.animQueue.busy()) {
        var gp = this.renderer.screenToGrid(this.mouseX, this.mouseY);
        this.hoverHex = this.grid.pixelToHex(gp.x, gp.y);
      }

      // Tile place animation tick
      if (this.grid) {
        var tiles = this.grid.getAllTiles();
        for (var t = 0; t < tiles.length; t++) {
          var tile = tiles[t];
          if (tile.placing) {
            tile.placeTimer += dt;
            var p = Math.min(1, tile.placeTimer / 0.2);
            tile.animScale = p < 0.7 ? (p / 0.7) * 1.15 : 1.15 - 0.15 * ((p - 0.7) / 0.3);
            if (p >= 1) { tile.animScale = 1; tile.placing = false; }
          }
        }
      }
    },

    _render: function () {
      if (!this.renderer) return;
      var curEntry = this.colorQueue.length > 0 ? this.colorQueue[0] : null;
      var curHex = null;
      if (curEntry) {
        var curColor = curEntry;
        if (curEntry.indexOf(':') !== -1) {
          var cp = curEntry.split(':');
          if (cp[0] === 'wildcard') {
            curHex = '#ffffff';
          } else {
            curHex = TILE_COLORS[cp[1]] || null;
          }
        } else {
          curHex = TILE_COLORS[curColor] || null;
        }
      }

      this.renderer.render({
        state: this.state,
        grid: this.grid,
        gravity: this.gravity,
        particles: this.particles,
        hoverHex: this.hoverHex,
        currentColorHex: curHex,
        scorePopups: this.scorePopups,
        animating: this.animQueue.busy()
      });
    },

    // ──────────────────────────────────────────────────────────────
    //  INPUT
    // ──────────────────────────────────────────────────────────────
    _bindInput: function (canvas) {
      var self = this;

      canvas.addEventListener('mousemove', function (e) {
        var p = self.renderer.getMousePos(e);
        self.mouseX = p.x; self.mouseY = p.y;
      });

      canvas.addEventListener('click', function (e) {
        var p = self.renderer.getMousePos(e);
        self._handleClick(p.x, p.y);
      });

      canvas.addEventListener('touchstart', function (e) {
        e.preventDefault();
        var p = self.renderer.getMousePos(e.touches[0]);
        self.mouseX = p.x; self.mouseY = p.y;
      }, { passive: false });

      canvas.addEventListener('touchend', function (e) {
        e.preventDefault();
        self._handleClick(self.mouseX, self.mouseY);
      }, { passive: false });

      document.addEventListener('keydown', function (e) {
        self._handleKey(e.key);
      });
    },

    _handleClick: function (sx, sy) {
      if (this.state === 'PLAYING' && !this.animQueue.busy()) {
        var gp = this.renderer.screenToGrid(sx, sy);
        var hex = this.grid.pixelToHex(gp.x, gp.y);
        this._placeTile(hex.q, hex.r);
      }
    },

    _handleKey: function (key) {
      switch (key) {
        case ' ':
          if (this.state === 'PLAYING') this.pause();
          else if (this.state === 'PAUSED') this.resume();
          break;
        case 'r': case 'R':
          if (this.state === 'PLAYING' || this.state === 'PAUSED' ||
              this.state === 'GAME_OVER' || this.state === 'LEVEL_COMPLETE') {
            this.restart();
          }
          break;
        case 'Escape':
          if (this.state === 'PLAYING') this.pause();
          else if (this.state !== 'MENU') this.goToMenu();
          break;
        case 'n': case 'N':
          if (this.state === 'LEVEL_COMPLETE') this.loadLevel(this.currentLevel + 1);
          break;
      }
    },

    // ──────────────────────────────────────────────────────────────
    //  LEVEL SETUP HELPERS
    // ──────────────────────────────────────────────────────────────
    _calcHexSize: function (radius) {
      var maxDim = Math.min(this.renderer.width, this.renderer.height) - 200;
      return Math.max(16, Math.floor(maxDim / ((2 * radius + 1) * 1.8)));
    },

    _placeObstacles: function (obstacles) {
      if (!obstacles) return;
      for (var i = 0; i < obstacles.length; i++) {
        var o = obstacles[i];
        if (!this.grid.isValid(o.q, o.r)) continue;
        var t = new Tile(null, o.q, o.r, o.type);
        if (o.hp) t.hp = o.hp;
        this.grid.setTile(o.q, o.r, t);
      }
    },

    _placePreplaced: function (tiles) {
      if (!tiles) return;
      for (var i = 0; i < tiles.length; i++) {
        var pt = tiles[i];
        if (!this.grid.isValid(pt.q, pt.r)) continue;
        var name = HEX_TO_NAME[(pt.color || '').toLowerCase()] || 'red';
        var t = new Tile(name, pt.q, pt.r, pt.type || 'standard');
        this.grid.setTile(pt.q, pt.r, t);
      }
    },

    _genNextTileColor: function () {
      // Check for special tile
      var type = this._rollSpecialType();
      if (type !== 'standard') {
        // Encode special type as "type:colorName" — placement step parses it
        // Wildcards get a visual color at placement; bomb/anchor use a real color
        var color = this.colorPool[Math.floor(Math.random() * this.colorPool.length)];
        return type + ':' + color;
      }
      // Normal color from pool
      return this.colorPool[Math.floor(Math.random() * this.colorPool.length)];
    },

    _rollSpecialType: function () {
      var cfg = this.levelConfig;
      if (!cfg || !cfg.specialTiles || cfg.specialTiles.length === 0) return 'standard';
      if (Math.random() >= cfg.specialTileChance) return 'standard';
      // Weighted selection among special types
      var weights = cfg.specialTileWeights || {};
      var total = 0;
      for (var i = 0; i < cfg.specialTiles.length; i++) {
        total += (weights[cfg.specialTiles[i]] || 1);
      }
      var roll = Math.random() * total;
      var cumulative = 0;
      for (var j = 0; j < cfg.specialTiles.length; j++) {
        cumulative += (weights[cfg.specialTiles[j]] || 1);
        if (roll < cumulative) return cfg.specialTiles[j];
      }
      return 'standard';
    },

    // ──────────────────────────────────────────────────────────────
    //  TILE PLACEMENT
    // ──────────────────────────────────────────────────────────────
    _placeTile: function (q, r) {
      if (!this.grid.isValid(q, r) || !this.grid.isEmpty(q, r)) return;
      if (this.state !== 'PLAYING') return;

      var entry = this.colorQueue.shift();
      var tileType = 'standard';
      var colorName;

      if (entry.indexOf(':') !== -1) {
        // Special tile encoded as "type:colorName"
        var parts = entry.split(':');
        tileType = parts[0];
        colorName = parts[1];
      } else {
        colorName = entry;
      }

      var tile = new Tile(colorName, q, r, tileType);
      tile.placing = true;
      tile.placeTimer = 0;
      tile.animScale = 0;
      this.grid.setTile(q, r, tile);

      // Sound effect
      if (window.GameAudio) window.GameAudio.tilePlace();

      // Refill queue
      this.colorQueue.push(this._genNextTileColor());
      this._syncHUD();

      // Post-placement sequence
      this.cascadeDepth = 0;
      this.isGravityShiftCascade = false;
      this._postPlacement();
    },

    // ──────────────────────────────────────────────────────────────
    //  POST-PLACEMENT SEQUENCE (GDD 2.4.4)
    // ──────────────────────────────────────────────────────────────
    _postPlacement: function () {
      var self = this;

      // 2. Settle
      this._animSettle(function () {
        // 3. Matches -> collapse -> cascade
        self._resolveMatches(false, function () {
          // 5. Increment move counter
          var shouldShift = self.gravity.incrementMove();
          self._syncHUD();

          if (shouldShift) {
            // 6. Gravity shift
            self._animGravityShift(function () {
              self.cascadeDepth = 0;
              self.isGravityShiftCascade = true;
              self._animSettle(function () {
                self._resolveMatches(true, function () {
                  self._checkWinLose();
                });
              });
            });
          } else {
            self._checkWinLose();
          }
        });
      });
    },

    _animSettle: function (cb) {
      var movements = this.gravity.settle(this.grid);
      if (movements.length === 0) { if (cb) cb(); return; }

      var self = this;
      var grid = this.grid;

      // Set initial offsets
      for (var i = 0; i < movements.length; i++) {
        var m = movements[i];
        var fp = grid.hexToPixel(m.fromQ, m.fromR);
        var tp = grid.hexToPixel(m.toQ, m.toR);
        m.tile.animX = fp.x - tp.x;
        m.tile.animY = fp.y - tp.y;
      }

      this.animQueue.push({
        duration: 0.12,
        onUpdate: function (t) {
          for (var j = 0; j < movements.length; j++) {
            var mv = movements[j];
            var fp2 = grid.hexToPixel(mv.fromQ, mv.fromR);
            var tp2 = grid.hexToPixel(mv.toQ, mv.toR);
            mv.tile.animX = (fp2.x - tp2.x) * (1 - t);
            mv.tile.animY = (fp2.y - tp2.y) * (1 - t);
          }
        },
        onEnd: function () {
          for (var j = 0; j < movements.length; j++) {
            movements[j].tile.animX = 0;
            movements[j].tile.animY = 0;
          }
          // Recursively settle until stable
          self._animSettle(cb);
        }
      });
    },

    _resolveMatches: function (isGravShift, cb) {
      var matches = this.grid.findMatches();
      if (matches.length === 0) { if (cb) cb(); return; }

      this.cascadeDepth++;
      var self = this;
      var mult = ScoreCalculator.getCascadeMultiplier(this.cascadeDepth);
      var totalScore = 0;

      for (var i = 0; i < matches.length; i++) {
        var base = ScoreCalculator.calcMatchScore(matches[i].length);
        var ms = Math.round(base * mult);
        if (isGravShift) ms += 150;
        totalScore += ms;
      }
      totalScore += ScoreCalculator.getMultiMatchBonus(matches.length);

      // Highlight -> collapse -> settle -> recurse
      this._animHighlight(matches, function () {
        self._animCollapse(matches, totalScore, function () {
          self._handleCracked(matches);
          self._handleBombs(matches);
          self.score += totalScore;
          self._syncHUD();

          self._animSettle(function () {
            self._resolveMatches(isGravShift, cb);
          });
        });
      });
    },

    _animHighlight: function (matches, cb) {
      var all = [];
      for (var i = 0; i < matches.length; i++)
        for (var j = 0; j < matches[i].length; j++)
          all.push(matches[i][j].tile);

      var cascadeDepth = this.cascadeDepth;
      this.animQueue.push({
        duration: 0.25,
        onStart: function () {
          if (window.GameAudio) window.GameAudio.match(cascadeDepth);
        },
        onUpdate: function (t) {
          var flash = Math.abs(Math.sin(t * Math.PI * 2));
          for (var k = 0; k < all.length; k++) all[k].animFlash = flash;
        },
        onEnd: function () {
          for (var k = 0; k < all.length; k++) all[k].animFlash = 0;
          if (cb) cb();
        }
      });
    },

    _animCollapse: function (matches, score, cb) {
      var self = this;
      var grid = this.grid;
      var coords = [];
      var tiles = [];
      for (var i = 0; i < matches.length; i++)
        for (var j = 0; j < matches[i].length; j++) {
          coords.push(matches[i][j]);
          tiles.push(matches[i][j].tile);
        }

      this.animQueue.push({
        duration: 0.2,
        onUpdate: function (t) {
          for (var k = 0; k < tiles.length; k++) {
            tiles[k].animScale = 1 - t;
            tiles[k].animAlpha = 1 - t;
          }
        },
        onEnd: function () {
          var cx = 0, cy = 0;
          for (var k = 0; k < coords.length; k++) {
            var c = coords[k];
            var px = grid.hexToPixel(c.q, c.r);
            var color = TILE_COLORS[c.tile.color] || '#ffffff';
            self.particles.emit(px.x, px.y, color, 10, 100, 0.5);
            grid.removeTile(c.q, c.r);
            cx += px.x; cy += px.y;
          }
          if (coords.length > 0) {
            cx /= coords.length; cy /= coords.length;
            self.scorePopups.push(new ScorePopup(cx, cy, score));
          }
          if (cb) cb();
        }
      });
    },

    _handleCracked: function (matches) {
      var adj = new Set();
      for (var i = 0; i < matches.length; i++)
        for (var j = 0; j < matches[i].length; j++) {
          var nbrs = this.grid.getNeighbors(matches[i][j].q, matches[i][j].r);
          for (var k = 0; k < nbrs.length; k++)
            adj.add(hexKey(nbrs[k].q, nbrs[k].r));
        }
      var self = this;
      adj.forEach(function (key) {
        var parts = key.split(',');
        var q = parseInt(parts[0]), r = parseInt(parts[1]);
        var t = self.grid.getTile(q, r);
        if (t && t.type === 'cracked') {
          t.hp--;
          if (t.hp <= 0) {
            var px = self.grid.hexToPixel(q, r);
            self.particles.emit(px.x, px.y, '#888888', 8, 80, 0.4);
            self.grid.removeTile(q, r);
            self.score += 75;
          }
        }
      });
    },

    _handleBombs: function (matches) {
      for (var i = 0; i < matches.length; i++)
        for (var j = 0; j < matches[i].length; j++) {
          var m = matches[i][j];
          if (m.tile.type !== 'bomb') continue;
          var nbrs = this.grid.getNeighbors(m.q, m.r);
          for (var k = 0; k < nbrs.length; k++) {
            var nt = this.grid.getTile(nbrs[k].q, nbrs[k].r);
            if (nt && !nt.isObstacle()) {
              var px = this.grid.hexToPixel(nbrs[k].q, nbrs[k].r);
              this.particles.emit(px.x, px.y, '#ff8822', 6, 120, 0.4);
              this.grid.removeTile(nbrs[k].q, nbrs[k].r);
              this.score += 50;
            }
          }
        }
    },

    _animGravityShift: function (cb) {
      this.gravity.rotate();
      this._syncHUD();
      if (window.GameAudio) window.GameAudio.gravityShift();
      var self = this;
      this.animQueue.push({
        duration: 0.35,
        onEnd: function () {
          self.gravity.shifting = false;
          if (cb) cb();
        }
      });
    },

    // ──────────────────────────────────────────────────────────────
    //  WIN / LOSE
    // ──────────────────────────────────────────────────────────────
    _checkWinLose: function () {
      if (this.score >= this.targetScore) {
        this.state = 'LEVEL_COMPLETE';
        this._showComplete();
        return;
      }
      var empty = this.grid.getEmptyCells();
      if (empty.length === 0) {
        var matches = this.grid.findMatches();
        if (matches.length === 0) {
          this.state = 'GAME_OVER';
          this._showGameOver();
        } else {
          // Board is full but matches exist — auto-resolve them (safety net per GDD 3.3)
          var self = this;
          this.cascadeDepth = 0;
          this._resolveMatches(false, function () {
            self._checkWinLose();
          });
        }
      }
    },

    _showComplete: function () {
      var el = document.getElementById('completeScore');
      if (el) el.textContent = this.score;
      // Stars
      var cfg = this.levelConfig;
      if (cfg && cfg.starThresholds) {
        for (var i = 0; i < 3; i++) {
          var star = document.querySelector('#starRating [data-star="' + (i + 1) + '"]');
          if (star) {
            if (this.score >= cfg.starThresholds[i]) {
              star.classList.remove('star-empty'); star.classList.add('star-filled');
            } else {
              star.classList.remove('star-filled'); star.classList.add('star-empty');
            }
          }
        }
      }
      if (window.GameAudio) window.GameAudio.levelComplete();
      showOverlay('levelComplete');
    },

    _showGameOver: function () {
      var el = document.getElementById('gameOverScore');
      if (el) el.textContent = this.score;
      if (window.GameAudio) window.GameAudio.gameOver();
      showOverlay('gameOver');
    },

    // ──────────────────────────────────────────────────────────────
    //  HUD SYNC
    // ──────────────────────────────────────────────────────────────
    _showHUD: function (visible) {
      var hud = document.getElementById('hud');
      if (hud) {
        if (visible) { hud.classList.remove('hidden'); hud.classList.add('visible'); }
        else { hud.classList.remove('visible'); hud.classList.add('hidden'); }
      }
    },

    _syncHUD: function () {
      // Score
      var scoreEl = document.getElementById('hudScore');
      if (scoreEl) scoreEl.textContent = this.score;

      // Score bar
      var bar = document.getElementById('hudScoreBar');
      if (bar) bar.style.width = Math.min(100, (this.score / Math.max(1, this.targetScore)) * 100) + '%';

      // Level name
      var lvl = document.getElementById('hudLevelName');
      if (lvl && this.levelConfig) lvl.textContent = 'Level ' + this.currentLevel + ' - ' + this.levelConfig.name;

      // Gravity shift counter
      var shift = document.getElementById('hudShiftCount');
      if (shift && this.gravity) shift.textContent = this.gravity.movesUntilShift();

      // Gravity arrow rotation — use a wrapper variable for CSS custom property
      // so the imminent pulse animation (scale) does not override inline transform
      var arrow = document.getElementById('hudGravityIndicator');
      if (arrow && this.gravity) {
        var rotDeg = this.gravity.targetAngle - 180;
        arrow.style.setProperty('--grav-rotate', rotDeg + 'deg');
        if (this.gravity.movesUntilShift() <= 2) {
          arrow.classList.add('imminent');
        } else {
          arrow.classList.remove('imminent');
        }
      }

      // Next colors
      var nextEls = document.querySelectorAll('#hudNextColors .next-color-hex');
      for (var i = 0; i < nextEls.length; i++) {
        var idx = i + 1; // skip current (index 0)
        if (idx < this.colorQueue.length) {
          var cn = this.colorQueue[idx];
          if (cn.indexOf(':') !== -1) {
            var sp = cn.split(':');
            if (sp[0] === 'wildcard') {
              nextEls[i].setAttribute('data-color', 'wild');
            } else {
              // bomb/anchor — show the base color with a marker
              nextEls[i].setAttribute('data-color', sp[1]);
            }
          } else {
            nextEls[i].setAttribute('data-color', cn);
          }
        } else {
          nextEls[i].removeAttribute('data-color');
        }
      }
    },
  };

  // ─── Expose ─────────────────────────────────────────────────────────
  window.game = game;

  // Auto-init
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { game.init(); });
  } else {
    game.init();
  }

})();
