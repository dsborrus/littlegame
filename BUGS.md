# BUGS.md -- Hex Collapse QA Report

## Bugs Found and Fixed

### 1. Grid Radius Mismatch (levels.js)
**File:** `/levels.js`, all level definitions
**Problem:** The GDD states "Radius 4 = 37 cells" but the hex grid formula `3N^2 + 3N + 1` gives 61 cells for N=4 and 37 cells for N=3. All `gridRadius` values were off by 1, making every level board significantly larger than designed.
**Fix:** Adjusted `gridRadius` for all 7 levels:
- Levels 1-2: `4` -> `3` (37 cells as intended)
- Levels 3-5: `5` -> `4` (61 cells as intended)
- Levels 6-7: `6` -> `5` (91 cells as intended)

### 2. Hover Preview Crash for Wildcard Tiles (game.js, `_render`)
**File:** `/game.js`, line ~273
**Problem:** When the current queue entry was `'wildcard'`, the code tried `TILE_COLORS['wildcard']` which is `undefined`, causing the hover ghost color to be null/broken.
**Fix:** Added explicit check: if the current entry is a wildcard (or any special tile), display white hover for wildcards and the base tile color for bombs/anchors.

### 3. Gravity Indicator CSS Animation Override (styles.css + game.js)
**File:** `/styles.css` + `/game.js`, `_syncHUD`
**Problem:** The gravity indicator used inline `style.transform = 'rotate(...)'` for direction, but the `.imminent` CSS animation used `transform: scale()` for the pulse effect. Since CSS animations override inline transforms, when imminent mode activated, the rotation was lost and the indicator snapped to 0deg.
**Fix:** Changed to CSS custom property `--grav-rotate` set via `style.setProperty()`. Updated `@keyframes gravityPulse` to include `rotate(var(--grav-rotate))` alongside `scale()`, preserving both rotation and pulse.

### 4. Double-Roll Special Tile Probability (game.js)
**File:** `/game.js`, `_genNextTileColor` + `_placeTile`
**Problem:** `_genNextTileColor` only detected wildcards as special; bomb/anchor were ignored and fell through to normal color generation. Then `_placeTile` did a second `_rollSpecialType()` call for non-wildcard entries, creating inconsistent probability: wildcards rolled once in queue, bomb/anchor rolled once at placement, effectively doubling the special tile check.
**Fix:** `_genNextTileColor` now encodes ALL special types as `"type:colorName"` strings (e.g., `"bomb:red"`, `"wildcard:blue"`). `_placeTile` parses this format and never re-rolls. The preview queue correctly shows the base color for bomb/anchor tiles and rainbow for wildcards.

### 5. Board Full With Matches = Stuck State (game.js, `_checkWinLose`)
**File:** `/game.js`, `_checkWinLose`
**Problem:** When the board was completely full but valid matches existed, the game neither triggered Game Over nor resolved the matches. The player was stuck with no empty cells to place a tile and existing matches that would never trigger.
**Fix:** Added auto-resolve: when empty cells = 0 and matches exist, the game now automatically resolves those matches (per GDD section 3.3 "No-Move Detection") and re-checks win/lose after resolution.

### 6. Next Level After Final Level = Fallback to Level 1 (game.js, `loadLevel`)
**File:** `/game.js`, `loadLevel`
**Problem:** Clicking "Next Level" after completing Level 7 called `loadLevel(8)`. Since level 8 doesn't exist, the code fell back to `levels[0]` (Level 1), silently restarting the game without explanation.
**Fix:** Changed fallback behavior: if the requested level doesn't exist, the game returns to the main menu instead of silently loading level 1.

### 7. Missing Audio System
**File:** New file `/audio.js` created
**Problem:** The GDD specifies comprehensive audio design but no sound system existed.
**Fix:** Created `/audio.js` with procedural Web Audio API sounds:
- Tile placement: short click/pop (two layered sine oscillators)
- Match/collapse: ascending chime that increases pitch with cascade depth
- Gravity shift: low sawtooth + sine sub-bass + filtered noise whoosh
- Level complete: ascending 5-note arpeggio with slight detune for richness
- Game over: descending 5-note triangle wave sequence
- UI button click: subtle short sine pop
- Audio context is lazily initialized on first interaction (browser autoplay policy)

All sounds integrated into game.js at appropriate trigger points. Audio script tag added to index.html before game.js.

## Integration Verification

### Script Load Order
`entities.js` -> `levels.js` -> `renderer.js` -> `audio.js` -> `game.js` -- Verified correct. Each file depends only on previously loaded globals.

### Window Globals Cross-Reference
- `HexGrid`, `Tile`, `ParticleSystem`, `GravitySystem`, `ScoreCalculator` (entities.js) -- all referenced correctly in game.js
- `TILE_COLORS`, `TILE_GLOW`, `HEX_TO_NAME`, `COLOR_NAMES`, `hexKey` (entities.js) -- used correctly in game.js and renderer.js
- `window.LEVELS` (levels.js) -- accessed in game.js `loadLevel()`
- `window.Renderer` (renderer.js) -- instantiated in game.js `init()`
- `window.GameAudio` (audio.js) -- called with null-checks throughout game.js
- `window.game` (game.js) -- referenced in HTML onclick handlers

### HTML Button Handlers
All onclick handlers verified to match game.js public API:
- `window.game.start()` -- exists
- `window.game.pause()` -- exists
- `window.game.resume()` -- exists
- `window.game.restart()` -- exists
- `window.game.goToMenu()` -- exists
- `window.game.loadLevel(n)` -- exists

### CSS Class Usage
- `.hidden` / `.visible` -- used in game.js `showOverlay`/`hideOverlay`, defined in styles.css
- `.star-empty` / `.star-filled` -- toggled in `_showComplete`, defined in styles.css
- `.imminent` -- toggled in `_syncHUD`, defined in styles.css

### HUD Element IDs
All verified matching between game.js and index.html:
- `hudScore`, `hudScoreBar`, `hudLevelName`, `hudShiftCount`
- `hudGravityIndicator`, `hudNextColors`, `hudPauseBtn`
- `completeScore`, `gameOverScore`, `starRating`

## Remaining Known Issues / Limitations

1. **No localStorage persistence**: Star ratings and level unlocks are not saved between sessions. The GDD specifies localStorage save/load but this is not implemented.

2. **Level select always allows all levels**: Locked levels in the UI have a `.locked` CSS class but clicking them still loads the level. No unlock gating is enforced.

3. **No tutorial overlay system**: The GDD and level configs define tutorial messages (e.g., "Place a tile on any empty cell") but no tutorial rendering system exists.

4. **Bomb/anchor tiles not visually distinguished in next-tile preview**: The HUD preview shows the base color but no bomb ring or anchor icon overlay. Only wildcards get the rainbow indicator.

5. **No music**: The GDD describes adaptive background music but only sound effects are implemented.

6. **Keyboard shortcut 'R' can restart during active animation**: If the player presses R while a cascade animation is playing, the level restarts mid-animation. This is harmless but could be surprising.

7. **Touch input on mobile**: The touch handler uses `touchstart` for position tracking and `touchend` for placement. This works but doesn't provide visual feedback during the touch (no hover preview on touch devices).
