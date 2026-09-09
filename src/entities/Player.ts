import { PlayerInputState } from '../core/InputManager';
import { Platform, HazardZone } from '../maps/MapTypes';
import { Projectile } from './Projectile';
import { SoundEngine } from '../core/SoundEngine';
import { ParticleSystem } from '../core/ParticleSystem';
import { PlayerPowerUpInventory } from '../powerups/PowerUpTypes';

export type WeaponType = 'sword' | 'bow';

export interface PlayerStats {
  kills: number;
  deaths: number;
  parries: number;
  arrowsShot: number;
  damageDealt: number;
}

export class Player {
  public index: number; // 0, 1, 2, 3
  public name: string;
  public color: string;
  public isCpu: boolean = false;
  public cpuDifficulty: 'easy' | 'med' | 'hard' = 'med';

  // Spatial & Physics
  public x: number = 0;
  public y: number = 0;
  public vx: number = 0;
  public vy: number = 0;
  public width: number = 26;
  public height: number = 42;
  public facingLeft: boolean = false;
  public isGrounded: boolean = false;
  public isTouchingWallLeft: boolean = false;
  public isTouchingWallRight: boolean = false;
  public isWallSliding: boolean = false;

  // Jump feel
  private jumpBufferTimer: number = 0;
  private coyoteTimer: number = 0;
  private jumpsRemaining: number = 2;
  private dropThroughTimer: number = 0;

  // Dash feel
  public isDashing: boolean = false;
  private dashTimer: number = 0;
  private dashCooldown: number = 0;
  public isInvulnerable: boolean = false;
  private invulnerableTimer: number = 0;

  // Health & Round state
  public maxHealth: number = 3;
  public health: number = 3;
  public isAlive: boolean = true;
  public wins: number = 0;
  public stats: PlayerStats = {
    kills: 0,
    deaths: 0,
    parries: 0,
    arrowsShot: 0,
    damageDealt: 0
  };

  // Weapon System
  public currentWeapon: WeaponType = 'sword';
  private weaponSwitchCooldown: number = 0;

  // Sword Attack State
  public isAttacking: boolean = false;
  private attackTimer: number = 0;
  private attackCooldown: number = 0;
  public isParrying: boolean = false;
  public parryTimer: number = 0;
  private parryCooldown: number = 0;
  public isDownThrusting: boolean = false;

  // Bow Attack State
  public isDrawingBow: boolean = false;
  public bowDrawCharge: number = 0; // 0.0 to 1.0
  public quiverAmmo: number = 3;
  public maxQuiverAmmo: number = 3;
  private ammoRegenTimer: number = 0;

  // Status Effects
  public freezeTimer: number = 0;
  public speedSurgeTimer: number = 0;

  // Power-Ups Inventory
  public powerUps: PlayerPowerUpInventory = {};

  private animTimer: number = 0;

  constructor(index: number, name: string, color: string, isCpu: boolean = false) {
    this.index = index;
    this.name = name;
    this.color = color;
    this.isCpu = isCpu;
  }

  public resetForRound(spawnX: number, spawnY: number, fullHealth: number = 3): void {
    this.x = spawnX;
    this.y = spawnY;
    this.vx = 0;
    this.vy = 0;
    this.maxHealth = fullHealth;
    this.health = fullHealth;
    this.isAlive = true;
    this.isDashing = false;
    this.dashTimer = 0;
    this.dashCooldown = 0;
    this.isInvulnerable = false;
    this.invulnerableTimer = 0;
    this.isAttacking = false;
    this.attackTimer = 0;
    this.attackCooldown = 0;
    this.isParrying = false;
    this.parryTimer = 0;
    this.parryCooldown = 0;
    this.isDrawingBow = false;
    this.bowDrawCharge = 0;
    this.quiverAmmo = this.hasPowerUp('infinite-quiver') ? 999 : 3;
    this.freezeTimer = 0;
    this.speedSurgeTimer = 0;
    this.jumpsRemaining = 2;
  }

  public hasPowerUp(id: string): boolean {
    return !!this.powerUps[id];
  }

