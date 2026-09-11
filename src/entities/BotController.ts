import { Player } from './Player';
import { PlayerInputState } from '../core/InputManager';
import { Projectile } from './Projectile';
import { Platform, HazardZone, MapBoundaryType } from '../maps/MapTypes';
import { PowerUpDefinition } from '../powerups/PowerUpTypes';

export class BotController {
  private player: Player;
  private actionTimer: number = 0;
  private jumpTimer: number = 0;
  private attackDecisionTimer: number = 0;

  // Jump feel & Long Jump / Double Jump state
  private jumpHoldTimer: number = 0;
  private wantsDoubleJump: boolean = false;
  private doubleJumpDelayTimer: number = 0;
  private airSteerDir: number = 0;
  private airSteerTimer: number = 0;

  // Difficulty & Human-like hesitation timers
  private hesitationTimer: number = 0;
  private hesitationCooldown: number = 1.5;
  private meleeReactionTimer: number = 0;
  private meleeCooldownTimer: number = 0;
  private aimErrorAngle: number = 0;
  private aimErrorTimer: number = 0;
  private weaponSwitchTimer: number = 0;
  private hasTargetInRange: boolean = false;

  constructor(player: Player) {
    this.player = player;
  }

  /**
   * Helper to initiate a full-height long jump, optionally queueing a timed double jump near apex.
   */
  private triggerJump(holdDuration: number = 0.30, enableDoubleJump: boolean = false, steerDir: number = 0): void {
    this.jumpHoldTimer = holdDuration;
    this.wantsDoubleJump = enableDoubleJump;
    this.doubleJumpDelayTimer = 0.24; // Wait ~0.24s into the first jump ascent before executing double jump
    this.jumpTimer = 0;
    if (steerDir !== 0) {
      this.airSteerDir = steerDir;
      this.airSteerTimer = enableDoubleJump ? 0.65 : 0.40;
    }
  }

  /**
   * Checks if position (x, y) has an active hazard directly beneath it without any safe platform in between.
   */
  private isOverHazard(
    x: number,
    y: number,
    platforms: Platform[],
    hazards: HazardZone[]
  ): HazardZone | null {
    const activeHazards = hazards.filter(h => h.active !== false);
    for (const h of activeHazards) {
      if (x >= h.x - 15 && x <= h.x + h.w + 15 && y < h.y + h.h) {
        // Check if there is a safe solid platform between y and h.y
        const hasSafePlatform = platforms.some(p =>
          p.crumbleState !== 'vanished' &&
          !p.hazard &&
          p.y >= y - 6 &&
          p.y <= h.y &&
          x >= p.x - 6 &&
          x <= p.x + p.w + 6
        );
        if (!hasSafePlatform) {
          return h;
        }
      }
    }
    return null;
  }

  /**
   * Checks if falling at (x, y) would drop into either an explicit hazard or the bottom abyss.
   */
  private isLethalFall(
    x: number,
    y: number,
    platforms: Platform[],
    hazards: HazardZone[],
    boundaryType: MapBoundaryType = 'solid'
  ): boolean {
    // If boundary is hazard, stepping too close to the edge is lethal/damaging
    if (boundaryType === 'hazard' && (x <= 40 || x >= 1240)) {
      return true;
    }
    // If boundary is open void, stepping outside arena bounds is an abyss fall
    if (boundaryType === 'open' && (x <= 20 || x >= 1260)) {
      return true;
    }

    if (this.isOverHazard(x, y, platforms, hazards)) return true;

    // Check if there is NO platform below x all the way to bottom of map (abyss drop)
    const hasPlatformBelow = platforms.some(p =>
      p.crumbleState !== 'vanished' &&
      !p.hazard &&
      p.y > y - 6 &&
      x >= p.x - 6 &&
      x <= p.x + p.w + 6
    );
    if (!hasPlatformBelow && y > 520) {
      return true;
    }
    return false;
  }

