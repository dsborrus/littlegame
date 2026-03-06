# Hex Collapse — Game Design Document

**Version:** 1.0
**Date:** 2026-03-05
**Status:** Pre-Production

---

## Table of Contents

1. [Game Overview](#1-game-overview)
2. [Core Mechanics](#2-core-mechanics)
3. [Win/Lose Conditions](#3-winlose-conditions)
4. [Levels](#4-levels)
5. [Scoring System](#5-scoring-system)
6. [Player Controls](#6-player-controls)
7. [Visual Style](#7-visual-style)
8. [Audio Design](#8-audio-design)
9. [Game States](#9-game-states)
10. [Technical Notes](#10-technical-notes)
11. [Glossary](#11-glossary)

---

## 1. Game Overview

| Field          | Value                                                        |
| -------------- | ------------------------------------------------------------ |
| **Title**      | Hex Collapse                                                 |
| **Genre**      | Strategic Puzzle                                              |
| **Platform**   | Web (desktop and mobile browsers)                            |
| **Engine**     | Custom HTML5 Canvas                                          |
| **Target**     | Casual-to-intermediate puzzle players, ages 10+              |
| **Session**    | 3-10 minutes per level                                       |

### Concept Statement

Hex Collapse is a strategic puzzle game in which players place colored hexagonal tiles onto a hexagonal grid to form chains of three or more matching colors. Matched chains collapse and score points. The defining twist is a rotating gravity system: every N moves the gravity direction rotates 60 degrees, causing all unsupported tiles to slide and settle in the new direction. This creates cascading chain reactions that reward forward-thinking players who plan for the shift.

### Pillars

1. **Strategic Depth** — Gravity rotation is predictable. Skilled players exploit it.
2. **Satisfying Cascades** — Chain reactions produce escalating visual and audio feedback.
3. **Accessible Complexity** — Easy to learn (match 3 colors), hard to master (gravity planning).

---

## 2. Core Mechanics

### 2.1 The Hexagonal Grid

- The board is a regular hexagonal grid using **flat-top hexagons**.
- Coordinate system: **axial coordinates (q, r)** with a derived cube coordinate (q, r, s) where s = -q - r.
- Default board radius varies by level (radius 4 = 37 cells, radius 5 = 61 cells, radius 6 = 91 cells).
- Each cell is either **empty**, **occupied by a colored tile**, or **blocked** (obstacle).

```
Board Radius Reference:
  Radius 4  ->  37 playable cells
  Radius 5  ->  61 playable cells
  Radius 6  ->  91 playable cells
```

### 2.2 Tile Placement

1. The player is shown a **current tile** with a specific color drawn from the level's color pool.
2. A **next tile** preview shows the upcoming color (queue depth increases in later levels).
3. The player clicks/taps any **empty, unblocked cell** to place the tile.
4. After placement the board is evaluated for matches, then cascades, then the move counter advances.

### 2.3 Color Matching

- A **match** is a connected group of **3 or more tiles of the same color** that are orthogonally adjacent in hex space (each hex has up to 6 neighbors).
- Matching uses **flood-fill adjacency** — any connected region of same-color tiles of size >= 3 collapses.
- Multiple distinct groups can match simultaneously after a single placement or gravity shift.
- Matched tiles are removed from the board in an animated collapse sequence.

### 2.4 Gravity System

Gravity is the defining mechanic. It works as follows:

#### 2.4.1 Gravity Directions

A flat-top hexagonal grid has **6 cardinal edge directions**. Gravity pulls tiles toward one of these edges. The six directions, labeled by the edge tiles slide toward, are:

| Direction ID | Label      | Axial Vector (dq, dr) | Angle from Top |
| ------------ | ---------- | ---------------------- | -------------- |
| 0            | South      | (0, +1)                | 180 deg        |
| 1            | South-West | (-1, +1)               | 240 deg        |
| 2            | North-West | (-1, 0)                | 300 deg        |
| 3            | North      | (0, -1)                | 0 deg          |
| 4            | North-East | (+1, -1)               | 60 deg         |
| 5            | South-East | (+1, 0)                | 120 deg        |

Default starting gravity: **Direction 0 (South)** — tiles fall downward.

#### 2.4.2 Gravity Rotation

- A **gravity shift** occurs every **N player moves** (N is level-dependent).
- The shift rotates gravity **60 degrees clockwise** (Direction 0 -> 1 -> 2 -> 3 -> 4 -> 5 -> 0).
- A visible **move counter / gravity gauge** shows how many moves remain until the next shift.
- When gravity shifts:
  1. A brief animation rotates the gravity indicator.
  2. All tiles on the board **slide** in the new gravity direction until they hit the board edge, an obstacle, or another settled tile.
  3. After settling, the board is re-evaluated for matches.
  4. If matches occur, those tiles collapse, remaining tiles settle again under the current gravity, and the cycle repeats (cascade).
  5. Cascades continue until no further matches exist.

#### 2.4.3 Settling Algorithm

```
function settle(board, gravityDirection):
    repeat:
        moved = false
        for each tile in board (processed opposite to gravity direction):
            neighbor = tile.position + gravityDirection
            if neighbor is empty and within bounds:
                move tile to neighbor
                moved = true
    until moved == false
```

Tiles are processed in **reverse gravity order** (tiles furthest in the gravity direction settle first) to avoid collision conflicts.

#### 2.4.4 Post-Placement Sequence

After every tile placement, the following sequence executes in order:

```
1. Place tile at selected cell
2. Settle board (current gravity)
3. Evaluate matches -> collapse matched tiles -> score
4. If any matches found, go to step 2 (cascade loop)
5. Increment move counter
6. If move counter == N:
   a. Rotate gravity 60 degrees clockwise
   b. Reset move counter
   c. Settle board (new gravity)
   d. Evaluate matches -> collapse -> score
   e. If any matches found, go to step 6c (gravity cascade loop)
7. Check win/lose conditions
8. Advance to next tile
```

### 2.5 Special Tiles

Introduced progressively across levels:

| Tile Type     | Appearance                  | Behavior                                                                 | Introduced |
| ------------- | --------------------------- | ------------------------------------------------------------------------ | ---------- |
| **Standard**  | Solid neon color            | Normal matching and gravity behavior                                     | Level 1    |
| **Wildcard**  | Prismatic / rainbow shimmer | Matches with ANY adjacent color group. Consumed on match.                | Level 3    |
| **Bomb**      | Color with pulse ring       | When matched, also destroys all tiles in a 1-hex radius around it.       | Level 4    |
| **Anchor**    | Color with anchor icon      | Immune to gravity — stays in place during shifts. Still matchable.       | Level 5    |
| **Stone**     | Dark grey, no color         | Obstacle. Cannot be matched or moved. Occupies a cell permanently.       | Level 4    |
| **Cracked**   | Stone with crack lines      | Obstacle. Destroyed when an adjacent match occurs. Takes 2 adjacent matches to break. | Level 6 |

Special tiles appear in the tile queue at level-defined probabilities.

---

## 3. Win/Lose Conditions

### 3.1 Win Condition

Each level has a **target score**. The player wins the level by reaching or exceeding the target score before the board fills up.

Optional secondary objectives per level (for star ratings):

| Stars | Requirement                                    |
| ----- | ---------------------------------------------- |
| 1     | Reach the target score                         |
| 2     | Reach the target score with <= X tiles placed  |
| 3     | Reach the target score AND trigger Y cascades  |

### 3.2 Lose Condition

The player loses if:

- Every non-blocked cell on the board is occupied AND
- No valid matches exist on the current board AND
- The gravity shift does not produce any matches after settling

When the lose condition is met, the game enters the **Game Over** state. The player may retry the level.

### 3.3 No-Move Detection

After each placement and gravity resolution, the engine checks:

1. Are there any empty cells? If yes, game continues.
2. If no empty cells, are there any connected same-color groups of size >= 3? If yes, those match immediately (edge case — should have been caught in cascade, but serves as safety net).
3. If no empty cells and no matches, trigger Game Over.

---

## 4. Levels

### Level Progression Philosophy

Early levels teach mechanics in isolation. Mid levels combine mechanics. Late levels demand mastery of gravity prediction and cascade planning.

---

### Level 1 — "First Steps"

| Parameter           | Value                  |
| ------------------- | ---------------------- |
| Board Radius        | 4 (37 cells)           |
| Colors              | 3 (Red, Blue, Green)   |
| Gravity Shift Every | 8 moves                |
| Target Score        | 500                    |
| Special Tiles       | None                   |
| Obstacles           | None                   |
| Queue Preview       | 1 next tile            |

**Design Intent:** Teach tile placement and basic color matching. The gravity shift is slow enough that players experience it 2-3 times and observe its effects without pressure. Only 3 colors makes matches frequent and forgiving.

**Tutorial Overlays:**
- Move 1: "Place a tile on any empty cell."
- Move 3: "Match 3 or more of the same color to collapse them!"
- Before first gravity shift: "Gravity is about to rotate! Watch how tiles slide."

---

### Level 2 — "Building Pressure"

| Parameter           | Value                        |
| ------------------- | ---------------------------- |
| Board Radius        | 4 (37 cells)                 |
| Colors              | 4 (+ Yellow)                 |
| Gravity Shift Every | 7 moves                      |
| Target Score        | 1,200                        |
| Special Tiles       | None                         |
| Obstacles           | None                         |
| Queue Preview       | 1 next tile                  |

**Design Intent:** Introduce a 4th color, reducing the probability of accidental matches. Faster gravity shifts (7 moves) force players to start considering the upcoming shift when placing tiles. Higher score target requires deliberate cascade setups.

---

### Level 3 — "Wild Card"

| Parameter           | Value                            |
| ------------------- | -------------------------------- |
| Board Radius        | 5 (61 cells)                     |
| Colors              | 4                                |
| Gravity Shift Every | 6 moves                          |
| Target Score        | 2,500                            |
| Special Tiles       | Wildcard (10% spawn rate)        |
| Obstacles           | None                             |
| Queue Preview       | 2 next tiles                     |

**Design Intent:** Larger board gives more space but requires more tiles to fill, raising the stakes. Wildcard tiles teach players about special tile mechanics. The 2-tile preview queue encourages planning. Gravity shifts every 6 moves demand awareness.

**Tutorial Overlay:**
- On first Wildcard: "Wildcard tiles match with ANY color! Use them to bridge gaps."

---

### Level 4 — "Obstacles & Explosions"

| Parameter           | Value                                        |
| ------------------- | -------------------------------------------- |
| Board Radius        | 5 (61 cells)                                 |
| Colors              | 5 (+ Purple)                                 |
| Gravity Shift Every | 5 moves                                      |
| Target Score        | 4,000                                        |
| Special Tiles       | Wildcard (8%), Bomb (5%)                     |
| Obstacles           | 4 Stone cells (fixed positions, symmetric)   |
| Queue Preview       | 2 next tiles                                 |

**Design Intent:** Stone obstacles fragment the board, creating isolated pockets that gravity shifts can bridge. Bomb tiles reward players who build matches near dense areas. Five colors make matches harder to form organically — deliberate setup is required.

**Stone Placement:** 4 stones arranged in a loose diamond near the board center, creating channels that tiles flow through during gravity shifts.

**Tutorial Overlay:**
- On first Bomb: "Bomb tiles explode in a 1-hex radius when matched!"
- On encounter with Stone: "Stone blocks cannot be moved or matched. Plan around them."

---

### Level 5 — "Anchored Chaos"

| Parameter           | Value                                           |
| ------------------- | ----------------------------------------------- |
| Board Radius        | 5 (61 cells)                                    |
| Colors              | 5                                               |
| Gravity Shift Every | 4 moves                                         |
| Target Score        | 6,000                                           |
| Special Tiles       | Wildcard (8%), Bomb (5%), Anchor (7%)           |
| Obstacles           | 3 Stone cells                                   |
| Queue Preview       | 3 next tiles                                    |

**Design Intent:** Anchor tiles stay in place during gravity shifts, acting as both strategic tools and potential blockers. With gravity rotating every 4 moves, the board reshuffles frequently — anchors become vital reference points. The 3-tile preview queue is essential for planning around rapid shifts.

**Tutorial Overlay:**
- On first Anchor: "Anchored tiles resist gravity! They stay put during shifts but still match normally."

---

### Level 6 — "Crumbling Fortress"

| Parameter           | Value                                                  |
| ------------------- | ------------------------------------------------------ |
| Board Radius        | 6 (91 cells)                                           |
| Colors              | 5                                                      |
| Gravity Shift Every | 4 moves                                                |
| Target Score        | 9,000                                                  |
| Special Tiles       | Wildcard (6%), Bomb (5%), Anchor (5%)                  |
| Obstacles           | 6 Stone cells, 4 Cracked cells                         |
| Queue Preview       | 3 next tiles                                           |

**Design Intent:** The largest board with the full obstacle set. Cracked blocks reward aggressive play near obstacles — they break after 2 adjacent matches, opening new board space. The combination of all mechanics on a large board with fast gravity shifts creates complex, rewarding cascade opportunities.

---

### Level 7 — "Gravity Storm"

| Parameter           | Value                                                  |
| ------------------- | ------------------------------------------------------ |
| Board Radius        | 6 (91 cells)                                           |
| Colors              | 6 (+ Orange)                                           |
| Gravity Shift Every | 3 moves                                                |
| Target Score        | 15,000                                                 |
| Special Tiles       | Wildcard (5%), Bomb (5%), Anchor (5%)                  |
| Obstacles           | 8 Stone cells, 6 Cracked cells                         |
| Queue Preview       | 3 next tiles                                           |

**Design Intent:** Endgame challenge. Six colors make spontaneous matches rare. Gravity shifts every 3 moves mean the board is in near-constant flux. Success requires multi-shift planning — setting up tile arrangements that cascade across two or three consecutive gravity rotations.

---

### Level Summary Table

| Level | Radius | Colors | Shift Every | Target | Special Tiles          | Obstacles      |
| ----- | ------ | ------ | ----------- | ------ | ---------------------- | -------------- |
| 1     | 4      | 3      | 8           | 500    | None                   | None           |
| 2     | 4      | 4      | 7           | 1,200  | None                   | None           |
| 3     | 5      | 4      | 6           | 2,500  | Wildcard               | None           |
| 4     | 5      | 5      | 5           | 4,000  | Wildcard, Bomb         | 4 Stone        |
| 5     | 5      | 5      | 4           | 6,000  | Wildcard, Bomb, Anchor | 3 Stone        |
| 6     | 6      | 5      | 4           | 9,000  | Wildcard, Bomb, Anchor | 6 Stone, 4 Cracked |
| 7     | 6      | 6      | 3           | 15,000 | Wildcard, Bomb, Anchor | 8 Stone, 6 Cracked |

---

## 5. Scoring System

### 5.1 Base Scoring

| Event                 | Points                          |
| --------------------- | ------------------------------- |
| 3-tile match          | 100                             |
| 4-tile match          | 250                             |
| 5-tile match          | 500                             |
| 6+ tile match         | 500 + 200 per tile beyond 5     |
| Bomb radius clear     | +50 per extra tile destroyed     |
| Cracked block broken  | +75 per block                    |

### 5.2 Cascade Multiplier

When a collapse causes tiles to settle and form new matches (a cascade), a multiplier is applied:

| Cascade Depth | Multiplier |
| ------------- | ---------- |
| 1 (initial)   | x1.0       |
| 2              | x1.5       |
| 3              | x2.0       |
| 4              | x3.0       |
| 5+             | x4.0       |

The multiplier applies to all matches formed at that cascade depth. For example, a 3-tile match at cascade depth 3 scores 100 x 2.0 = 200 points.

### 5.3 Gravity Shift Combo

Matches that occur as a **direct result of a gravity shift** (not player placement) receive a flat bonus:

| Event                        | Bonus              |
| ---------------------------- | ------------------- |
| Any match from gravity shift | +150 per match group |
| Cascade from gravity shift   | Normal cascade multiplier applies on top of the +150 bonus |

This rewards players who pre-position tiles to match after a gravity rotation.

### 5.4 Multi-Match Bonus

When multiple distinct color groups match simultaneously (from a single placement or gravity event):

| Simultaneous Groups | Bonus          |
| ------------------- | -------------- |
| 2 groups            | +200           |
| 3 groups            | +500           |
| 4+ groups           | +1,000         |

### 5.5 Scoring Example

> Player places a tile that forms a 4-tile red match (250 pts). The collapse causes 3 blue tiles to fall together (cascade depth 2: 100 x 1.5 = 150 pts). Then those collapses cause 3 green tiles to match (cascade depth 3: 100 x 2.0 = 200 pts). Total: 250 + 150 + 200 = 600 pts.

> Two moves later, gravity shifts. The shift causes a 5-tile yellow match (+150 gravity bonus + 500 base = 650 pts) and a 3-tile red match (+150 gravity bonus + 100 base = 250 pts) simultaneously (multi-match bonus +200). The yellow collapse cascades into a 3-tile green match (cascade depth 2: 100 x 1.5 = 150 pts). Total: 650 + 250 + 200 + 150 = 1,250 pts.

### 5.6 Score Display

- Current score: always visible, top-center.
- Points earned per action: animated floating text at the location of the collapse.
- Multiplier indicator: appears during cascades with escalating visual intensity.
- Target score: progress bar beneath current score.

---

## 6. Player Controls

### 6.1 Mouse / Touch Controls

| Action                      | Input                                      |
| --------------------------- | ------------------------------------------ |
| Place tile                  | Click/tap an empty cell                    |
| Hover preview               | Mouse hover highlights target cell and shows tile preview ghost |
| View tile info              | Right-click or long-press a placed tile    |

### 6.2 Keyboard Shortcuts

| Key       | Action                                                   |
| --------- | -------------------------------------------------------- |
| `1-6`     | (Future/debug) Force select color from pool              |
| `G`       | Toggle gravity direction overlay (shows arrow on board)  |
| `N`       | Toggle next-shift preview (ghost of where tiles would slide if gravity shifted now) |
| `Space`   | Pause / Unpause                                          |
| `R`       | Restart level                                            |
| `Escape`  | Open pause menu                                          |
| `M`       | Toggle music                                             |
| `S`       | Toggle sound effects                                     |

### 6.3 Gravity Preview Mode

Pressing `N` enters **gravity preview mode**:

- All tiles on the board are shown in their current positions with full opacity.
- Semi-transparent "ghost" versions of each tile appear where they would end up after the next gravity shift.
- Ghost connections highlight potential matches that would form post-shift.
- This preview is purely visual — no game state changes.
- Preview mode auto-dismisses after 3 seconds or on any click/keypress.

### 6.4 Mobile Adaptations

- Tile placement: tap cell.
- Gravity preview: dedicated on-screen button (eye icon).
- Pause: on-screen hamburger menu.
- Tile queue displayed horizontally at screen bottom.
- Hex cells are sized to minimum 44px tap target (WCAG).

---

## 7. Visual Style

### 7.1 Color Palette

**Background:**
- Primary: `#0a0a1a` (deep navy-black)
- Grid lines: `#1a1a3a` (subtle dark blue)

**Tile Colors (neon):**

| Color   | Hex Code  | Glow Color |
| ------- | --------- | ---------- |
| Red     | `#ff2255` | `#ff225580` |
| Blue    | `#2255ff` | `#2255ff80` |
| Green   | `#22ff88` | `#22ff8880` |
| Yellow  | `#ffdd22` | `#ffdd2280` |
| Purple  | `#aa22ff` | `#aa22ff80` |
| Orange  | `#ff8822` | `#ff882280` |

**Special Tiles:**
- Wildcard: Cycling rainbow gradient with white sparkle particles.
- Bomb: Base color with a pulsing orange ring.
- Anchor: Base color with a white anchor icon overlay.
- Stone: `#333344` with a subtle rock texture pattern.
- Cracked: Stone color with visible crack lines; cracks glow after first adjacent match.

**UI Chrome:**
- Text: `#e0e0ff` (soft white-blue)
- Accent: `#00ffcc` (cyan-teal)
- Warning: `#ff4444`
- Score text: `#ffffff`

### 7.2 Hex Cell Rendering

- **Default empty cell:** Thin neon outline (`#1a1a3a` at 1px), no fill.
- **Hovered cell:** Outline brightens to `#00ffcc`, interior shows ghost of current tile at 30% opacity.
- **Occupied cell:** Filled with tile color, subtle inner glow, 2px neon outline matching tile color.
- **Gravity direction indicator:** Small arrow in the board margin pointing in the current gravity direction. Pulses when shift is imminent (last 2 moves).

### 7.3 Animations

| Event               | Animation                                                        | Duration |
| -------------------- | ---------------------------------------------------------------- | -------- |
| Tile placement       | Tile scales from 0 to 100% with a soft bounce ease              | 200ms    |
| Match highlight      | Matched tiles flash white twice                                  | 400ms    |
| Collapse             | Tiles shrink to center, emit 8-12 color-matched particles       | 300ms    |
| Tile slide (gravity) | Tiles translate smoothly to new position with slight trail       | 150ms per cell |
| Gravity shift        | Board-edge arrow rotates 60 degrees; brief radial pulse wave    | 500ms    |
| Cascade multiplier   | "x1.5!", "x2.0!" text scales up and fades, color intensifies    | 600ms    |
| Score popup          | "+250" floats upward from collapse location, fades out           | 800ms    |
| Board fill warning   | Board edge pulses red when < 5 empty cells remain               | Repeating |
| Level complete       | All tiles cascade off-screen, score counter rolls up, stars fly in | 2000ms |
| Game over            | Board dims to 30% opacity, tiles crack and fall, "Game Over" fades in | 1500ms |

### 7.4 Particle System

- Collapse particles: 8-12 small circles in the matched tile's color, burst outward with randomized velocity and fade over 500ms.
- Bomb explosion: 20-30 particles in orange/white, larger radius burst.
- Gravity shift: Subtle dust/mote particles drift across the board in the new gravity direction for 1 second.
- Cascade chain: Particles from one collapse drift toward the next cascade location (visual thread connecting chain reactions).

### 7.5 UI Layout

```
+----------------------------------------------+
|  [Menu]     LEVEL 3      [Pause] [Settings]  |
|                                               |
|     Score: 1,250 / 2,500  [||||||||----]      |
|     Moves to shift: 3     [>>> arrow]         |
|                                               |
|              +---+                            |
|            /       \                          |
|          /   HEX     \                        |
|         |    GRID      |                      |
|          \             /                       |
|            \         /                         |
|              +---+                            |
|                                               |
|     Next: [Blue] [Red] [Green]                |
|                                               |
|     Current Tile: [=Yellow=]                  |
+----------------------------------------------+
```

---

## 8. Audio Design

### 8.1 Music

- **Menu:** Ambient synth pad, slow tempo, mysterious tone.
- **Gameplay:** Low-key electronic beat, adaptive — tempo increases slightly as board fills.
- **Gravity shift:** Brief whoosh + sub-bass drop, integrated with music.
- **Level complete:** Uplifting chime progression.
- **Game over:** Descending tone, fade to silence.

### 8.2 Sound Effects

| Event              | Sound Description                              |
| ------------------ | ---------------------------------------------- |
| Tile place         | Soft click/snap                                |
| Match (3)          | Bright chime, single note                      |
| Match (4)          | Chime chord, two notes                         |
| Match (5+)         | Full chord with shimmer                        |
| Cascade            | Rising pitch chime for each depth level        |
| Gravity shift      | Low whoosh + mechanical rotation sound         |
| Bomb explode       | Muffled boom with glass shatter overlay        |
| Anchor resist      | Heavy metallic clank when gravity shifts        |
| Stone block        | Dull thud when tile slides into stone          |
| Cracked break      | Crumbling/cracking sound                       |
| Wildcard place     | Sparkle/twinkle                                |
| Board nearly full  | Subtle heartbeat pulse                          |
| UI button click    | Soft pop                                        |

### 8.3 Audio Cascade Scaling

During cascades, each successive depth plays its chime at a higher pitch, creating an ascending musical phrase that reinforces the feeling of building momentum.

---

## 9. Game States

### 9.1 State Machine

```
                     +--------+
                     |  BOOT  |
                     +---+----+
                         |
                         v
                   +-----------+
            +----->|   MENU    |<-----------+
            |      +-----+-----+            |
            |            |                  |
            |            v                  |
            |    +---------------+          |
            |    | LEVEL SELECT  |          |
            |    +-------+-------+          |
            |            |                  |
            |            v                  |
            |      +-----------+            |
            |      |  PLAYING  |<------+    |
            |      +-----+-----+       |    |
            |       |    |    |        |    |
            |       |    |    v        |    |
            |       |    | +--------+  |    |
            |       |    | | PAUSED |--+    |
            |       |    | +--------+       |
            |       |    |                  |
            |       v    v                  |
            |  +------+ +------------+      |
            |  | GAME | |   LEVEL    |      |
            |  | OVER | |  COMPLETE  |      |
            |  +--+---+ +------+-----+      |
            |     |            |            |
            |     v            v            |
            |  [Retry]    [Next Level]      |
            |     |            |            |
            +-----+            +------------+
```

### 9.2 State Descriptions

**BOOT**
- Load assets (tile sprites, fonts, audio).
- Initialize Canvas and rendering context.
- Transition to MENU on completion.

**MENU**
- Display game title with animated hex background.
- Options: New Game, Continue, Settings, Credits.
- Continue is only available if saved progress exists (localStorage).

**LEVEL SELECT**
- Grid of level buttons showing level number, star rating (0-3), and locked/unlocked state.
- Levels unlock sequentially (completing level N unlocks level N+1).
- Selecting a level loads its configuration and transitions to PLAYING.

**PLAYING**
- Active gameplay. All core mechanics operational.
- HUD visible: score, target, move counter, gravity indicator, tile queue.
- Input is processed (clicks place tiles, keyboard shortcuts active).

**PAUSED**
- Overlay dims the board to 50% opacity.
- Options: Resume, Restart Level, Settings, Quit to Menu.
- Game clock and all animations frozen.
- Input restricted to pause menu interactions only.

**LEVEL COMPLETE**
- Triggered when score >= target score.
- Celebration animation plays.
- Star rating displayed (1-3 stars based on criteria).
- Options: Next Level, Retry (for better stars), Menu.
- Progress saved to localStorage.

**GAME OVER**
- Triggered when board is full with no valid matches and no gravity-shift resolution.
- Board dims, game-over animation plays.
- Final score displayed.
- Options: Retry, Menu.

### 9.3 Persistence

- **Save data (localStorage):**
  - Highest level unlocked
  - Star rating per level
  - High score per level
  - Settings (volume, music toggle, SFX toggle)
- **No mid-level saves.** Levels are short enough (3-10 min) that save/resume is unnecessary.

---

## 10. Technical Notes

### 10.1 Rendering

- **Renderer:** HTML5 Canvas 2D context.
- **Target frame rate:** 60 FPS.
- **Resolution:** Responsive. Canvas scales to fill viewport while maintaining aspect ratio. Minimum supported: 360x640 (mobile portrait). Preferred: 1280x720+.
- **Pixel ratio:** Render at `window.devicePixelRatio` for crisp lines on HiDPI displays.
- **Render loop:** `requestAnimationFrame` with delta-time for animation independence from frame rate.

### 10.2 Hexagonal Grid Math

**Coordinate System:** Axial (q, r) with flat-top orientation.

**Hex-to-pixel (flat-top):**
```
x = size * (3/2 * q)
y = size * (sqrt(3)/2 * q + sqrt(3) * r)
```

**Pixel-to-hex (for click detection):**
```
q = (2/3 * x) / size
r = (-1/3 * x + sqrt(3)/3 * y) / size
// Round to nearest hex using cube coordinate rounding
```

**Cube coordinate rounding:**
```
function cubeRound(frac_q, frac_r, frac_s):
    q = round(frac_q)
    r = round(frac_r)
    s = round(frac_s)
    q_diff = abs(q - frac_q)
    r_diff = abs(r - frac_r)
    s_diff = abs(s - frac_s)
    if q_diff > r_diff and q_diff > s_diff:
        q = -r - s
    elif r_diff > s_diff:
        r = -q - s
    else:
        s = -q - r
    return (q, r)
```

**Neighbor offsets (flat-top hex, axial):**
```
directions = [
    (+1, 0), (+1, -1), (0, -1),
    (-1, 0), (-1, +1), (0, +1)
]
```

**Hex drawing (flat-top):**
```
for i in 0..5:
    angle = 60 * i
    vertex_x = center_x + size * cos(radians(angle))
    vertex_y = center_y + size * sin(radians(angle))
```

### 10.3 Board Data Structure

```javascript
// Board represented as a Map keyed by "q,r" strings
const board = new Map();

// Cell states
const CELL_EMPTY = 0;
const CELL_STONE = -1;
const CELL_CRACKED = -2; // hp: 2, decrements on adjacent match

// Tile object
{
    color: 'red' | 'blue' | 'green' | 'yellow' | 'purple' | 'orange',
    type: 'standard' | 'wildcard' | 'bomb' | 'anchor',
    position: { q: number, r: number },
    animState: { ... }  // Current animation data
}
```

### 10.4 Match Detection Algorithm

```
function findMatches(board):
    visited = new Set()
    matches = []

    for each tile in board:
        if tile in visited: continue
        group = floodFill(board, tile.position, tile.color, visited)
        if group.length >= 3:
            matches.push(group)

    return matches

function floodFill(board, pos, color, visited):
    if pos not in board or visited.has(pos): return []
    tile = board.get(pos)
    if tile.color != color and tile.type != 'wildcard': return []

    visited.add(pos)
    group = [pos]

    for each neighbor of pos:
        group = group.concat(floodFill(board, neighbor, color, visited))

    return group
```

### 10.5 Performance Considerations

- **Object pooling** for particles — pre-allocate and recycle particle objects to avoid GC pressure during cascade animations.
- **Dirty rectangle rendering** — only redraw cells and UI regions that changed since the last frame; cache the static board background.
- **Batch draw calls** — group all hex outlines into a single path before stroking; group all fills by color.
- **Off-screen canvas** — render the static grid to an off-screen canvas once; composite onto the main canvas each frame.
- **Animation queue** — animations are queued and played sequentially (placement -> match highlight -> collapse -> settle -> next cascade). The game state only advances after the animation queue drains, but animations can be speed-scaled or skipped.

### 10.6 File Structure (Recommended)

```
littlegame/
  index.html              # Entry point, canvas element, minimal markup
  game-design.md          # This document
  src/
    main.js               # Boot, game loop, state machine
    board.js              # Hex grid data structure, match detection, settling
    hex.js                # Hex math utilities (coords, drawing, neighbors)
    gravity.js            # Gravity system, shift logic, cascade resolution
    tiles.js              # Tile types, color pool, queue management
    scoring.js            # Score calculation, multipliers, bonuses
    renderer.js           # Canvas rendering, hex drawing, UI overlay
    particles.js          # Particle system for collapse/explosion effects
    animations.js         # Animation queue, tweening, easing functions
    input.js              # Mouse/touch/keyboard input handling
    audio.js              # Audio manager, sound effects, music
    levels.js             # Level configurations (all level data)
    storage.js            # localStorage save/load
    states/
      menu.js             # Menu state
      levelSelect.js      # Level select state
      playing.js          # Main gameplay state
      paused.js           # Pause overlay state
      levelComplete.js    # Level complete state
      gameOver.js          # Game over state
  assets/
    audio/                # Sound effects and music files
    fonts/                # Custom fonts if needed
  styles/
    main.css              # Minimal CSS for canvas container and overlays
```

### 10.7 Browser Compatibility

- **Target:** Modern evergreen browsers (Chrome, Firefox, Safari, Edge — last 2 versions).
- **Required APIs:** Canvas 2D, requestAnimationFrame, localStorage, Web Audio API.
- **No external dependencies.** Pure vanilla JavaScript. No frameworks, no build tools required for development. Optional bundling for production.

---

## 11. Glossary

| Term              | Definition                                                                                     |
| ----------------- | ---------------------------------------------------------------------------------------------- |
| **Axial coords**  | A two-axis coordinate system (q, r) for addressing hexagonal cells.                            |
| **Cascade**       | A chain reaction where a collapse causes tiles to settle and form new matches.                 |
| **Cascade depth** | How many sequential match-settle cycles have occurred. Depth 1 is the initial match.           |
| **Collapse**      | The removal of a matched group of tiles from the board.                                        |
| **Flat-top hex**  | A hexagon oriented with a flat edge on top and bottom, pointed on left and right.              |
| **Gravity shift** | The event where the gravity direction rotates 60 degrees clockwise.                            |
| **Match**         | A connected group of 3+ same-color tiles (via flood-fill adjacency).                           |
| **Settle**        | The process of tiles sliding in the gravity direction until they reach a resting position.      |
| **Tile queue**    | The sequence of upcoming tiles the player will place, visible as a preview.                     |

---

## Appendix A: Balancing Notes

These values are starting points. Playtesting will determine final tuning.

- **Color distribution:** Tiles are drawn uniformly at random from the level's color pool. No weighting or pity system initially. If early levels feel too punishing, introduce a "soft pity" that biases toward colors already on the board after 5+ placements without a match.
- **Score targets:** Calibrated assuming an average player matches approximately once every 2.5 placements with occasional 2-depth cascades. Targets should be reachable by an average player within 30-50 tile placements.
- **Gravity shift frequency:** The shift interval (N) is the primary difficulty lever. Values below 3 would make the game feel chaotic rather than strategic — 3 is the floor.
- **Special tile spawn rates:** Rates are per-tile-generated probabilities. If multiple specials are active, they are rolled sequentially (wildcard check first, then bomb, then anchor). A tile can only be one type.
- **Board fullness danger zone:** When empty cells drop below 15% of total cells, the UI should begin warning the player. Below 8%, the warning intensifies.

---

*End of Game Design Document.*
