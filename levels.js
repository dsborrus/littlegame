/**
 * Hex Collapse — Level Definitions
 *
 * Each level is a self-contained data object the engine reads at load time.
 * Coordinate system: axial (q, r) with flat-top hexagons.
 * Valid cell constraint: |q| <= radius-1, |r| <= radius-1, |q+r| <= radius-1
 */

window.LEVELS = [

  // ---------------------------------------------------------------
  // Level 1 — "First Steps"
  // Teach placement, matching, and the first gravity shift.
  // ---------------------------------------------------------------
  {
    id: 1,
    name: "First Steps",
    description: "Learn the basics of hex matching. Place tiles, match colors, and watch gravity shift for the first time.",
    gridRadius: 3,
    numColors: 3,
    colors: ["#ff2255", "#2255ff", "#22ff88"],
    colorNames: ["Red", "Blue", "Green"],
    gravityShiftInterval: 8,
    targetScore: 500,
    starThresholds: [500, 800, 1200],
    maxTiles: 37,
    queuePreview: 1,
    specialTiles: [],
    specialTileChance: 0,
    preplacedTiles: [],
    obstacles: [],
    bgColor: "#0a0a2e",
    tutorial: [
      { move: 1, text: "Place a tile on any empty cell." },
      { move: 3, text: "Match 3 or more of the same color to collapse them!" },
      { move: 6, text: "Gravity is about to rotate! Watch how tiles slide." }
    ]
  },

  // ---------------------------------------------------------------
  // Level 2 — "Building Pressure"
  // A 4th color reduces accidental matches; faster gravity.
  // ---------------------------------------------------------------
  {
    id: 2,
    name: "Building Pressure",
    description: "A new color enters the mix. Gravity shifts faster — start planning ahead.",
    gridRadius: 3,
    numColors: 4,
    colors: ["#ff2255", "#2255ff", "#22ff88", "#ffdd22"],
    colorNames: ["Red", "Blue", "Green", "Yellow"],
    gravityShiftInterval: 7,
    targetScore: 1200,
    starThresholds: [1200, 2000, 3000],
    maxTiles: 37,
    queuePreview: 1,
    specialTiles: [],
    specialTileChance: 0,
    preplacedTiles: [],
    obstacles: [],
    bgColor: "#0a0a2e",
    tutorial: null
  },

  // ---------------------------------------------------------------
  // Level 3 — "Wild Card"
  // Bigger board, wildcards appear, 2-tile preview queue.
  // ---------------------------------------------------------------
  {
    id: 3,
    name: "Wild Card",
    description: "The board expands and prismatic wildcard tiles enter the fray. They match with ANY color!",
    gridRadius: 4,
    numColors: 4,
    colors: ["#ff2255", "#2255ff", "#22ff88", "#ffdd22"],
    colorNames: ["Red", "Blue", "Green", "Yellow"],
    gravityShiftInterval: 6,
    targetScore: 2500,
    starThresholds: [2500, 4000, 6000],
    maxTiles: 61,
    queuePreview: 2,
    specialTiles: ["wildcard"],
    specialTileChance: 0.10,
    specialTileWeights: { wildcard: 1.0 },
    preplacedTiles: [],
    obstacles: [],
    bgColor: "#0b0a30",
    tutorial: [
      { trigger: "firstWildcard", text: "Wildcard tiles match with ANY color! Use them to bridge gaps." }
    ]
  },

  // ---------------------------------------------------------------
  // Level 4 — "Obstacles & Explosions"
  // Stone obstacles split the board; bomb tiles blast clusters.
  // ---------------------------------------------------------------
  {
    id: 4,
    name: "Obstacles & Explosions",
    description: "Stone blocks fragment the grid. Bomb tiles blast everything in reach. Plan your chains carefully.",
    gridRadius: 4,
    numColors: 5,
    colors: ["#ff2255", "#2255ff", "#22ff88", "#ffdd22", "#aa22ff"],
    colorNames: ["Red", "Blue", "Green", "Yellow", "Purple"],
    gravityShiftInterval: 5,
    targetScore: 4000,
    starThresholds: [4000, 6500, 9000],
    maxTiles: 57,
    queuePreview: 2,
    specialTiles: ["wildcard", "bomb"],
    specialTileChance: 0.13,
    specialTileWeights: { wildcard: 0.62, bomb: 0.38 },
    preplacedTiles: [],
    obstacles: [
      // Loose diamond near center — creates channels for gravity flow
      { q: 1, r: -1, type: "stone" },
      { q: -1, r: 1, type: "stone" },
      { q: 1, r: 0,  type: "stone" },
      { q: -1, r: 0, type: "stone" }
    ],
    bgColor: "#0c0a32",
    tutorial: [
      { trigger: "firstBomb", text: "Bomb tiles explode in a 1-hex radius when matched!" },
      { trigger: "firstStone", text: "Stone blocks cannot be moved or matched. Plan around them." }
    ]
  },

  // ---------------------------------------------------------------
  // Level 5 — "Anchored Chaos"
  // Anchor tiles resist gravity; rapid shifts every 4 moves.
  // ---------------------------------------------------------------
  {
    id: 5,
    name: "Anchored Chaos",
    description: "Anchored tiles defy gravity and hold their ground. Use them as pillars in a shifting world.",
    gridRadius: 4,
    numColors: 5,
    colors: ["#ff2255", "#2255ff", "#22ff88", "#ffdd22", "#aa22ff"],
    colorNames: ["Red", "Blue", "Green", "Yellow", "Purple"],
    gravityShiftInterval: 4,
    targetScore: 6000,
    starThresholds: [6000, 9000, 13000],
    maxTiles: 58,
    queuePreview: 3,
    specialTiles: ["wildcard", "bomb", "anchor"],
    specialTileChance: 0.20,
    specialTileWeights: { wildcard: 0.40, bomb: 0.25, anchor: 0.35 },
    preplacedTiles: [],
    obstacles: [
      { q: 0, r: -2, type: "stone" },
      { q: 2, r: -1, type: "stone" },
      { q: -2, r: 1, type: "stone" }
    ],
    bgColor: "#0d0b34",
    tutorial: [
      { trigger: "firstAnchor", text: "Anchored tiles resist gravity! They stay put during shifts but still match normally." }
    ]
  },

  // ---------------------------------------------------------------
  // Level 6 — "Crumbling Fortress"
  // Largest board, cracked obstacles that break after adjacent matches.
  // ---------------------------------------------------------------
  {
    id: 6,
    name: "Crumbling Fortress",
    description: "The fortress crumbles around you. Break through cracked walls to open new paths before the board fills.",
    gridRadius: 5,
    numColors: 5,
    colors: ["#ff2255", "#2255ff", "#22ff88", "#ffdd22", "#aa22ff"],
    colorNames: ["Red", "Blue", "Green", "Yellow", "Purple"],
    gravityShiftInterval: 4,
    targetScore: 9000,
    starThresholds: [9000, 14000, 20000],
    maxTiles: 81,
    queuePreview: 3,
    specialTiles: ["wildcard", "bomb", "anchor"],
    specialTileChance: 0.16,
    specialTileWeights: { wildcard: 0.375, bomb: 0.3125, anchor: 0.3125 },
    preplacedTiles: [],
    obstacles: [
      // 6 stone cells — outer ring barricade
      { q: 2, r: -3, type: "stone" },
      { q: -2, r: 3, type: "stone" },
      { q: 3, r: -2, type: "stone" },
      { q: -3, r: 2, type: "stone" },
      { q: 0, r: -3, type: "stone" },
      { q: 0, r: 3,  type: "stone" },
      // 4 cracked cells — inner ring (breakable walls)
      { q: 1, r: -1, type: "cracked", hp: 2 },
      { q: -1, r: 1, type: "cracked", hp: 2 },
      { q: 1, r: 0,  type: "cracked", hp: 2 },
      { q: -1, r: 0, type: "cracked", hp: 2 }
    ],
    bgColor: "#0e0c36",
    tutorial: [
      { trigger: "firstCracked", text: "Cracked blocks break after 2 adjacent matches. Clear them to open the board!" }
    ]
  },

  // ---------------------------------------------------------------
  // Level 7 — "Gravity Storm"
  // Maximum difficulty: 6 colors, shift every 3, dense obstacles.
  // ---------------------------------------------------------------
  {
    id: 7,
    name: "Gravity Storm",
    description: "Six colors. Gravity every three moves. Stone and cracked walls everywhere. Only masters survive the storm.",
    gridRadius: 5,
    numColors: 6,
    colors: ["#ff2255", "#2255ff", "#22ff88", "#ffdd22", "#aa22ff", "#ff8822"],
    colorNames: ["Red", "Blue", "Green", "Yellow", "Purple", "Orange"],
    gravityShiftInterval: 3,
    targetScore: 15000,
    starThresholds: [15000, 22000, 30000],
    maxTiles: 77,
    queuePreview: 3,
    specialTiles: ["wildcard", "bomb", "anchor"],
    specialTileChance: 0.15,
    specialTileWeights: { wildcard: 0.33, bomb: 0.33, anchor: 0.34 },
    preplacedTiles: [
      // A few tiles already on the board to add immediate pressure
      { q: 0, r: 0,  color: "#ff2255", type: "standard" },
      { q: 1, r: -1, color: "#2255ff", type: "standard" },
      { q: -1, r: 1, color: "#22ff88", type: "standard" },
      { q: 0, r: 1,  color: "#ffdd22", type: "standard" },
      { q: 0, r: -1, color: "#aa22ff", type: "standard" },
      { q: -1, r: 0, color: "#ff8822", type: "standard" }
    ],
    obstacles: [
      // 8 stone cells — scattered fortress walls
      { q: 2, r: -4, type: "stone" },
      { q: -2, r: 4, type: "stone" },
      { q: 4, r: -2, type: "stone" },
      { q: -4, r: 2, type: "stone" },
      { q: 3, r: 0,  type: "stone" },
      { q: -3, r: 0, type: "stone" },
      { q: 0, r: 3,  type: "stone" },
      { q: 0, r: -3, type: "stone" },
      // 6 cracked cells — breakable inner walls
      { q: 1, r: -2, type: "cracked", hp: 2 },
      { q: -1, r: 2, type: "cracked", hp: 2 },
      { q: 2, r: -1, type: "cracked", hp: 2 },
      { q: -2, r: 1, type: "cracked", hp: 2 },
      { q: 1, r: 1,  type: "cracked", hp: 2 },
      { q: -1, r: -1, type: "cracked", hp: 2 }
    ],
    bgColor: "#100e3a",
    tutorial: null
  }

];