  /**
   * Finds the platform currently beneath the bot's feet, if any.
   */
  private getCurrentPlatform(platforms: Platform[]): Platform | null {
    const halfW = this.player.width * 0.5;
    const halfH = this.player.height * 0.5;
    const footY = this.player.y + halfH;

    for (const p of platforms) {
      if (p.crumbleState === 'vanished') continue;
      if (
        this.player.x + halfW > p.x &&
        this.player.x - halfW < p.x + p.w &&
        Math.abs(footY - p.y) <= 10
      ) {
        return p;
      }
    }
    return null;
  }

  /**
   * Inspects the edge ahead in moveDir.
   * Returns whether walking forward would step off into a hazard/abyss or gap,
   * whether a forward jump can reach a safe platform, and whether a double jump is needed.
   */
  private evaluateLedgeAhead(
    moveDir: number,
    currentPlat: Platform,
    platforms: Platform[],
    hazards: HazardZone[],
    boundaryType: MapBoundaryType = 'solid'
  ): { isHazardAhead: boolean; canJumpAcross: boolean; bestTargetPlat: Platform | null; needsDoubleJump: boolean } {
    const edgeX = moveDir > 0 ? currentPlat.x + currentPlat.w : currentPlat.x;
    const distToEdge = moveDir > 0 ? (edgeX - this.player.x) : (this.player.x - edgeX);

    // If still comfortably inside platform boundaries (> 55px from edge), not yet at ledge
    if (distToEdge > 55) {
      return { isHazardAhead: false, canJumpAcross: false, bestTargetPlat: null, needsDoubleJump: false };
    }

    // Look at where stepping off will drop
    const stepOffX = edgeX + moveDir * 35;
    const isHazardAhead = this.isLethalFall(stepOffX, currentPlat.y, platforms, hazards, boundaryType);

    // Also check if stepping off drops into a deep gap (> 60px down to next ground)
    const hasCloseGroundBelow = platforms.some(p =>
      p !== currentPlat &&
      p.crumbleState !== 'vanished' &&
      !p.hazard &&
      stepOffX >= p.x - 5 && stepOffX <= p.x + p.w + 5 &&
      p.y > currentPlat.y && p.y <= currentPlat.y + 60
    );
    const isGapAhead = !hasCloseGroundBelow;

    if (!isHazardAhead && !isGapAhead) {
      return { isHazardAhead: false, canJumpAcross: false, bestTargetPlat: null, needsDoubleJump: false };
    }

    // There IS a hazard or gap ahead! Can we jump forward to clear it and land on a safe platform?
    let bestTargetPlat: Platform | null = null;
    let bestDist = 9999;
    let needsDoubleJump = false;

    for (const p of platforms) {
      if (p === currentPlat || p.crumbleState === 'vanished' || p.hazard) continue;
      const platEdgeTowardsBot = moveDir > 0 ? p.x : (p.x + p.w);
      const hDist = (platEdgeTowardsBot - edgeX) * moveDir;
      const vDist = p.y - currentPlat.y; // negative = higher, positive = lower

      // With long jump + double jump, horizontal reach is up to ~340px, vertical reach [-240px, +180px]
      if (hDist > 10 && hDist < 340 && vDist > -240 && vDist < 180) {
        if (hDist < bestDist) {
          bestDist = hDist;
          bestTargetPlat = p;
          needsDoubleJump = hDist > 80 || vDist < -60;
        }
      }
    }

    return {
      isHazardAhead,
      canJumpAcross: bestTargetPlat !== null,
      bestTargetPlat,
      needsDoubleJump
    };
  }

