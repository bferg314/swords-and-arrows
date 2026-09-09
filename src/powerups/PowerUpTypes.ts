export type WeaponCategory = 'sword' | 'bow';

export interface PowerUpDefinition {
  id: string;
  name: string;
  category: WeaponCategory;
  icon: string;
  tagline: string;
  description: string;
  color: string;
}

export interface PlayerPowerUpInventory {
  [powerUpId: string]: boolean;
}
