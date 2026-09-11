export type PlatformMaterial =
  | 'stone'
  | 'wood'
  | 'basalt'
  | 'cloud'
  | 'crystal'
  | 'tech'
  | 'ice'
  | 'ancient'
  | 'celestial';

export interface InteractiveProp {
  id: string;
  type: 'torch' | 'lantern' | 'crystal';
  x: number;
  y: number;
  anchorX: number;
  anchorY: number;
  length?: number;
  angle?: number;
  angularVelocity?: number;
  lightColor?: string;
  lightRadius?: number;
}

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
  material?: PlatformMaterial;
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

export type MapBoundaryType = 'solid' | 'open' | 'portal' | 'hazard' | 'bouncy' | 'updraft';

export type BoundaryVisualTheme =
  | 'stone'
  | 'wood'
  | 'metal'
  | 'sandstone'
  | 'portal-cosmic'
  | 'portal-toxic'
  | 'portal-crystal'
  | 'hazard-magma'
  | 'hazard-electric'
  | 'bouncy-neon'
  | 'bouncy-hydro'
  | 'updraft-wind';

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
  boundaryType?: MapBoundaryType;
  boundaryTheme?: BoundaryVisualTheme;
  props?: InteractiveProp[];
}