  /**
   * Airborne emergency hazard recovery: if the bot is in mid-air over a hazard or abyss,
   * immediately steer towards the nearest safe platform and jump/dash to safety.
   */
  private handleAirborneHazardRecovery(
    state: PlayerInputState,
    platforms: Platform[],
    hazards: HazardZone[],
    boundaryType: MapBoundaryType = 'solid'
  ): boolean {
    if (this.player.isGrounded) return false;

    const isLethal = this.isLethalFall(this.player.x, this.player.y, platforms, hazards, boundaryType);
    if (!isLethal) return false;

    // Find nearest safe platform
    let nearestSafePlat: Platform | null = null;
    let minScore = 99999;

    for (const p of platforms) {
      if (p.crumbleState === 'vanished' || p.hazard) continue;
      const platCenter = p.x + p.w * 0.5;
      const hDist = Math.abs(platCenter - this.player.x);
      const vDist = p.y - this.player.y; // positive = below, negative = above

      // Favor platforms beneath us or reachable via jump
      if (vDist > -220) {
        const score = hDist + Math.max(0, -vDist) * 1.5;
        if (score < minScore) {
          minScore = score;
          nearestSafePlat = p;
        }
      }
    }

    if (nearestSafePlat) {
      const targetCenter = nearestSafePlat.x + nearestSafePlat.w * 0.5;
      const steerDir = targetCenter > this.player.x + 8 ? 1 : (targetCenter < this.player.x - 8 ? -1 : 0);
      if (steerDir > 0) {
        state.right = true;
        state.left = false;
      } else if (steerDir < 0) {
        state.left = true;
        state.right = false;
      }

      // Air recovery jump / double jump with hold!
      if (this.player.jumpsLeft > 0 && this.jumpTimer > 0.18) {
        this.triggerJump(0.30, false, steerDir);
        state.jump = true;
        state.jumpJustPressed = true;
      } else if (this.player.canDash && minScore > 60 && this.player.vy > 40) {
        // Emergency air dash towards safety
        state.dash = true;
        state.dashJustPressed = true;
      }
      return true;
    }

    return false;
  }

  /**
   * Checks if an upper platform is reachable directly above the current platform.
   */
  private findReachableUpperPlatform(
    currentPlat: Platform,
    platforms: Platform[]
  ): Platform | null {
    const halfW = this.player.width * 0.5;
    for (const p of platforms) {
      if (p === currentPlat || p.crumbleState === 'vanished' || p.hazard) continue;
      const vDist = p.y - currentPlat.y;
      // Reaching straight up via double jump (-260px)
      if (vDist < -60 && vDist > -260) {
        if (
          (this.player.x + halfW > p.x && this.player.x - halfW < p.x + p.w) ||
          Math.abs((p.x + p.w * 0.5) - this.player.x) < 160
        ) {
          return p;
        }
      }
    }
    return null;
  }