  public update(
    dt: number,
    input: PlayerInputState,
    platforms: Platform[],
    hazards: HazardZone[],
    sound: SoundEngine,
    particles: ParticleSystem,
    projectiles: Projectile[],
    allPlayers: Player[],
    hasScreenWrap: boolean = false,
    gravityMultiplier: number = 1.0
  ): void {
    if (!this.isAlive) return;

    this.animTimer += dt;

    // Handle Freeze status effect
    if (this.freezeTimer > 0) {
      this.freezeTimer -= dt;
      this.vx *= 0.8;
      // Emit occasional ice flakes
      if (Math.random() < 0.2) particles.emitIceCrystals(this.x, this.y);
      return;
    }

    // Handle Speed Surge
    if (this.speedSurgeTimer > 0) {
      this.speedSurgeTimer -= dt;
    }

    // Handle Invulnerability i-frames
    if (this.invulnerableTimer > 0) {
      this.invulnerableTimer -= dt;
      if (this.invulnerableTimer <= 0) {
        this.isInvulnerable = false;
      }
    }

    // Cooldown timers
    if (this.weaponSwitchCooldown > 0) this.weaponSwitchCooldown -= dt;
    if (this.attackCooldown > 0) this.attackCooldown -= dt;
    if (this.parryCooldown > 0) this.parryCooldown -= dt;
    if (this.dashCooldown > 0) this.dashCooldown -= dt;
    if (this.dropThroughTimer > 0) this.dropThroughTimer -= dt;

    // Passive quiver ammo regeneration (1 arrow every 4 seconds if not infinite)
    if (!this.hasPowerUp('infinite-quiver') && this.quiverAmmo < this.maxQuiverAmmo) {
      this.ammoRegenTimer += dt;
      if (this.ammoRegenTimer >= 4.0) {
        this.quiverAmmo++;
        this.ammoRegenTimer = 0;
      }
    }

    // ================= 1. WEAPON SWITCHING =================
    if (input.switchWeaponJustPressed && this.weaponSwitchCooldown <= 0) {
      this.currentWeapon = this.currentWeapon === 'sword' ? 'bow' : 'sword';
      this.weaponSwitchCooldown = 0.15;
      sound.playWeaponSwitch();
      particles.emitSparks(this.x, this.y, 8, this.currentWeapon === 'sword' ? '#f72585' : '#00f5d4');
      // Cancel active attacks on switch
      this.isAttacking = false;
      this.isDrawingBow = false;
      this.bowDrawCharge = 0;
      this.isParrying = false;
    }

    // ================= 2. DASH MECHANIC =================
    if (input.dashJustPressed && this.dashCooldown <= 0 && !this.isDashing) {
      this.isDashing = true;
      const dashDuration = this.hasPowerUp('vorpal-dash') ? 0.28 : 0.18;
      this.dashTimer = dashDuration;
      this.dashCooldown = this.hasPowerUp('vorpal-dash') ? 0.45 : 0.6;
      this.isInvulnerable = true;
      this.invulnerableTimer = dashDuration + 0.05;

      const dashDir = input.left ? -1 : (input.right ? 1 : (this.facingLeft ? -1 : 1));
      const dashSpeed = this.hasPowerUp('vorpal-dash') ? 720 : 540;
      this.vx = dashDir * dashSpeed;
      this.vy = 0;

      sound.playDash();
      particles.emitDust(this.x, this.y + this.height * 0.5, 8);

      // Vorpal shadow trail damage check
      if (this.hasPowerUp('vorpal-dash')) {
        for (const other of allPlayers) {
          if (other.index !== this.index && other.isAlive && !other.isInvulnerable) {
            const dist = Math.hypot(other.x - this.x, other.y - this.y);
            if (dist < 50) {
              other.takeDamage(1, Math.sign(this.vx) * 350, -200, sound, particles, this);
            }
          }
        }
      }
    }

    if (this.isDashing) {
      this.dashTimer -= dt;
      // Emit shadow particles while dashing
      if (Math.random() < 0.6) {
        particles.emitSparks(this.x, this.y, 2, this.hasPowerUp('vorpal-dash') ? '#9d4edd' : this.color);
      }
      if (this.dashTimer <= 0) {
        this.isDashing = false;
      }
    }

    // ================= 3. COMBAT ACTIONS =================
    if (this.currentWeapon === 'sword') {
      this.handleSwordCombat(dt, input, sound, particles, projectiles, allPlayers);
    } else {
      this.handleBowCombat(dt, input, sound, particles, projectiles, allPlayers);
    }

    // ================= 4. MOVEMENT & PLATFORMING PHYSICS =================
    if (!this.isDashing) {
      // Horizontal running
      let moveDir = 0;
      if (input.left) moveDir -= 1;
      if (input.right) moveDir += 1;

      if (moveDir !== 0) {
        this.facingLeft = moveDir < 0;
      }

      const baseSpeed = 310;
      const speedMod = (this.speedSurgeTimer > 0 ? 1.4 : 1.0);
      const targetSpeed = moveDir * baseSpeed * speedMod;

      const accel = this.isGrounded ? 1800 : 1200;
      if (moveDir !== 0) {
        this.vx += Math.sign(targetSpeed - this.vx) * Math.min(Math.abs(targetSpeed - this.vx), accel * dt);
      } else {
        const friction = this.isGrounded ? 1600 : 600;
        if (Math.abs(this.vx) < friction * dt) {
          this.vx = 0;
        } else {
          this.vx -= Math.sign(this.vx) * friction * dt;
        }
      }

      // Gravity
      const gravity = 1050 * gravityMultiplier;
      this.vy += gravity * dt;
      if (this.vy > 750) this.vy = 750; // Terminal velocity

      // Down-thrust fast fall
      if (this.isDownThrusting) {
        this.vy = 720;
      }

      // Coyote time & Jump buffer
      if (this.isGrounded) {
        this.coyoteTimer = 0.1;
        this.jumpsRemaining = 2;
        this.isDownThrusting = false;
      } else {
        this.coyoteTimer = Math.max(0, this.coyoteTimer - dt);
      }

      if (input.jumpJustPressed) {
        this.jumpBufferTimer = 0.12;
      } else {
        this.jumpBufferTimer = Math.max(0, this.jumpBufferTimer - dt);
      }

      // Drop through one-way platforms: Down + Jump
      if (input.down && input.jumpJustPressed) {
        this.dropThroughTimer = 0.22;
        this.jumpBufferTimer = 0;
      }

      // Jump execution
      if (this.jumpBufferTimer > 0) {
        if (this.coyoteTimer > 0 || this.jumpsRemaining > 0) {
          this.vy = -540;
          this.jumpBufferTimer = 0;
          this.coyoteTimer = 0;
          this.jumpsRemaining--;
          sound.playJump();
          particles.emitDust(this.x, this.y + this.height * 0.5, 6);
        } else if (this.isWallSliding) {
          // Wall jump
          this.vy = -500;
          this.vx = this.isTouchingWallLeft ? 380 : -380;
          this.facingLeft = this.vx < 0;
          this.jumpBufferTimer = 0;
          sound.playJump();
          particles.emitDust(this.x, this.y, 8);
        }
      }

      // Variable jump height: release jump button early to cut jump short
      if (!input.jump && this.vy < -150) {
        this.vy *= 0.65;
      }
    }

    // ================= 5. ENVIRONMENT & PLATFORM COLLISIONS =================
    this.updateCollisions(dt, platforms, hazards, sound, particles);

    // Screen wrap (Toxic Catacombs)
    if (hasScreenWrap) {
      if (this.x < -10) this.x = 1270;
      if (this.x > 1290) this.x = 10;
    } else {
      // Clamped horizontal arena bounds
      if (this.x < 20) { this.x = 20; this.vx = 0; }
      if (this.x > 1260) { this.x = 1260; this.vx = 0; }
    }

    // Fall into abyss
    if (this.y > 750) {
      this.takeDamage(999, 0, 0, sound, particles);
    }

    // Arrow collection from platforms
    for (const proj of projectiles) {
      if (proj.isStuck && !proj.isDead && this.quiverAmmo < this.maxQuiverAmmo) {
        const dist = Math.hypot(proj.x - this.x, proj.y - this.y);
        if (dist < 35) {
          proj.isDead = true;
          this.quiverAmmo++;
          sound.playWeaponSwitch();
          particles.emitSparks(proj.x, proj.y, 6, '#ffd166');
        }
      }
    }
  }

