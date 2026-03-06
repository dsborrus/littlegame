# Hex Collapse - Project Summary

## The Game
**Hex Collapse** is a strategic puzzle game where you place colored tiles on a hexagonal grid to form chains of 3+ matching colors. The twist: gravity rotates 60 degrees every few moves, causing all tiles to slide and cascade in unexpected directions. Plan ahead for where tiles will end up after the next gravity shift.

## Live Demo
- **Vercel**: https://littlegame-ivory.vercel.app
- **GitHub**: https://github.com/dsborrus/littlegame

## How to Run Locally
Open `index.html` in Chrome (or any modern browser). No server needed, no build step, no dependencies.

## Controls
| Input | Action |
|-------|--------|
| **Click** empty hex cell | Place current tile |
| **Hover** over hex cell | Preview tile placement |
| **Space** | Pause / Resume |
| **R** | Restart current level |
| **Escape** | Pause / Return to menu |
| **N** | Next level (on level complete screen) |

## Game Mechanics
- **Match 3+**: Connect 3 or more same-colored tiles to collapse them for points
- **Gravity Shifts**: Every N moves, gravity rotates 60 degrees -- all tiles slide to a new direction
- **Cascades**: Gravity shifts can trigger chain reactions for bonus points
- **Special Tiles**: Wildcards (match any color), Bombs (explode area), Anchors (resist gravity), Cracked blocks (break after hits)
- **7 Levels**: Progressive difficulty with more colors, faster shifts, obstacles, and special tiles

## Scoring
- Base: 100 points per 3-match, scaling up for larger groups
- Cascade multiplier: x1.5 to x4.0 for chain reactions
- Gravity combo bonus: Extra points for matches triggered by gravity shifts
- Star rating: 1-3 stars per level based on score thresholds

## Files
| File | Purpose |
|------|---------|
| `index.html` | Main page, all screen overlays, script loading |
| `styles.css` | Dark neon theme, responsive layout, animations |
| `entities.js` | HexGrid, Tile, ParticleSystem, GravitySystem classes |
| `levels.js` | 7 level definitions with progressive difficulty |
| `renderer.js` | HTML Canvas rendering (hex drawing, effects, particles) |
| `audio.js` | Web Audio API procedural sound effects |
| `game.js` | Main loop, state machine, input, game logic |
| `game-design.md` | Full game design document |
| `BUGS.md` | QA report -- bugs found and fixed |

## Tech Stack
- Vanilla JavaScript (no frameworks, no bundlers)
- HTML5 Canvas for rendering
- Web Audio API for sound effects
- CSS3 for UI overlays and animations
- Deployed on Vercel, hosted on GitHub