  public generateInput(
    dt: number,
    allPlayers: Player[],
    projectiles: Projectile[],
    platforms: Platform[],
    hazards: HazardZone[],
    boundaryType: MapBoundaryType = 'solid'
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

    const difficulty = this.player.cpuDifficulty;

    this.actionTimer += dt;
    this.jumpTimer += dt;
    this.attackDecisionTimer += dt;
    this.meleeCooldownTimer = Math.max(0, this.meleeCooldownTimer - dt);
    this.weaponSwitchTimer = Math.max(0, this.weaponSwitchTimer - dt);
    this.aimErrorTimer = Math.max(0, this.aimErrorTimer - dt);

    // Periodic hesitation (Novice pauses to think/breathe, Medium rarely, Hard never)
    if (difficulty === 'easy') {
      if (this.hesitationTimer > 0) {
        this.hesitationTimer -= dt;
      } else {
        this.hesitationCooldown -= dt;
        if (this.hesitationCooldown <= 0) {
          this.hesitationTimer = 0.45 + Math.random() * 0.35;
          this.hesitationCooldown = 2.0 + Math.random() * 2.0;
        }
      }
    } else if (difficulty === 'med') {
      if (this.hesitationTimer > 0) {
        this.hesitationTimer -= dt;
      } else {
        this.hesitationCooldown -= dt;
        if (this.hesitationCooldown <= 0) {
          this.hesitationTimer = 0.2 + Math.random() * 0.15;
          this.hesitationCooldown = 5.0 + Math.random() * 3.0;
        }
      }
    }

    // ================= 0. JUMP HOLD & TIMED DOUBLE JUMP LOGIC =================
    // Hold jump button to achieve full variable jump height (prevents short hops)
    if (this.jumpHoldTimer > 0) {
      this.jumpHoldTimer -= dt;
      state.jump = true;
    }

    if (this.player.isGrounded) {
      this.wantsDoubleJump = false;
      this.doubleJumpDelayTimer = 0;
      this.airSteerTimer = 0;
    } else {
      // While airborne, if a double jump is queued, trigger it near the first jump apex
      if (this.wantsDoubleJump) {
        this.doubleJumpDelayTimer -= dt;
        if (this.doubleJumpDelayTimer <= 0 && this.player.jumpsLeft > 0) {
          state.jump = true;
          state.jumpJustPressed = true;
          this.jumpHoldTimer = 0.28; // Hold double jump for maximum loft & distance
          this.wantsDoubleJump = false;
          this.jumpTimer = 0;
        }
      }

      // Air steering across gaps: maintain forward direction through the leap unless approaching outer danger
      if (this.airSteerTimer > 0) {
        this.airSteerTimer -= dt;
        if (this.airSteerDir > 0) {
          if (!this.isLethalFall(this.player.x + 35, this.player.y + 50, platforms, hazards, boundaryType) || this.player.x < 1120) {
            state.right = true;
            state.left = false;
          } else {
            this.airSteerTimer = 0;
          }
        } else if (this.airSteerDir < 0) {
          if (!this.isLethalFall(this.player.x - 35, this.player.y + 50, platforms, hazards, boundaryType) || this.player.x > 160) {
            state.left = true;
            state.right = false;
          } else {
            this.airSteerTimer = 0;
          }
        }
      }
    }

    // ================= 1. TARGETING & OPPONENTS =================
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

    // ================= 2. PARRY DEFENSE =================
    const parryChance = difficulty === 'hard' ? 0.85 : (difficulty === 'med' ? 0.45 : 0.12);
    const parryReactionDist = difficulty === 'hard' ? 140 : (difficulty === 'med' ? 95 : 45);

    for (const proj of projectiles) {
      if (!proj.isStuck && !proj.isDead && proj.ownerIndex !== this.player.index) {
        const pDist = Math.hypot(proj.x - this.player.x, proj.y - this.player.y);
        const toBotX = this.player.x - proj.x;
        const toBotY = this.player.y - proj.y;
        const dot = proj.vx * toBotX + proj.vy * toBotY;

        if (pDist < parryReactionDist && dot > 0) {
          if (difficulty === 'easy') {
            // Novice bots only parry if they already hold sword AND roll low chance (no instant weapon-switch parry)
            if (this.player.currentWeapon === 'sword' && Math.random() < parryChance) {
              state.parryJustPressed = true;
              state.parry = true;
              return state;
            }
          } else if (difficulty === 'med') {
            if (Math.random() < parryChance) {
              if (this.player.currentWeapon !== 'sword' && Math.random() < 0.5) {
                state.switchWeaponJustPressed = true;
              }
              if (this.player.currentWeapon === 'sword') {
                state.parryJustPressed = true;
                state.parry = true;
                return state;
              }
            }
          } else {
            // Hard: immediate weapon switch and parry
            if (Math.random() < parryChance) {
              if (this.player.currentWeapon !== 'sword') {
                state.switchWeaponJustPressed = true;
              }
              state.parryJustPressed = true;
              state.parry = true;
              return state;
            }
          }
        }
      }
    }

    // ================= 3. WEAPON SWITCHING =================
    const switchCooldown = difficulty === 'hard' ? 0.2 : (difficulty === 'med' ? 0.8 : 2.2);
    if (this.weaponSwitchTimer <= 0) {
      if (minDistance < 100 && this.player.currentWeapon !== 'sword') {
        state.switchWeaponJustPressed = true;
        this.weaponSwitchTimer = switchCooldown;
      } else if (minDistance > 220 && this.player.currentWeapon !== 'bow') {
        state.switchWeaponJustPressed = true;
        this.weaponSwitchTimer = switchCooldown;
      }
    }

    // ================= 4. MOVEMENT & NAVIGATION =================
    const moveDir = Math.abs(dx) > 40 ? (dx > 0 ? 1 : -1) : 0;
    const currentPlat = this.getCurrentPlatform(platforms);

    // Check if airborne and over hazard (immediate emergency recovery)
    const isRecovering = this.handleAirborneHazardRecovery(state, platforms, hazards, boundaryType);
    const isHesitating = this.hesitationTimer > 0 && this.player.isGrounded;

    if (!isRecovering) {
      if (!isHesitating && this.airSteerTimer <= 0 && moveDir !== 0) {
        if (moveDir > 0) state.right = true;
        else state.left = true;
      }

      // If grounded on a platform, check the ledge ahead for hazards / gaps!
      if (currentPlat && moveDir !== 0 && !isHesitating) {
        const ledgeCheck = this.evaluateLedgeAhead(moveDir, currentPlat, platforms, hazards, boundaryType);
        if (ledgeCheck.isHazardAhead || ledgeCheck.canJumpAcross) {
          if (ledgeCheck.canJumpAcross && this.jumpTimer > 0.2) {
            // Long jump across the gap, followed by a double jump if needed!
            this.triggerJump(0.30, ledgeCheck.needsDoubleJump, moveDir);
            state.jump = true;
            state.jumpJustPressed = true;
          } else if (ledgeCheck.isHazardAhead) {
            // Cannot jump across directly: do NOT suicide walk off into the hazard!
            if (moveDir > 0) state.right = false;
            else state.left = false;

            // Check if there is an upper platform to jump up to instead
            const upperPlat = this.findReachableUpperPlatform(currentPlat, platforms);
            if (upperPlat && this.jumpTimer > 0.25) {
              const vDist = upperPlat.y - currentPlat.y;
              this.triggerJump(0.30, vDist < -80, moveDir);
              state.jump = true;
              state.jumpJustPressed = true;
            } else {
              // Stay safe on the platform / turn slightly away from the dangerous edge
              if (moveDir > 0) state.left = true;
              else state.right = true;
            }
          }
        }
      }

      // Shaking crumble platform reaction: leap before the block vanishes beneath feet!
      if (currentPlat && currentPlat.crumble && currentPlat.crumbleState === 'shaking') {
        if (this.jumpTimer > 0.16) {
          this.triggerJump(0.30, true, moveDir || (this.player.facingLeft ? -1 : 1));
          state.jump = true;
          state.jumpJustPressed = true;
        }
      }

      // Vertical navigation: Jump or Drop through
      const jumpPursuitDelay = difficulty === 'hard' ? 0.35 : (difficulty === 'med' ? 0.55 : 0.95);
      if (dy < -60 && this.jumpTimer > jumpPursuitDelay && !isHesitating) {
        // Opponent is above: Long jump, followed by a double jump if opponent is high up
        const needsDouble = dy < -90;
        this.triggerJump(0.30, needsDouble, moveDir);
        state.jump = true;
        state.jumpJustPressed = true;
      } else if (dy > 80 && this.player.isGrounded && Math.random() < (difficulty === 'easy' ? 0.02 : 0.04)) {
        // Opponent is below: ONLY drop through if there is safe ground beneath!
        if (currentPlat && currentPlat.oneWay) {
          const isHazardBelow = this.isLethalFall(this.player.x, currentPlat.y + currentPlat.h + 15, platforms, hazards);
          if (!isHazardBelow) {
            state.down = true;
            state.jumpJustPressed = true;
          }
        }
      }

      // Tactical dash to close gap or evade when on safe terrain
      // Novice never dashes in combat; Medium occasionally, Hard frequently
      const dashChance = difficulty === 'hard' ? 0.04 : (difficulty === 'med' ? 0.015 : 0.0);
      if (!isHesitating && dashChance > 0 && minDistance < 180 && minDistance > 80 && Math.random() < dashChance && !this.isLethalFall(this.player.x + (moveDir * 120), this.player.y, platforms, hazards)) {
        state.dashJustPressed = true;
        state.dash = true;
      }
    }

    // ================= 5. COMBAT ACTIONS =================
    if (this.player.currentWeapon === 'sword') {
      // Aerial Down-thrust pogo: if airborne directly above opponent, dive strike!
      const isAboveOpponent = !this.player.isGrounded && dy > 30 && dy < 140 && Math.abs(dx) < 42 && this.player.vy > 30;
      if (isAboveOpponent && (difficulty === 'hard' || (difficulty === 'med' && Math.random() < 0.6))) {
        state.down = true;
        state.attackJustPressed = true;
        state.attack = true;
        this.meleeCooldownTimer = 0.35;
      } else {
        // Melee attack when in range
        const inMeleeRange = minDistance < 65 && Math.abs(dy) < 38;
        if (inMeleeRange) {
          if (!this.hasTargetInRange) {
            this.hasTargetInRange = true;
            // Reaction time before swinging: Novices hesitate for ~0.45s before attacking
            this.meleeReactionTimer = difficulty === 'hard' ? 0.04 : (difficulty === 'med' ? 0.16 : 0.45);
          }

          if (this.meleeReactionTimer > 0) {
            this.meleeReactionTimer -= dt;
          } else if (this.meleeCooldownTimer <= 0) {
            state.attackJustPressed = true;
            state.attack = true;
            // Interval between consecutive swings: Hard chains combos rapidly, Med chains moderately
            this.meleeCooldownTimer = difficulty === 'hard' ? 0.18 : (difficulty === 'med' ? 0.32 : 0.85);
          }
        } else {
          this.hasTargetInRange = false;
          this.meleeReactionTimer = 0;
        }
      }
    } else {
      // Ranged bow combat with lead calculation & inaccuracy
      const leadMultiplier = difficulty === 'hard' ? 0.18 : (difficulty === 'med' ? 0.08 : 0.0);
      const leadX = dx + nearestOpponent.vx * leadMultiplier;
      const leadY = dy + nearestOpponent.vy * leadMultiplier;

      // Update aim jitter for human-like inaccuracy
      if (this.aimErrorTimer <= 0) {
        if (difficulty === 'easy') {
          // Novice has significant spread: ±0.32 rad (~18 degrees)
          this.aimErrorAngle = (Math.random() - 0.5) * 0.64;
          this.aimErrorTimer = 0.5 + Math.random() * 0.4;
        } else if (difficulty === 'med') {
          // Medium has minor spread: ±0.09 rad (~5 degrees)
          this.aimErrorAngle = (Math.random() - 0.5) * 0.18;
          this.aimErrorTimer = 0.6;
        } else {
          this.aimErrorAngle = 0;
          this.aimErrorTimer = 1.0;
        }
      }

      // Rotate aim vector by aimErrorAngle
      const cosA = Math.cos(this.aimErrorAngle);
      const sinA = Math.sin(this.aimErrorAngle);
      const rawAimX = leadX * cosA - leadY * sinA;
      const rawAimY = leadX * sinA + leadY * cosA;
      const len = Math.hypot(rawAimX, rawAimY) || 1;

      state.aimX = rawAimX / len;
      state.aimY = rawAimY / len;

      const fireInterval = difficulty === 'hard' ? 0.50 : (difficulty === 'med' ? 0.85 : 1.80);
      if (!this.player.isDrawingBow && this.attackDecisionTimer > fireInterval) {
        state.attack = true;
        state.attackJustPressed = true;
        this.attackDecisionTimer = 0;
      } else if (this.player.isDrawingBow) {
        const targetCharge = difficulty === 'hard' ? 0.90 : (difficulty === 'med' ? 0.65 : 0.42);
        if (this.player.bowDrawCharge >= targetCharge) {
          state.attack = false;
          state.attackJustReleased = true;
        } else {
          state.attack = true;
        }
      }
    }

    return state;
  }

  public pickDraftPowerUp(cards: PowerUpDefinition[]): PowerUpDefinition {
    if (this.player.hasPowerUp('triple-volley') || this.player.hasPowerUp('seeker-arrows')) {
      const bowCard = cards.find(c => c.category === 'bow');
      if (bowCard) return bowCard;
    } else if (this.player.hasPowerUp('vorpal-dash') || this.player.hasPowerUp('titan-cleaver')) {
      const swordCard = cards.find(c => c.category === 'sword');
      if (swordCard) return swordCard;
    }

    const randomIndex = Math.floor(Math.random() * cards.length);
    return cards[randomIndex];
  }
}