  private handleSwordCombat(
    dt: number,
    input: PlayerInputState,
    sound: SoundEngine,
    particles: ParticleSystem,
    projectiles: Projectile[],
    allPlayers: Player[]
  ): void {
    // 1. Parry Shield Activation
    if (input.parryJustPressed && this.parryCooldown <= 0 && !this.isAttacking) {
      this.isParrying = true;
      const parryDuration = this.hasPowerUp('aegis-mastery') ? 0.4 : 0.25;
      this.parryTimer = parryDuration;
      this.parryCooldown = parryDuration + 0.45;
      sound.playSwordSwing(1.4);
      particles.emitSparks(this.x, this.y, 8, '#ffd166');
    }

    if (this.isParrying) {
      this.parryTimer -= dt;
      // Check for incoming arrow deflection
      for (const proj of projectiles) {
        if (!proj.isStuck && !proj.isDead && proj.ownerIndex !== this.index) {
          const dist = Math.hypot(proj.x - this.x, proj.y - this.y);
          if (dist < 42) {
            // Deflect arrow!
            const speedMul = this.hasPowerUp('aegis-mastery') ? 2.2 : 1.7;
            proj.reflect(this.index, speedMul);
            if (this.hasPowerUp('aegis-mastery')) {
              proj.isExplosive = true;
            }
            sound.playParrySuccess();
            particles.emitSparks(proj.x, proj.y, 16, '#ffd166');
            this.stats.parries++;
          }
        }
      }

      if (this.parryTimer <= 0) {
        this.isParrying = false;
      }
    }

    // 2. Sword Attack Trigger
    const attackCooldownTime = this.hasPowerUp('blade-flurry') ? 0.16 : 0.32;
    if (input.attackJustPressed && this.attackCooldown <= 0 && !this.isParrying) {
      this.isAttacking = true;
      this.attackTimer = 0.15;
      this.attackCooldown = attackCooldownTime;

      // Aerial Down-thrust check
      if (!this.isGrounded && input.down) {
        this.isDownThrusting = true;
      }

      // Blink Strike teleport
      if (this.hasPowerUp('blink-strike')) {
        let nearestDist = 999;
        let targetPlayer: Player | null = null;
        for (const p of allPlayers) {
          if (p.index !== this.index && p.isAlive) {
            const d = Math.hypot(p.x - this.x, p.y - this.y);
            if (d < nearestDist && d < 320) {
              nearestDist = d;
              targetPlayer = p;
            }
          }
        }
        if (targetPlayer) {
          particles.emitSparks(this.x, this.y, 10, '#7209b7');
          this.x = targetPlayer.x + (targetPlayer.facingLeft ? 40 : -40);
          this.y = targetPlayer.y;
          this.facingLeft = targetPlayer.x < this.x;
          particles.emitSparks(this.x, this.y, 10, '#7209b7');
        }
      }

      // Slash visual arc
      const arcRadius = this.hasPowerUp('titan-cleaver') ? 56 : 36;
      sound.playSwordSwing(this.hasPowerUp('titan-cleaver') ? 0.75 : 1.1);
      particles.createSlashArc(this.x + (this.facingLeft ? -15 : 15), this.y, arcRadius, this.facingLeft, this.hasPowerUp('titan-cleaver') ? '#f77f00' : '#f72585');

      // Sword Beam projectile
      if (this.hasPowerUp('sword-beam')) {
        projectiles.push(new Projectile({
          x: this.x + (this.facingLeft ? -25 : 25),
          y: this.y,
          vx: (this.facingLeft ? -1 : 1) * 620,
          vy: 0,
          ownerIndex: this.index,
          damage: 1,
          type: 'sword-beam',
          color: '#00b4d8',
          hasGravity: false
        }));
      }

      // Flame Brand terrain hazard
      if (this.hasPowerUp('flame-brand') && this.isGrounded) {
        particles.emitFirePatch(this.x + (this.facingLeft ? -30 : 30), this.y + this.height * 0.5, 6);
      }

      // Cyclone Whirlwind vacuum
      if (this.hasPowerUp('cyclone-whirlwind')) {
        for (const other of allPlayers) {
          if (other.index !== this.index && other.isAlive) {
            const dist = Math.hypot(other.x - this.x, other.y - this.y);
            if (dist < 180) {
              const pullDir = Math.atan2(this.y - other.y, this.x - other.x);
              other.vx += Math.cos(pullDir) * 280;
              other.vy += Math.sin(pullDir) * 180;
            }
          }
        }
      }

      // Strike hit detection
      const hitReach = this.hasPowerUp('titan-cleaver') ? 65 : 42;
      const hitX = this.x + (this.facingLeft ? -hitReach * 0.5 : hitReach * 0.5);
      const hitY = this.y;

      for (const other of allPlayers) {
        if (other.index !== this.index && other.isAlive) {
          const dx = Math.abs(other.x - hitX);
          const dy = Math.abs(other.y - hitY);
          if (dx < hitReach && dy < 36) {
            // Check if opponent is parrying
            if (other.isParrying && !this.hasPowerUp('titan-cleaver')) {
              // Parried! Attacker gets stunned
              this.vx = (this.facingLeft ? 1 : -1) * 320;
              this.vy = -180;
              this.attackCooldown = 0.45;
              sound.playSwordClash();
              particles.emitSparks(hitX, hitY, 14, '#ffd166');
            } else {
              // Direct hit!
              const kbX = (this.facingLeft ? -1 : 1) * (this.hasPowerUp('titan-cleaver') ? 600 : 380);
              const kbY = -240;
              other.takeDamage(1, kbX, kbY, sound, particles, this);

              // Down-thrust pogo bounce
              if (this.isDownThrusting) {
                this.vy = -480;
                this.isDownThrusting = false;
              }

              // Thunder Rapier lightning strike
              if (this.hasPowerUp('thunder-rapier')) {
                particles.emitLightningStrike(other.x, other.y - 400, other.x, other.y);
                sound.playExplosion();
                other.takeDamage(1, 0, -150, sound, particles, this);
              }

              // Vampiric Edge
              if (this.hasPowerUp('vampiric-edge')) {
                this.speedSurgeTimer = 2.5;
                if (Math.random() < 0.5 && this.health < this.maxHealth) {
                  this.health++;
                  particles.emitSparks(this.x, this.y, 8, '#06d6a0');
                }
              }
            }
          }
        }
      }
    }

    if (this.isAttacking) {
      this.attackTimer -= dt;
      if (this.attackTimer <= 0) {
        this.isAttacking = false;
      }
    }
  }

