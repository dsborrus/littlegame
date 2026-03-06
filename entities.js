// entities.js — Hex Collapse: Game object classes
// Vanilla JS, no modules. All classes exposed via window globals.

(function () {
  'use strict';

  var SQRT3 = Math.sqrt(3);

  // Axial neighbor offsets for flat-top hexagons
  var HEX_DIRECTIONS = [
    { q: +1, r:  0 }, // 0 - East
    { q: +1, r: -1 }, // 1 - NE
    { q:  0, r: -1 }, // 2 - NW
    { q: -1, r:  0 }, // 3 - West
    { q: -1, r: +1 }, // 4 - SW
    { q:  0, r: +1 }, // 5 - SE
  ];

  // Gravity direction vectors (the direction tiles FALL toward)
  var GRAVITY_VECTORS = [
    { q:  0, r: +1 }, // 0 - South
    { q: -1, r: +1 }, // 1 - South-West
    { q: -1, r:  0 }, // 2 - North-West
    { q:  0, r: -1 }, // 3 - North
    { q: +1, r: -1 }, // 4 - North-East
    { q: +1, r:  0 }, // 5 - South-East
  ];

  var GRAVITY_LABELS = [
    'South', 'South-West', 'North-West', 'North', 'North-East', 'South-East'
  ];

  var GRAVITY_ANGLES = [180, 240, 300, 0, 60, 120];

  var TILE_COLORS = {
    red:    '#ff2255',
    blue:   '#2255ff',
    green:  '#22ff88',
    yellow: '#ffdd22',
    purple: '#aa22ff',
    orange: '#ff8822',
  };

  var TILE_GLOW = {
    red:    '#ff225580',
    blue:   '#2255ff80',
    green:  '#22ff8880',
    yellow: '#ffdd2280',
    purple: '#aa22ff80',
    orange: '#ff882280',
  };

  // Map hex codes back to color names
  var HEX_TO_NAME = {};
  (function () {
    var names = Object.keys(TILE_COLORS);
    for (var i = 0; i < names.length; i++) {
      HEX_TO_NAME[TILE_COLORS[names[i]].toLowerCase()] = names[i];
    }
  })();

  var COLOR_NAMES = ['red', 'blue', 'green', 'yellow', 'purple', 'orange'];

  // ─── Utility ────────────────────────────────────────────────────────
  function hexKey(q, r) {
    return q + ',' + r;
  }

  function cubeRound(fq, fr) {
    var fs = -fq - fr;
    var q = Math.round(fq);
    var r = Math.round(fr);
    var s = Math.round(fs);
    var qd = Math.abs(q - fq);
    var rd = Math.abs(r - fr);
    var sd = Math.abs(s - fs);
    if (qd > rd && qd > sd) {
      q = -r - s;
    } else if (rd > sd) {
      r = -q - s;
    }
    return { q: q, r: r };
  }

  // ─── Tile Class ─────────────────────────────────────────────────────
  function Tile(colorName, q, r, type) {
    this.color = colorName;         // 'red', 'blue', etc. or null for obstacles
    this.q = q;
    this.r = r;
    this.type = type || 'standard'; // standard, wildcard, bomb, anchor, stone, cracked
    this.hp = (type === 'cracked') ? 2 : 0;
    // Animation state
    this.animX = 0;
    this.animY = 0;
    this.animScale = 1;
    this.animAlpha = 1;
    this.animFlash = 0;
    this.placing = false;
    this.placeTimer = 0;
  }

  Tile.prototype.isObstacle = function () {
    return this.type === 'stone' || this.type === 'cracked';
  };

  Tile.prototype.isMovable = function () {
    return !this.isObstacle() && this.type !== 'anchor';
  };

  Tile.prototype.canMatch = function () {
    return !this.isObstacle();
  };

  // ─── HexGrid Class ──────────────────────────────────────────────────
  function HexGrid(radius, hexSize) {
    this.radius = radius;
    this.hexSize = hexSize || 30;
    this.cells = new Map();
    this.validCells = new Set();
    this._initCells();
  }

  HexGrid.prototype._initCells = function () {
    var rad = this.radius;
    for (var q = -rad; q <= rad; q++) {
      var r1 = Math.max(-rad, -q - rad);
      var r2 = Math.min(rad, -q + rad);
      for (var r = r1; r <= r2; r++) {
        var key = hexKey(q, r);
        this.validCells.add(key);
        this.cells.set(key, null);
      }
    }
  };

  HexGrid.prototype.isValid = function (q, r) {
    return this.validCells.has(hexKey(q, r));
  };

  HexGrid.prototype.getTile = function (q, r) {
    return this.cells.get(hexKey(q, r)) || null;
  };

  HexGrid.prototype.setTile = function (q, r, tile) {
    if (!this.isValid(q, r)) return false;
    this.cells.set(hexKey(q, r), tile);
    if (tile) { tile.q = q; tile.r = r; }
    return true;
  };

  HexGrid.prototype.removeTile = function (q, r) {
    if (!this.isValid(q, r)) return null;
    var tile = this.cells.get(hexKey(q, r));
    this.cells.set(hexKey(q, r), null);
    return tile;
  };

  HexGrid.prototype.isEmpty = function (q, r) {
    return this.isValid(q, r) && this.cells.get(hexKey(q, r)) === null;
  };

  HexGrid.prototype.getNeighbors = function (q, r) {
    var result = [];
    for (var i = 0; i < 6; i++) {
      var nq = q + HEX_DIRECTIONS[i].q;
      var nr = r + HEX_DIRECTIONS[i].r;
      if (this.isValid(nq, nr)) {
        result.push({ q: nq, r: nr });
      }
    }
    return result;
  };

  // Hex-to-pixel (flat-top)
  HexGrid.prototype.hexToPixel = function (q, r) {
    var size = this.hexSize;
    return {
      x: size * (3 / 2 * q),
      y: size * (SQRT3 / 2 * q + SQRT3 * r)
    };
  };

  // Pixel-to-hex with cube rounding (flat-top)
  HexGrid.prototype.pixelToHex = function (px, py) {
    var size = this.hexSize;
    var fq = (2 / 3 * px) / size;
    var fr = (-1 / 3 * px + SQRT3 / 3 * py) / size;
    return cubeRound(fq, fr);
  };

  HexGrid.prototype.getEmptyCells = function () {
    var empty = [];
    this.cells.forEach(function (tile, key) {
      if (tile === null) {
        var parts = key.split(',');
        empty.push({ q: parseInt(parts[0]), r: parseInt(parts[1]) });
      }
    });
    return empty;
  };

  HexGrid.prototype.getAllTiles = function () {
    var tiles = [];
    this.cells.forEach(function (tile) {
      if (tile !== null) tiles.push(tile);
    });
    return tiles;
  };

  HexGrid.prototype.forEachCell = function (fn) {
    this.validCells.forEach(function (key) {
      var parts = key.split(',');
      fn(parseInt(parts[0]), parseInt(parts[1]), key);
    });
  };

  // ─── Match Detection (flood-fill) ──────────────────────────────────
  HexGrid.prototype.findMatches = function () {
    var visited = new Set();
    var matches = [];
    var self = this;

    this.cells.forEach(function (tile, key) {
      if (!tile || tile.isObstacle() || visited.has(key)) return;
      if (tile.type === 'wildcard') return; // wildcards don't start groups
      var group = [];
      self._floodFill(tile.q, tile.r, tile.color, visited, group);
      if (group.length >= 3) {
        matches.push(group);
      }
    });
    return matches;
  };

  HexGrid.prototype._floodFill = function (q, r, color, visited, group) {
    var key = hexKey(q, r);
    if (visited.has(key)) return;
    var tile = this.getTile(q, r);
    if (!tile || tile.isObstacle()) return;
    if (tile.color !== color && tile.type !== 'wildcard') return;

    visited.add(key);
    group.push({ q: q, r: r, tile: tile });

    var neighbors = this.getNeighbors(q, r);
    for (var i = 0; i < neighbors.length; i++) {
      this._floodFill(neighbors[i].q, neighbors[i].r, color, visited, group);
    }
  };

  // ─── ParticleSystem Class ───────────────────────────────────────────
  function ParticleSystem() {
    this.particles = [];
    this.pool = [];
  }

  ParticleSystem.prototype._get = function () {
    if (this.pool.length > 0) return this.pool.pop();
    return { x: 0, y: 0, vx: 0, vy: 0, color: '#fff', life: 0, maxLife: 0, size: 0 };
  };

  ParticleSystem.prototype.emit = function (x, y, color, count, speed, lifetime) {
    count = count || 10;
    speed = speed || 120;
    lifetime = lifetime || 0.5;
    for (var i = 0; i < count; i++) {
      var angle = Math.random() * Math.PI * 2;
      var spd = speed * (0.4 + Math.random() * 0.6);
      var p = this._get();
      p.x = x; p.y = y;
      p.vx = Math.cos(angle) * spd;
      p.vy = Math.sin(angle) * spd;
      p.color = color;
      p.life = lifetime;
      p.maxLife = lifetime;
      p.size = 2 + Math.random() * 3;
      this.particles.push(p);
    }
  };

  ParticleSystem.prototype.update = function (dt) {
    for (var i = this.particles.length - 1; i >= 0; i--) {
      var p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.pool.push(this.particles.splice(i, 1)[0]);
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.96;
      p.vy *= 0.96;
    }
  };

  ParticleSystem.prototype.clear = function () {
    while (this.particles.length) this.pool.push(this.particles.pop());
  };

  // ─── GravitySystem Class ────────────────────────────────────────────
  function GravitySystem() {
    this.directionIndex = 0;
    this.moveCounter = 0;
    this.movesPerShift = 8;
    this.animAngle = 180;
    this.targetAngle = 180;
    this.shifting = false;
  }

  GravitySystem.prototype.getVector = function () {
    return GRAVITY_VECTORS[this.directionIndex];
  };

  GravitySystem.prototype.getLabel = function () {
    return GRAVITY_LABELS[this.directionIndex];
  };

  GravitySystem.prototype.movesUntilShift = function () {
    return this.movesPerShift - this.moveCounter;
  };

  GravitySystem.prototype.rotate = function () {
    this.directionIndex = (this.directionIndex + 1) % 6;
    this.targetAngle += 60;
    this.moveCounter = 0;
    this.shifting = true;
  };

  GravitySystem.prototype.incrementMove = function () {
    this.moveCounter++;
    return this.moveCounter >= this.movesPerShift;
  };

  GravitySystem.prototype.reset = function () {
    this.directionIndex = 0;
    this.moveCounter = 0;
    this.animAngle = 180;
    this.targetAngle = 180;
    this.shifting = false;
  };

  // Settle all tiles in gravity direction; returns movement list
  GravitySystem.prototype.settle = function (grid) {
    var gv = this.getVector();
    var movements = [];
    var moved = true;

    while (moved) {
      moved = false;
      var sorted = this._sortCells(grid, gv);
      for (var i = 0; i < sorted.length; i++) {
        var c = sorted[i];
        var tile = grid.getTile(c.q, c.r);
        if (!tile || !tile.isMovable()) continue;

        var nq = c.q + gv.q;
        var nr = c.r + gv.r;
        if (grid.isEmpty(nq, nr)) {
          grid.removeTile(c.q, c.r);
          grid.setTile(nq, nr, tile);
          movements.push({ fromQ: c.q, fromR: c.r, toQ: nq, toR: nr, tile: tile });
          moved = true;
        }
      }
    }
    return movements;
  };

  GravitySystem.prototype._sortCells = function (grid, gv) {
    var cells = [];
    grid.forEachCell(function (q, r) { cells.push({ q: q, r: r }); });
    cells.sort(function (a, b) {
      return (b.q * gv.q + b.r * gv.r) - (a.q * gv.q + a.r * gv.r);
    });
    return cells;
  };

  // ─── Score Calculator ───────────────────────────────────────────────
  var ScoreCalculator = {
    calcMatchScore: function (size) {
      if (size === 3) return 100;
      if (size === 4) return 250;
      if (size === 5) return 500;
      if (size >= 6) return 500 + 200 * (size - 5);
      return 0;
    },
    getCascadeMultiplier: function (depth) {
      if (depth <= 1) return 1.0;
      if (depth === 2) return 1.5;
      if (depth === 3) return 2.0;
      if (depth === 4) return 3.0;
      return 4.0;
    },
    getMultiMatchBonus: function (count) {
      if (count === 2) return 200;
      if (count === 3) return 500;
      if (count >= 4) return 1000;
      return 0;
    }
  };

  // ─── Expose to window ──────────────────────────────────────────────
  window.HexGrid = HexGrid;
  window.Tile = Tile;
  window.ParticleSystem = ParticleSystem;
  window.GravitySystem = GravitySystem;
  window.ScoreCalculator = ScoreCalculator;
  window.hexKey = hexKey;
  window.cubeRound = cubeRound;

  window.HEX_DIRECTIONS = HEX_DIRECTIONS;
  window.GRAVITY_VECTORS = GRAVITY_VECTORS;
  window.GRAVITY_LABELS = GRAVITY_LABELS;
  window.GRAVITY_ANGLES = GRAVITY_ANGLES;
  window.TILE_COLORS = TILE_COLORS;
  window.TILE_GLOW = TILE_GLOW;
  window.HEX_TO_NAME = HEX_TO_NAME;
  window.COLOR_NAMES = COLOR_NAMES;

})();
