import { PowerUpDefinition } from './PowerUpTypes';

export const SWORD_POWERUPS: PowerUpDefinition[] = [
  {
    id: 'vorpal-dash',
    name: 'Vorpal Dash',
    category: 'sword',
    icon: '⚡',
    tagline: 'Phasing Blade Rush',
    description: 'Dash travels 50% further, passes through foes, and leaves a slicing shadow trail.',
    color: '#9d4edd'
  },
  {
    id: 'sword-beam',
    name: 'Sword Beam',
    category: 'sword',
    icon: '✨',
    tagline: 'Arcane Blade Wave',
    description: 'Every sword slash fires a flying crescent energy wave across the arena.',
    color: '#00b4d8'
  },
  {
    id: 'aegis-mastery',
    name: 'Aegis Mastery',
    category: 'sword',
    icon: '🛡️',
    tagline: 'Absolute Deflection',
    description: 'Parry active window is +60% longer; reflected arrows travel at 2x speed with blast force.',
    color: '#ffd166'
  },
  {
    id: 'cyclone-whirlwind',
    name: 'Cyclone Blade',
    category: 'sword',
    icon: '🌀',
    tagline: 'Vortex Cleave',
    description: 'Sword slashes whip up a swirling vacuum vortex that pulls nearby foes inward.',
    color: '#06d6a0'
  },
  {
    id: 'vampiric-edge',
    name: 'Vampiric Edge',
    category: 'sword',
    icon: '🩸',
    tagline: 'Essence Drain',
    description: 'Striking a foe grants a burst of speed and a 50% chance to restore a lost heart.',
    color: '#e63946'
  },
  {
    id: 'titan-cleaver',
    name: 'Titan Cleaver',
    category: 'sword',
    icon: '🗡️',
    tagline: 'Colossal Reach',
    description: 'Sword size and reach +70%, deals 2x knockback, and smashes through parries.',
    color: '#f77f00'
  },
  {
    id: 'blink-strike',
    name: 'Blink Strike',
    category: 'sword',
    icon: '👁️',
    tagline: 'Instant Flash Step',
    description: 'Striking while dashing or in air teleports you directly behind the nearest opponent.',
    color: '#7209b7'
  },
  {
    id: 'flame-brand',
    name: 'Flame Brand',
    category: 'sword',
    icon: '🔥',
    tagline: 'Inferno Slashes',
    description: 'Sword slashes ignite ground platforms, leaving lingering flame patches that scorch foes.',
    color: '#ff5400'
  },
  {
    id: 'thunder-rapier',
    name: 'Thunder Rapier',
    category: 'sword',
    icon: '⚡',
    tagline: 'Storm Wrath',
    description: 'Landing a sword strike summons a lightning bolt strike from the heavens.',
    color: '#4cc9f0'
  },
  {
    id: 'blade-flurry',
    name: 'Blade Flurry',
    category: 'sword',
    icon: '⚔️',
    tagline: 'Rapid Flurry',
    description: 'Attack cooldown reduced by 50%, enabling blistering high-speed flurry combos.',
    color: '#f72585'
  }
];

export const BOW_POWERUPS: PowerUpDefinition[] = [
  {
    id: 'triple-volley',
    name: 'Triple Volley',
    category: 'bow',
    icon: '🏹',
    tagline: 'Fan Spread',
    description: 'Bows fire 3 arrows simultaneously in a lethal spread pattern.',
    color: '#00f5d4'
  },
  {
    id: 'seeker-arrows',
    name: 'Seeker Arrows',
    category: 'bow',
    icon: '🦅',
    tagline: 'Homing Guidance',
    description: 'Arrows gracefully curve in mid-air toward the nearest opponent.',
    color: '#70e4ef'
  },
  {
    id: 'explosive-payload',
    name: 'Explosive Payload',
    category: 'bow',
    icon: '💣',
    tagline: 'Blast Arrows',
    description: 'Arrows explode upon impact with terrain or players, dealing AOE blast knockback.',
    color: '#ff4d6d'
  },
  {
    id: 'railgun-piercer',
    name: 'Railgun Piercer',
    category: 'bow',
    icon: '⚡',
    tagline: 'Hyper Velocity',
    description: 'Fully charged arrows ignore gravity, travel at hyper speed, and pierce platforms.',
    color: '#fee440'
  },
  {
    id: 'ricochet-trickshot',
    name: 'Ricochet Trickshot',
    category: 'bow',
    icon: '🎯',
    tagline: 'Bouncing Steel',
    description: 'Arrows bounce up to 3 times off solid surfaces, accelerating with each ricochet.',
    color: '#f15bb5'
  },
  {
    id: 'frostbite-quiver',
    name: 'Frostbite Quiver',
    category: 'bow',
    icon: '❄️',
    tagline: 'Glacial Chill',
    description: 'Arrows freeze opponents in ice blocks and leave slippery frost on platforms.',
    color: '#a0c4ff'
  },
  {
    id: 'grapple-arrow',
    name: 'Grapple Arrow',
    category: 'bow',
    icon: '🪝',
    tagline: 'Harpoon Tether',
    description: 'Arrows embed in walls and rapidly pull the archer toward the impact point.',
    color: '#52b788'
  },
  {
    id: 'skyfall-barrage',
    name: 'Skyfall Barrage',
    category: 'bow',
    icon: '🌧️',
    tagline: 'Arrow Rain',
    description: 'Shooting skyward summons a rain of 5 deadly arrows over the battlefield.',
    color: '#4361ee'
  },
  {
    id: 'infinite-quiver',
    name: 'Infinite Quiver',
    category: 'bow',
    icon: '♾️',
    tagline: 'Bottomless Arrows',
    description: 'Never run out of arrows and draw charging speed is increased by 50%.',
    color: '#b5179e'
  },
  {
    id: 'split-shrapnel',
    name: 'Split Shrapnel',
    category: 'bow',
    icon: '💥',
    tagline: 'Cluster Detonation',
    description: 'Arrows fragment into 3 sharp shrapnel shards upon hitting walls or foes.',
    color: '#ff9e00'
  }
];

export const ALL_POWERUPS: PowerUpDefinition[] = [
  ...SWORD_POWERUPS,
  ...BOW_POWERUPS
];

export function getPowerUpById(id: string): PowerUpDefinition | undefined {
  return ALL_POWERUPS.find(p => p.id === id);
}

export function drawRandomPowerUps(count: number = 3, excludeIds: string[] = []): PowerUpDefinition[] {
  const available = ALL_POWERUPS.filter(p => !excludeIds.includes(p.id));
  const pool = available.length >= count ? available : ALL_POWERUPS;
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}