  private handleBowCombat(
    dt: number,
    input: PlayerInputState,
    sound: SoundEngine,
    particles: ParticleSystem,
    projectiles: Projectile[],
    _allPlayers: Player[]
  ): void {
    const chargeSpeed = this.hasPowerUp('infinite-quiver') ? 2.5 : 1.5;

    // Draw string
    if (input.attack && (this.quiverAmmo > 0 || this.hasPowerUp('infinite-quiver'))) {
      if (!this.isDrawingBow) {
        this.isDrawingBow = true;
        this.bowDrawCharge = 0.1;
        sound.playBowDraw();
      }
      this.bowDrawCharge = Math.min(1.0, this.bowDrawCharge + chargeSpeed * dt);
      // Particle tension
      if (this.bowDrawCharge > 0.8 && Math.random() < 0.3) {
        particles.emitSparks(this.x + (this.facingLeft ? -10 : 10), this.y, 1, '#ffd166');
      }
    }

    // Release arrow
    if ((input.attackJustReleased || (!input.attack && this.isDrawingBow)) && this.isDrawingBow) {
      this.isDrawingBow = false;
      const isCharged = this.bowDrawCharge >= 0.85;

      if (!this.hasPowerUp('infinite-quiver')) {
        this.quiverAmmo--;
      }

      this.stats.arrowsShot++;
      sound.playArrowShoot(isCharged);

      // Aim direction
      let aimDirX = input.aimX;
      let aimDirY = input.aimY;
      if (Math.hypot(aimDirX, aimDirY) < 0.2) {
        aimDirX = this.facingLeft ? -1 : 1;
        aimDirY = 0;
      }
      const len = Math.hypot(aimDirX, aimDirY);
      aimDirX /= len;
      aimDirY /= len;

      const baseSpeed = isCharged ? 920 : 620;
      const arrowSpeed = this.hasPowerUp('railgun-piercer') && isCharged ? 1400 : baseSpeed;

      // Skyfall Barrage: if firing high upward
      if (this.hasPowerUp('skyfall-barrage') && aimDirY < -0.7) {
        for (let i = 0; i < 5; i++) {
          setTimeout(() => {
            if (!this.isAlive) return;
            projectiles.push(new Projectile({
              x: this.x + (i - 2) * 80 + (Math.random() - 0.5) * 40,
              y: -50,
              vx: (Math.random() - 0.5) * 40,
              vy: 750,
              ownerIndex: this.index,
              damage: 1,
              type: 'skyfall-arrow',
              color: '#4361ee'
            }));
          }, 400 + i * 150);
        }
      }

      // Triple Volley spread
      if (this.hasPowerUp('triple-volley')) {
        const angles = [-0.18, 0, 0.18];
        for (const spreadAngle of angles) {
          const ca = Math.cos(spreadAngle);
          const sa = Math.sin(spreadAngle);
          const rx = aimDirX * ca - aimDirY * sa;
          const ry = aimDirX * sa + aimDirY * ca;

          this.spawnArrow(rx, ry, arrowSpeed, isCharged, projectiles);
        }
      } else {
        this.spawnArrow(aimDirX, aimDirY, arrowSpeed, isCharged, projectiles);
      }

      this.bowDrawCharge = 0;
    }
  }

