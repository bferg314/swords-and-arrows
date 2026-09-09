import { ArenaMap } from './MapTypes';

export const ARENA_MAPS: ArenaMap[] = [
  // 1. The Royal Courtyard (Balanced, classic)
  {
    id: 'royal-courtyard',
    name: 'The Royal Courtyard',
    theme: 'Castle Battlements',
    hazardDescription: 'Balanced terrain with wooden drop-through platforms and royal arches.',
    icon: '🏰',
    bgColor: '#0f172a',
    bgGradient: ['#1e293b', '#0b1120'],
    ambientType: 'dust',
    spawnPoints: [
      { x: 220, y: 550 },
      { x: 1060, y: 550 },
      { x: 440, y: 360 },
      { x: 840, y: 360 }
    ],
    hazards: [],
    platforms: [
      // Main ground
      { x: 100, y: 640, w: 1080, h: 60, color: '#334155', borderColor: '#64748b' },
      // Left and right stone bastions
      { x: 100, y: 460, w: 220, h: 30, color: '#475569', borderColor: '#94a3b8' },
      { x: 960, y: 460, w: 220, h: 30, color: '#475569', borderColor: '#94a3b8' },
      // Center multi-tier wooden drop-through platforms
      { x: 400, y: 510, w: 480, h: 16, oneWay: true, color: '#92400e', borderColor: '#d97706' },
      { x: 480, y: 360, w: 320, h: 16, oneWay: true, color: '#92400e', borderColor: '#d97706' },
      { x: 560, y: 220, w: 160, h: 16, oneWay: true, color: '#92400e', borderColor: '#ffd166' }
    ]
  },

  // 2. Molten Caverns (Lava Pit hazard)
  {
    id: 'molten-caverns',
    name: 'Molten Caverns',
    theme: 'Volcanic Caldera',
    hazardDescription: 'Lethal magma pool at the abyss floor; basalt islands and hanging chains.',
    icon: '🌋',
    bgColor: '#1c0a00',
    bgGradient: ['#38040e', '#100003'],
    ambientType: 'embers',
    spawnPoints: [
      { x: 200, y: 480 },
      { x: 1080, y: 480 },
      { x: 480, y: 320 },
      { x: 800, y: 320 }
    ],
    hazards: [
      { x: 0, y: 660, w: 1280, h: 60, damage: 1, type: 'lava', active: true }
    ],
    platforms: [
      // Left & Right high basalt bluffs
      { x: 80, y: 540, w: 260, h: 40, color: '#2b2d42', borderColor: '#ff5400' },
      { x: 940, y: 540, w: 260, h: 40, color: '#2b2d42', borderColor: '#ff5400' },
      // Central stepping stones
      { x: 420, y: 570, w: 160, h: 25, color: '#1a1c29', borderColor: '#d90429' },
      { x: 700, y: 570, w: 160, h: 25, color: '#1a1c29', borderColor: '#d90429' },
      // Upper suspended platforms
      { x: 440, y: 380, w: 400, h: 16, oneWay: true, color: '#592941', borderColor: '#ff758f' },
      { x: 300, y: 240, w: 200, h: 16, oneWay: true, color: '#592941', borderColor: '#ff758f' },
      { x: 780, y: 240, w: 200, h: 16, oneWay: true, color: '#592941', borderColor: '#ff758f' }
    ]
  },

  // 3. Celestial Citadel (Bouncy clouds, low gravity)
  {
    id: 'celestial-citadel',
    name: 'Celestial Citadel',
    theme: 'Floating Isles',
    hazardDescription: 'Low gravity arena with bouncy cloud pads that propel warriors skyward.',
    icon: '☁️',
    bgColor: '#03045e',
    bgGradient: ['#0077b6', '#023e8a'],
    ambientType: 'clouds',
    gravityScale: 0.78,
    spawnPoints: [
      { x: 250, y: 440 },
      { x: 1030, y: 440 },
      { x: 640, y: 240 },
      { x: 640, y: 500 }
    ],
    hazards: [],
    platforms: [
      // Central floating marble island
      { x: 440, y: 580, w: 400, h: 35, color: '#edf2f4', borderColor: '#8ecae6' },
      // Cloud bouncy jump pads
      { x: 160, y: 500, w: 200, h: 25, bouncy: 1.6, color: '#e0fbfc', borderColor: '#00b4d8' },
      { x: 920, y: 500, w: 200, h: 25, bouncy: 1.6, color: '#e0fbfc', borderColor: '#00b4d8' },
      // High floating cloud rings
      { x: 320, y: 320, w: 220, h: 18, oneWay: true, color: '#caf0f8', borderColor: '#90e0ef' },
      { x: 740, y: 320, w: 220, h: 18, oneWay: true, color: '#caf0f8', borderColor: '#90e0ef' },
      { x: 520, y: 160, w: 240, h: 18, bouncy: 1.4, oneWay: true, color: '#e0fbfc', borderColor: '#0077b6' }
    ]
  },

  // 4. Sunken Ruins (Water physics)
  {
    id: 'sunken-ruins',
    name: 'Sunken Ruins',
    theme: 'Submerged Atlantis',
    hazardDescription: 'Flooded lower basin with water drag and swimming buoyancy.',
    icon: '🌊',
    bgColor: '#001219',
    bgGradient: ['#005f73', '#0a9396'],
    ambientType: 'water',
    spawnPoints: [
      { x: 220, y: 360 },
      { x: 1060, y: 360 },
      { x: 440, y: 200 },
      { x: 840, y: 200 }
    ],
    hazards: [],
    platforms: [
      // Submerged base
      { x: 100, y: 640, w: 1080, h: 60, water: true, color: '#005f73', borderColor: '#94d2bd' },
      // Ancient mossy tiers
      { x: 140, y: 440, w: 260, h: 30, color: '#2b303a', borderColor: '#0a9396' },
      { x: 880, y: 440, w: 260, h: 30, color: '#2b303a', borderColor: '#0a9396' },
      // Center sunken arch
      { x: 480, y: 510, w: 320, h: 25, color: '#132a13', borderColor: '#52b788' },
      { x: 380, y: 320, w: 220, h: 16, oneWay: true, color: '#31572c', borderColor: '#90a955' },
      { x: 680, y: 320, w: 220, h: 16, oneWay: true, color: '#31572c', borderColor: '#90a955' }
    ]
  },

  // 5. Clockwork Spire (Rotating gear aesthetics & steam pads)
  {
    id: 'clockwork-spire',
    name: 'Clockwork Spire',
    theme: 'Steampunk Machinery',
    hazardDescription: 'Piston platforms and pressurized steam vents launching fighters skyward.',
    icon: '⚙️',
    bgColor: '#1a0e05',
    bgGradient: ['#3d2613', '#160c03'],
    ambientType: 'sparks',
    spawnPoints: [
      { x: 240, y: 540 },
      { x: 1040, y: 540 },
      { x: 460, y: 300 },
      { x: 820, y: 300 }
    ],
    hazards: [],
    platforms: [
      // Base brass floor
      { x: 120, y: 640, w: 1040, h: 50, color: '#583101', borderColor: '#bc6c25' },
      // Steam vent launchers
      { x: 180, y: 620, w: 100, h: 20, bouncy: 1.7, color: '#ffb703', borderColor: '#fff' },
      { x: 1000, y: 620, w: 100, h: 20, bouncy: 1.7, color: '#ffb703', borderColor: '#fff' },
      // Cog platforms
      { x: 360, y: 480, w: 240, h: 24, oneWay: true, color: '#7f4f24', borderColor: '#dda15e' },
      { x: 680, y: 480, w: 240, h: 24, oneWay: true, color: '#7f4f24', borderColor: '#dda15e' },
      { x: 500, y: 320, w: 280, h: 24, oneWay: true, color: '#936639', borderColor: '#bc6c25' },
      { x: 560, y: 160, w: 160, h: 20, oneWay: true, color: '#a68a56', borderColor: '#ffe6a7' }
    ]
  },

  // 6. Neon Cyber-Dojo (Speed boosters & laser gates)
  {
    id: 'neon-cyber-dojo',
    name: 'Neon Cyber-Dojo',
    theme: 'Synthwave Matrix',
    hazardDescription: 'High-speed directional booster pads and pulsating neon barrier lines.',
    icon: '⚡',
    bgColor: '#0d0221',
    bgGradient: ['#240046', '#0f051d'],
    ambientType: 'sparks',
    spawnPoints: [
      { x: 200, y: 540 },
      { x: 1080, y: 540 },
      { x: 640, y: 320 },
      { x: 640, y: 160 }
    ],
    hazards: [
      { x: 620, y: 450, w: 40, h: 100, damage: 1, type: 'laser', active: true }
    ],
    platforms: [
      // Bottom neon floor with speed pads
      { x: 100, y: 640, w: 1080, h: 40, color: '#190028', borderColor: '#7209b7' },
      { x: 220, y: 630, w: 140, h: 10, speedBoost: 320, color: '#00f5d4', borderColor: '#fff' },
      { x: 920, y: 630, w: 140, h: 10, speedBoost: -320, color: '#f72585', borderColor: '#fff' },
      // Elevated neon catwalks
      { x: 160, y: 450, w: 260, h: 18, oneWay: true, color: '#3a0ca3', borderColor: '#4cc9f0' },
      { x: 860, y: 450, w: 260, h: 18, oneWay: true, color: '#3a0ca3', borderColor: '#4cc9f0' },
      { x: 440, y: 260, w: 400, h: 18, oneWay: true, color: '#480ca8', borderColor: '#f72585' }
    ]
  },

  // 7. Frostpeak Summit (Slippery ice)
  {
    id: 'frostpeak-summit',
    name: 'Frostpeak Summit',
    theme: 'Glacial Mountain',
    hazardDescription: 'Zero-friction slippery ice ledges and treacherous abyss.',
    icon: '❄️',
    bgColor: '#03045e',
    bgGradient: ['#0077b6', '#023e8a'],
    ambientType: 'snow',
    spawnPoints: [
      { x: 220, y: 460 },
      { x: 1060, y: 460 },
      { x: 420, y: 320 },
      { x: 860, y: 320 }
    ],
    hazards: [],
    platforms: [
      // Slippery ice floes
      { x: 100, y: 640, w: 380, h: 50, slippery: true, color: '#90e0ef', borderColor: '#caf0f8' },
      { x: 800, y: 640, w: 380, h: 50, slippery: true, color: '#90e0ef', borderColor: '#caf0f8' },
      // Central floating ice block
      { x: 500, y: 540, w: 280, h: 30, slippery: true, color: '#ade8f4', borderColor: '#ffffff' },
      // High icy ledges
      { x: 240, y: 360, w: 260, h: 18, slippery: true, oneWay: true, color: '#caf0f8', borderColor: '#00b4d8' },
      { x: 780, y: 360, w: 260, h: 18, slippery: true, oneWay: true, color: '#caf0f8', borderColor: '#00b4d8' },
      { x: 480, y: 200, w: 320, h: 18, slippery: true, oneWay: true, color: '#e0fbfc', borderColor: '#ffffff' }
    ]
  },

  // 8. Haunted Crypt (Crumbling phantom blocks)
  {
    id: 'haunted-crypt',
    name: 'Haunted Crypt',
    theme: 'Gothic Catacombs',
    hazardDescription: 'Floor spikes and phantom stones that dissolve when stepped upon.',
    icon: '👻',
    bgColor: '#08090a',
    bgGradient: ['#161a1d', '#0b090a'],
    ambientType: 'ghosts',
    spawnPoints: [
      { x: 200, y: 440 },
      { x: 1080, y: 440 },
      { x: 420, y: 280 },
      { x: 860, y: 280 }
    ],
    hazards: [
      { x: 420, y: 640, w: 440, h: 30, damage: 1, type: 'spikes', active: true }
    ],
    platforms: [
      // Safe stone bastions
      { x: 80, y: 620, w: 320, h: 60, color: '#2b2d42', borderColor: '#660708' },
      { x: 880, y: 620, w: 320, h: 60, color: '#2b2d42', borderColor: '#660708' },
      // Crumbling central bridges
      { x: 440, y: 500, w: 180, h: 20, crumble: true, crumbleState: 'solid', crumbleTimer: 0, color: '#4a0e17', borderColor: '#a4161a' },
      { x: 660, y: 500, w: 180, h: 20, crumble: true, crumbleState: 'solid', crumbleTimer: 0, color: '#4a0e17', borderColor: '#a4161a' },
      // Upper tombs (easily accessible from bastions & crumbling blocks)
      { x: 260, y: 360, w: 240, h: 18, oneWay: true, color: '#343a40', borderColor: '#ba181b' },
      { x: 780, y: 360, w: 240, h: 18, oneWay: true, color: '#343a40', borderColor: '#ba181b' },
      { x: 500, y: 220, w: 280, h: 18, crumble: true, crumbleState: 'solid', crumbleTimer: 0, color: '#a4161a', borderColor: '#e5383b' }
    ]
  },

  // 9. Sky Pirate Galleon (Rocking ship, crow's nests)
  {
    id: 'sky-pirate-galleon',
    name: 'Sky Pirate Galleon',
    theme: 'Airship Skyship',
    hazardDescription: 'Elevated crow nests, wooden hull decks, and open airspace drop.',
    icon: '🏴‍☠️',
    bgColor: '#1b263b',
    bgGradient: ['#415a77', '#0d1b2a'],
    ambientType: 'dust',
    spawnPoints: [
      { x: 260, y: 500 },
      { x: 1020, y: 500 },
      { x: 400, y: 260 },
      { x: 880, y: 260 }
    ],
    hazards: [],
    platforms: [
      // Main wooden deck
      { x: 180, y: 600, w: 920, h: 60, color: '#78350f', borderColor: '#b45309' },
      // Forecastle & quarterdeck
      { x: 120, y: 500, w: 180, h: 40, color: '#92400e', borderColor: '#d97706' },
      { x: 980, y: 500, w: 180, h: 40, color: '#92400e', borderColor: '#d97706' },
      // Main masts and crow's nests
      { x: 340, y: 340, w: 220, h: 18, oneWay: true, color: '#b45309', borderColor: '#fcd34d' },
      { x: 720, y: 340, w: 220, h: 18, oneWay: true, color: '#b45309', borderColor: '#fcd34d' },
      { x: 520, y: 180, w: 240, h: 18, oneWay: true, color: '#d97706', borderColor: '#fef08a' }
    ]
  },

  // 10. Toxic Catacombs (Acid floor, Left-to-Right Warp screen wrap!)
  {
    id: 'toxic-catacombs',
    name: 'Toxic Catacombs',
    theme: 'Industrial Sewers',
    hazardDescription: 'Corrosive green sludge basin with left-to-right infinite warp pipes!',
    icon: '🧪',
    bgColor: '#0d1f12',
    bgGradient: ['#1b4332', '#081c15'],
    ambientType: 'dust',
    hasScreenWrap: true,
    spawnPoints: [
      { x: 220, y: 480 },
      { x: 1060, y: 480 },
      { x: 440, y: 300 },
      { x: 840, y: 300 }
    ],
    hazards: [
      { x: 0, y: 670, w: 1280, h: 50, damage: 1, type: 'acid', active: true }
    ],
    platforms: [
      // Left & Right pipe ledges
      { x: 60, y: 540, w: 280, h: 35, color: '#2d6a4f', borderColor: '#52b788' },
      { x: 940, y: 540, w: 280, h: 35, color: '#2d6a4f', borderColor: '#52b788' },
      // Central sewer grating
      { x: 460, y: 560, w: 360, h: 20, oneWay: true, color: '#40916c', borderColor: '#74c69d' },
      // Upper slime pipes
      { x: 300, y: 380, w: 240, h: 18, oneWay: true, color: '#1b4332', borderColor: '#95d5b2' },
      { x: 740, y: 380, w: 240, h: 18, oneWay: true, color: '#1b4332', borderColor: '#95d5b2' },
      { x: 500, y: 220, w: 280, h: 18, oneWay: true, color: '#2d6a4f', borderColor: '#b7e4c7' }
    ]
  },

  // 11. Desert Tomb of the Pharaoh (Sand dunes, collapsing blocks)
  {
    id: 'desert-tomb',
    name: 'Desert Tomb',
    theme: 'Ancient Egyptian Pyramid',
    hazardDescription: 'Collapsing sandstone slabs and ancient golden hieroglyphs.',
    icon: '🏺',
    bgColor: '#1c1303',
    bgGradient: ['#432818', '#1a0f00'],
    ambientType: 'dust',
    spawnPoints: [
      { x: 220, y: 540 },
      { x: 1060, y: 540 },
      { x: 420, y: 360 },
      { x: 860, y: 360 }
    ],
    hazards: [],
    platforms: [
      // Base sandstone floor
      { x: 100, y: 640, w: 1080, h: 50, color: '#7f5539', borderColor: '#b08968' },
      // Stepped pyramid platforms
      { x: 200, y: 490, w: 220, h: 25, color: '#9c6644', borderColor: '#ddb892' },
      { x: 860, y: 490, w: 220, h: 25, color: '#9c6644', borderColor: '#ddb892' },
      { x: 360, y: 360, w: 200, h: 20, crumble: true, crumbleState: 'solid', crumbleTimer: 0, color: '#b08968', borderColor: '#e6ccb2' },
      { x: 720, y: 360, w: 200, h: 20, crumble: true, crumbleState: 'solid', crumbleTimer: 0, color: '#b08968', borderColor: '#e6ccb2' },
      { x: 480, y: 220, w: 320, h: 20, oneWay: true, color: '#ddb892', borderColor: '#ffd166' }
    ]
  },

  // 12. Crystalline Sanctuary (Reflective crystal walls)
  {
    id: 'crystalline-sanctuary',
    name: 'Crystalline Sanctuary',
    theme: 'Prismatic Geode',
    hazardDescription: 'Polished crystal prisms that naturally deflect regular arrow shots!',
    icon: '💎',
    bgColor: '#0b001a',
    bgGradient: ['#2e0854', '#0d001a'],
    ambientType: 'crystals',
    spawnPoints: [
      { x: 220, y: 520 },
      { x: 1060, y: 520 },
      { x: 640, y: 320 },
      { x: 640, y: 160 }
    ],
    hazards: [],
    platforms: [
      // Crystal floor
      { x: 120, y: 640, w: 1040, h: 50, color: '#3c096c', borderColor: '#c77dff' },
      // Side reflection towers
      { x: 140, y: 450, w: 220, h: 30, color: '#5a189a', borderColor: '#e0aaff' },
      { x: 920, y: 450, w: 220, h: 30, color: '#5a189a', borderColor: '#e0aaff' },
      // Floating crystal clusters
      { x: 400, y: 480, w: 180, h: 20, bouncy: 1.4, oneWay: true, color: '#7b2cbf', borderColor: '#f72585' },
      { x: 700, y: 480, w: 180, h: 20, bouncy: 1.4, oneWay: true, color: '#7b2cbf', borderColor: '#f72585' },
      { x: 460, y: 280, w: 360, h: 20, oneWay: true, color: '#9d4edd', borderColor: '#70e4ef' },
      { x: 560, y: 140, w: 160, h: 18, bouncy: 1.5, oneWay: true, color: '#c77dff', borderColor: '#ffffff' }
    ]
  },

  // 13. Verdant Canopy (Giant bounce-cap mushrooms, mossy limbs)
  {
    id: 'verdant-canopy',
    name: 'Verdant Canopy',
    theme: 'Primeval Redwood',
    hazardDescription: 'Giant bounce-cap mushrooms propel warriors into high mossy canopy branches.',
    icon: '🍄',
    bgColor: '#051a0e',
    bgGradient: ['#0d381e', '#031207'],
    ambientType: 'dust',
    spawnPoints: [
      { x: 220, y: 550 },
      { x: 1060, y: 550 },
      { x: 380, y: 380 },
      { x: 900, y: 380 }
    ],
    hazards: [],
    platforms: [
      // Base forest floor
      { x: 100, y: 640, w: 1080, h: 50, color: '#142816', borderColor: '#2d6a4f' },
      // Left & Right bounce-cap mushrooms
      { x: 180, y: 520, w: 180, h: 25, bouncy: 1.6, color: '#d90429', borderColor: '#ff4d6d' },
      { x: 920, y: 520, w: 180, h: 25, bouncy: 1.6, color: '#d90429', borderColor: '#ff4d6d' },
      // Central mossy log
      { x: 440, y: 480, w: 400, h: 20, oneWay: true, color: '#2d6a4f', borderColor: '#52b788' },
      // Mid canopy branches
      { x: 240, y: 340, w: 240, h: 18, oneWay: true, color: '#40916c', borderColor: '#74c69d' },
      { x: 800, y: 340, w: 240, h: 18, oneWay: true, color: '#40916c', borderColor: '#74c69d' },
      // High crown perch
      { x: 500, y: 190, w: 280, h: 20, oneWay: true, bouncy: 1.3, color: '#52b788', borderColor: '#d8f3dc' }
    ]
  },

  // 14. Stormspire Apex (High-voltage lightning conductors)
  {
    id: 'stormspire-apex',
    name: 'Stormspire Apex',
    theme: 'Electrified Mountain Pinnacle',
    hazardDescription: 'High-voltage lightning conductors and supercharged jump grids atop the tempest.',
    icon: '⚡',
    bgColor: '#080c24',
    bgGradient: ['#1e1b4b', '#03071e'],
    ambientType: 'sparks',
    spawnPoints: [
      { x: 220, y: 490 },
      { x: 1060, y: 490 },
      { x: 420, y: 340 },
      { x: 860, y: 340 }
    ],
    hazards: [],
    platforms: [
      // Left & Right Storm Towers
      { x: 80, y: 560, w: 260, h: 40, color: '#1e1e38', borderColor: '#4361ee' },
      { x: 940, y: 560, w: 260, h: 40, color: '#1e1e38', borderColor: '#4361ee' },
      // Center Generator Conductor
      { x: 420, y: 580, w: 440, h: 30, bouncy: 1.35, color: '#2b2d42', borderColor: '#ffd166' },
      // Mid Lightning Rods
      { x: 260, y: 400, w: 220, h: 18, oneWay: true, color: '#3a0ca3', borderColor: '#4cc9f0' },
      { x: 800, y: 400, w: 220, h: 18, oneWay: true, color: '#3a0ca3', borderColor: '#4cc9f0' },
      // High Tesla Coil
      { x: 460, y: 240, w: 360, h: 20, oneWay: true, bouncy: 1.4, color: '#4361ee', borderColor: '#4cc9f0' },
      // Apex Spire
      { x: 560, y: 120, w: 160, h: 16, oneWay: true, color: '#7209b7', borderColor: '#ffd166' }
    ]
  },

  // 15. Astral Void (Cosmic rift nexus, low gravity)
  {
    id: 'astral-void',
    name: 'Astral Void',
    theme: 'Cosmic Rift Nexus',
    hazardDescription: 'Float through a cosmic dimensional rift with low gravity and anti-matter obelisks.',
    icon: '🌌',
    bgColor: '#050014',
    bgGradient: ['#190040', '#020008'],
    ambientType: 'clouds',
    gravityScale: 0.75,
    spawnPoints: [
      { x: 230, y: 430 },
      { x: 1050, y: 430 },
      { x: 530, y: 510 },
      { x: 750, y: 510 }
    ],
    hazards: [],
    platforms: [
      // Central Astral Nexus
      { x: 420, y: 590, w: 440, h: 35, color: '#1f103b', borderColor: '#8338ec' },
      // Side Starlight Steps (Solid floating bastions)
      { x: 100, y: 510, w: 260, h: 30, color: '#2b1055', borderColor: '#3a86ff' },
      { x: 920, y: 510, w: 260, h: 30, color: '#2b1055', borderColor: '#3a86ff' },
      // Dimensional Shards
      { x: 300, y: 340, w: 200, h: 18, bouncy: 1.4, oneWay: true, color: '#3a0ca3', borderColor: '#f72585' },
      { x: 780, y: 340, w: 200, h: 18, bouncy: 1.4, oneWay: true, color: '#3a0ca3', borderColor: '#f72585' },
      // Celestial Crown
      { x: 480, y: 190, w: 320, h: 20, oneWay: true, bouncy: 1.3, color: '#7209b7', borderColor: '#00f5d4' }
    ]
  }
];

export function getMapById(id: string): ArenaMap | undefined {
  return ARENA_MAPS.find(m => m.id === id);
}

export function getRandomMap(): ArenaMap {
  const index = Math.floor(Math.random() * ARENA_MAPS.length);
  return ARENA_MAPS[index];
}
