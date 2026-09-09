export interface Platform {
  x: number;
  y: number;
  w: number;
  h: number;
  oneWay?: boolean; // Can jump up through or drop down through with Down + Jump
  bouncy?: number; // Bounce multiplier (e.g. 1.6)
  slippery?: boolean; // Ice physics
  hazard?: boolean; // Deals damage if touched
  crumble?: boolean; // Vanishes after being stepped on
  crumbleTimer?: number;
  crumbleState?: 'solid' | 'shaking' | 'vanished';
  warpLeft?: boolean; // Portal pipe
  warpRight?: boolean;
  speedBoost?: number; // Horizontal booster speed
  water?: boolean; // Water physics area
  color?: string;
  borderColor?: string;
}

export interface HazardZone {
  x: number;
  y: number;
  w: number;
  h: number;
  damage: number;
  type: 'lava' | 'spikes' | 'acid' | 'laser' | 'icicle';
  active?: boolean;
  timer?: number;
}

export interface MapSpawnPoint {
  x: number;
  y: number;
}

export interface ArenaMap {
  id: string;
  name: string;
  theme: string;
  hazardDescription: string;
  icon: string;
  bgColor: string;
  bgGradient: [string, string];
  platforms: Platform[];
  hazards: HazardZone[];
  spawnPoints: MapSpawnPoint[];
  ambientType: 'dust' | 'embers' | 'clouds' | 'water' | 'sparks' | 'snow' | 'ghosts' | 'crystals';
  gravityScale?: number;
  hasScreenWrap?: boolean;
}