  private spawnArrow(
    dirX: number,
    dirY: number,
    speed: number,
    isCharged: boolean,
    projectiles: Projectile[]
  ): void {
    const isRailgun = this.hasPowerUp('railgun-piercer') && isCharged;
    const isBouncy = this.hasPowerUp('ricochet-trickshot') ? 3 : 0;

    projectiles.push(new Projectile({
      x: this.x + dirX * 18,
      y: this.y + dirY * 18,
      vx: dirX * speed,
      vy: dirY * speed,
      ownerIndex: this.index,
      damage: 1,
      type: 'arrow',
      isCharged,
      bouncesLeft: isBouncy,
      isHoming: this.hasPowerUp('seeker-arrows'),
      isExplosive: this.hasPowerUp('explosive-payload'),
      isPiercing: isRailgun,
      isFrost: this.hasPowerUp('frostbite-quiver'),
      isGrapple: this.hasPowerUp('grapple-arrow'),
      isShrapnel: this.hasPowerUp('split-shrapnel'),
      color: isRailgun ? '#fee440' : (this.hasPowerUp('frostbite-quiver') ? '#a0c4ff' : (this.hasPowerUp('explosive-payload') ? '#ff4d6d' : '#f8fafc')),
      hasGravity: !isRailgun
    }));
  }

