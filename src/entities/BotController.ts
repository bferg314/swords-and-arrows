import { Player } from './Player';
import { PlayerInputState } from '../core/InputManager';
import { Projectile } from './Projectile';
import { Platform, HazardZone } from '../maps/MapTypes';
import { PowerUpDefinition } from '../powerups/PowerUpTypes';

export class BotController {
  private player: Player;
  private actionTimer: number = 0;
  private jumpTimer: number = 0;
  private attackDecisionTimer: number = 0;

  constructor(player: Player) {
    this.player = player;
  }

  public generateInput(
    dt: number,
    allPlayers: Player[],
    projectiles: Projectile[],
    _platforms: Platform[],
    _hazards: HazardZone[]
  ): PlayerInputState {
    const state: PlayerInputState = {
      left: false,
      right: false,
      up: false,
      down: false,
      jump: false,
      jumpJustPressed: false,
      attack: false,
      attackJustPressed: false,
      attackJustReleased: false,
      parry: false,
      parryJustPressed: false,
      switchWeapon: false,
      switchWeaponJustPressed: false,
      dash: false,
      dashJustPressed: false,
      aimX: 0,
      aimY: 0
    };

    if (!this.player.isAlive) return state;

    this.actionTimer += dt;
    this.jumpTimer += dt;
    this.attackDecisionTimer += dt;

    // 1. Find nearest alive opponent
    let nearestOpponent: Player | null = null;
    let minDistance = 99999;

    for (const other of allPlayers) {
      if (other.index !== this.player.index && other.isAlive) {
        const d = Math.hypot(other.x - this.player.x, other.y - this.player.y);
        if (d < minDistance) {
          minDistance = d;
          nearestOpponent = other;
        }
      }
    }

    if (!nearestOpponent) return state;

    const dx = nearestOpponent.x - this.player.x;
    const dy = nearestOpponent.y - this.player.y;

    // 2. Incoming projectile defense (Parry reaction!)
    const parryReactionDist = this.player.cpuDifficulty === 'hard' ? 140 : (this.player.cpuDifficulty === 'med' ? 100 : 60);
    for (const proj of projectiles) {
      if (!proj.isStuck && !proj.isDead && proj.ownerIndex !== this.player.index) {
        const pDist = Math.hypot(proj.x - this.player.x, proj.y - this.player.y);
        // Is projectile moving towards bot?
        const toBotX = this.player.x - proj.x;
        const toBotY = this.player.y - proj.y;
        const dot = proj.vx * toBotX + proj.vy * toBotY;

        if (pDist < parryReactionDist && dot > 0) {
          if (this.player.currentWeapon !== 'sword') {
            state.switchWeaponJustPressed = true;
          }
          state.parryJustPressed = true;
          state.parry = true;
          return state;
        }
      }
    }

    // 3. Tactical Weapon Switching
    // Close range (< 120px) -> Prefer Sword
    // Long range (> 180px) -> Prefer Bow
    if (minDistance < 120 && this.player.currentWeapon !== 'sword') {
      state.switchWeaponJustPressed = true;
    } else if (minDistance > 200 && this.player.currentWeapon !== 'bow') {
      state.switchWeaponJustPressed = true;
    }

    // 4. Movement Logic
    if (Math.abs(dx) > 40) {
      if (dx > 0) {
        state.right = true;
      } else {
        state.left = true;
      }
    }

    // Vertical navigation: Jump or Drop through
    if (dy < -60 && this.jumpTimer > 0.45) {
      // Opponent is above: Jump
      state.jump = true;
      state.jumpJustPressed = true;
      this.jumpTimer = 0;
    } else if (dy > 80 && this.player.isGrounded && Math.random() < 0.04) {
      // Opponent is below: Drop through
      state.down = true;
      state.jumpJustPressed = true;
    }

    // Occasional dash to close gap or evade
    if (minDistance < 180 && minDistance > 80 && Math.random() < 0.03) {
      state.dashJustPressed = true;
      state.dash = true;
    }

    // 5. Combat Action
    if (this.player.currentWeapon === 'sword') {
      // Melee attack when in range
      if (minDistance < 70 && Math.abs(dy) < 40) {
        state.attackJustPressed = true;
        state.attack = true;
      }
    } else {
      // Ranged bow combat
      // Lead calculation
      const leadX = dx + nearestOpponent.vx * 0.15;
      const leadY = dy + nearestOpponent.vy * 0.15;
      const len = Math.hypot(leadX, leadY) || 1;

      state.aimX = leadX / len;
      state.aimY = leadY / len;

      if (!this.player.isDrawingBow && this.attackDecisionTimer > 0.6) {
        // Start draw
        state.attack = true;
        state.attackJustPressed = true;
        this.attackDecisionTimer = 0;
      } else if (this.player.isDrawingBow) {
        const targetCharge = this.player.cpuDifficulty === 'hard' ? 0.9 : 0.65;
        if (this.player.bowDrawCharge >= targetCharge) {
          // Release shot
          state.attack = false;
          state.attackJustReleased = true;
        } else {
          // Keep holding
          state.attack = true;
        }
      }
    }

    return state;
  }

  public pickDraftPowerUp(cards: PowerUpDefinition[]): PowerUpDefinition {
    // Pick the best powerup matching favorite weapon or highest tier
    if (this.player.hasPowerUp('triple-volley') || this.player.hasPowerUp('seeker-arrows')) {
      const bowCard = cards.find(c => c.category === 'bow');
      if (bowCard) return bowCard;
    } else if (this.player.hasPowerUp('vorpal-dash') || this.player.hasPowerUp('titan-cleaver')) {
      const swordCard = cards.find(c => c.category === 'sword');
      if (swordCard) return swordCard;
    }

    // Default: choose random of the 3
    const randomIndex = Math.floor(Math.random() * cards.length);
    return cards[randomIndex];
  }
}