  public takeDamage(
    amount: number,
    knockbackX: number,
    knockbackY: number,
    sound: SoundEngine,
    particles: ParticleSystem,
    attacker?: Player
  ): void {
    if (!this.isAlive || this.isInvulnerable) return;

    this.health = Math.max(0, this.health - amount);
    this.vx = knockbackX;
    this.vy = knockbackY;
    this.isInvulnerable = true;
    this.invulnerableTimer = 0.45;

    sound.playHitImpact();
    particles.emitSparks(this.x, this.y, 14, '#ff4d6d');

    if (attacker) {
      attacker.stats.damageDealt += amount;
    }

    if (this.health <= 0) {
      this.isAlive = false;
      this.stats.deaths++;
      sound.playExplosion();
      particles.emitExplosion(this.x, this.y, 40);

      if (attacker && attacker.index !== this.index) {
        attacker.stats.kills++;
      }
    }
  }

  private updateCollisions(
    dt: number,
    platforms: Platform[],
    hazards: HazardZone[],
    sound: SoundEngine,
    particles: ParticleSystem
  ): void {
    this.isGrounded = false;
    this.isTouchingWallLeft = false;
    this.isTouchingWallRight = false;
    this.isWallSliding = false;

    // Movement step
    this.x += this.vx * dt;

    // Horizontal platform collisions
    const halfW = this.width * 0.5;
    const halfH = this.height * 0.5;

    for (const plat of platforms) {
      if (plat.oneWay) continue; // One-way platforms don't block sides

      if (
        this.y + halfH > plat.y &&
        this.y - halfH < plat.y + plat.h
      ) {
        if (this.vx > 0 && this.x + halfW > plat.x && this.x - halfW < plat.x) {
          this.x = plat.x - halfW;
          this.vx = 0;
          this.isTouchingWallRight = true;
        } else if (this.vx < 0 && this.x - halfW < plat.x + plat.w && this.x + halfW > plat.x + plat.w) {
          this.x = plat.x + plat.w + halfW;
          this.vx = 0;
          this.isTouchingWallLeft = true;
        }
      }
    }

    // Vertical movement
    this.y += this.vy * dt;

    // Vertical platform collisions
    for (const plat of platforms) {
      const px = this.x;
      const py = this.y + halfH;
      const prevPy = py - this.vy * dt;

      if (
        px + halfW * 0.8 > plat.x &&
        px - halfW * 0.8 < plat.x + plat.w
      ) {
        // Landing on top
        if (this.vy >= 0 && prevPy <= plat.y + 6 && py >= plat.y) {
          if (plat.oneWay && this.dropThroughTimer > 0) {
            continue; // Dropping through
          }

          this.y = plat.y - halfH;
          this.isGrounded = true;

          // Bouncy pad
          if (plat.bouncy) {
            this.vy = -540 * plat.bouncy;
            sound.playJump();
            particles.emitDust(this.x, this.y + halfH, 10);
          } else {
            this.vy = 0;
          }

          // Speed booster
          if (plat.speedBoost) {
            this.vx = plat.speedBoost;
          }

          // Crumbling platform
          if (plat.crumble && plat.crumbleState === 'solid') {
            plat.crumbleState = 'shaking';
            plat.crumbleTimer = 0.6;
          }

          break;
        }

        // Hitting ceiling
        if (!plat.oneWay && this.vy < 0 && this.y - halfH <= plat.y + plat.h && prevPy - this.height >= plat.y + plat.h - 6) {
          this.y = plat.y + plat.h + halfH;
          this.vy = 0;
        }
      }
    }

    // Wall slide check
    if (!this.isGrounded && (this.isTouchingWallLeft || this.isTouchingWallRight) && this.vy > 0) {
      this.isWallSliding = true;
      this.vy = Math.min(this.vy, 140); // Slow slide
      if (Math.random() < 0.25) {
        particles.emitDust(this.isTouchingWallLeft ? this.x - halfW : this.x + halfW, this.y, 2);
      }
    }

    // Hazards check (Lava, Spikes, Laser, Acid)
    for (const h of hazards) {
      if (!h.active) continue;
      if (
        this.x + halfW > h.x &&
        this.x - halfW < h.x + h.w &&
        this.y + halfH > h.y &&
        this.y - halfH < h.y + h.h
      ) {
        this.takeDamage(h.damage, 0, -320, sound, particles);
      }
    }
  }

  public render(ctx: CanvasRenderingContext2D): void {
    if (!this.isAlive) return;

    ctx.save();
    ctx.translate(this.x, this.y);

    // Invulnerability flicker
    if (this.isInvulnerable && Math.floor(this.animTimer * 24) % 2 === 0) {
      ctx.globalAlpha = 0.4;
    }

    // Facing direction
    if (this.facingLeft) {
      ctx.scale(-1, 1);
    }

    // Draw Parrying Shield Bubble
    if (this.isParrying) {
      ctx.save();
      ctx.strokeStyle = '#ffd166';
      ctx.fillStyle = 'rgba(255, 209, 102, 0.25)';
      ctx.lineWidth = 3;
      ctx.shadowColor = '#ffd166';
      ctx.shadowBlur = 14;
      ctx.beginPath();
      ctx.arc(0, 0, 32, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    // Draw Frozen Block if frozen
    if (this.freezeTimer > 0) {
      ctx.fillStyle = 'rgba(160, 196, 255, 0.6)';
      ctx.strokeStyle = '#caf0f8';
      ctx.lineWidth = 2;
      ctx.fillRect(-18, -26, 36, 52);
      ctx.strokeRect(-18, -26, 36, 52);
    }

    // Character Cape
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.moveTo(-4, -12);
    ctx.lineTo(-14, 14);
    ctx.lineTo(-4, 10);
    ctx.closePath();
    ctx.fill();

    // Body Armor
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(-10, -14, 20, 26);

    // Tunic Color Stripe
    ctx.fillStyle = this.color;
    ctx.fillRect(-7, -12, 14, 22);

    // Helmet / Head
    ctx.fillStyle = '#475569';
    ctx.beginPath();
    ctx.arc(0, -18, 9, 0, Math.PI * 2);
    ctx.fill();

    // Visor / Glowing eyes
    ctx.fillStyle = this.isCpu ? '#06d6a0' : '#ffd166';
    ctx.fillRect(2, -20, 5, 3);

    // Weapon in hand
    if (this.currentWeapon === 'sword') {
      // Sword blade
      ctx.save();
      const slashAngle = this.isAttacking ? 0.8 : (this.isDownThrusting ? 1.57 : -0.4);
      ctx.rotate(slashAngle);

      // Guard
      ctx.fillStyle = '#d4af37';
      ctx.fillRect(8, -3, 4, 10);

      // Steel blade
      ctx.fillStyle = this.hasPowerUp('titan-cleaver') ? '#f77f00' : '#f8fafc';
      const bladeLen = this.hasPowerUp('titan-cleaver') ? 38 : 24;
      const bladeW = this.hasPowerUp('titan-cleaver') ? 7 : 4;
      ctx.fillRect(12, -bladeW * 0.5, bladeLen, bladeW);
      ctx.restore();
    } else {
      // Bow
      ctx.save();
      ctx.strokeStyle = '#b45309';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(10, 0, 14, -Math.PI * 0.45, Math.PI * 0.45);
      ctx.stroke();

      // Bowstring
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(10 + Math.cos(-Math.PI * 0.45) * 14, Math.sin(-Math.PI * 0.45) * 14);
      const pullX = 10 - this.bowDrawCharge * 12;
      ctx.lineTo(pullX, 0);
      ctx.lineTo(10 + Math.cos(Math.PI * 0.45) * 14, Math.sin(Math.PI * 0.45) * 14);
      ctx.stroke();
      ctx.restore();
    }

    // Feet / Boots
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(-8, 12, 6, 8);
    ctx.fillRect(2, 12, 6, 8);

    // Overhead Player Indicator (P1/P2/P3/P4)
    ctx.restore();

    ctx.save();
    ctx.translate(this.x, this.y - 34);
    ctx.fillStyle = this.color;
    ctx.font = 'bold 11px Outfit, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`P${this.index + 1}`, 0, 0);

    // Aim Trajectory Line for Bow
    if (this.currentWeapon === 'bow' && this.isDrawingBow) {
      ctx.strokeStyle = 'rgba(255, 209, 102, 0.45)';
      ctx.setLineDash([4, 4]);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(0, 34);
      const aimDirX = (this.facingLeft ? -1 : 1);
      ctx.lineTo(aimDirX * 120, 34);
      ctx.stroke();
    }

    ctx.restore();
  }
}
