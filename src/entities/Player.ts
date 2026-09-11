import { PlayerInputState } from '../core/InputManager';
import { Platform, HazardZone, MapBoundaryType } from '../maps/MapTypes';
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
  private boundaryDamageCooldown: number = 0;

  // Jump feel
  private jumpBufferTimer: number = 0;
  private coyoteTimer: number = 0;
  private jumpsRemaining: number = 2;
  private dropThroughTimer: number = 0;
  public get jumpsLeft(): number { return this.jumpsRemaining; }

  // Dash feel
  public isDashing: boolean = false;
  private dashTimer: number = 0;
  private dashCooldown: number = 0;
  public get canDash(): boolean { return this.dashCooldown <= 0 && !this.isDashing; }
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

  // Aiming Direction
  public aimDirX: number = 1;
  public aimDirY: number = 0;

  // Visual & Animation Polish
  public squashX: number = 1.0;
  public squashY: number = 1.0;
  public capeNodes: { x: number; y: number }[] = [];
  public hitFlashTimer: number = 0;
  public parrySparkleTimer: number = 0;

  // Melee Combo System
  public comboStep: number = 0; // 0 = idle, 1 = quick slash, 2 = cross cut, 3 = finisher thrust
  public comboResetTimer: number = 0;

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
    this.dropThroughTimer = 0;
    this.jumpBufferTimer = 0;
    this.coyoteTimer = 0;
    this.isDownThrusting = false;
    this.isGrounded = false;
    this.isWallSliding = false;
    this.isTouchingWallLeft = false;
    this.isTouchingWallRight = false;
    this.weaponSwitchCooldown = 0;
    this.ammoRegenTimer = 0;

    // Aim & animation reset
    this.aimDirX = this.facingLeft ? -1 : 1;
    this.aimDirY = 0;
    this.squashX = 1.0;
    this.squashY = 1.0;
    this.hitFlashTimer = 0;
    this.parrySparkleTimer = 0;
    this.comboStep = 0;
    this.comboResetTimer = 0;
    this.capeNodes = [
      { x: spawnX, y: spawnY },
      { x: spawnX, y: spawnY + 6 },
      { x: spawnX, y: spawnY + 14 },
      { x: spawnX, y: spawnY + 22 }
    ];
  }

  public hasPowerUp(id: string): boolean {
    return !!this.powerUps[id];
  }

  public getArrowSpeed(isCharged: boolean, drawProgress: number = 1.0): number {
    if (this.hasPowerUp('railgun-piercer') && isCharged) {
      return 1400;
    }
    const chargeFactor = Math.min(1.0, Math.max(0, (drawProgress - 0.1) / 0.75));
    const minSpeed = 620;
    const maxSpeed = 920;
    return minSpeed + chargeFactor * (maxSpeed - minSpeed);
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
    boundaryType: MapBoundaryType = 'solid',
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

    // Squash and stretch restoration
    this.squashX += (1.0 - this.squashX) * Math.min(1.0, 14 * dt);
    this.squashY += (1.0 - this.squashY) * Math.min(1.0, 14 * dt);

    // Hit flash and parry sparkle timers
    if (this.hitFlashTimer > 0) this.hitFlashTimer -= dt;
    if (this.parrySparkleTimer > 0) this.parrySparkleTimer -= dt;

    // Combo reset timer
    if (this.comboResetTimer > 0) {
      this.comboResetTimer -= dt;
      if (this.comboResetTimer <= 0) {
        this.comboStep = 0;
      }
    }

    // Cooldown timers
    if (this.weaponSwitchCooldown > 0) this.weaponSwitchCooldown -= dt;
    if (this.attackCooldown > 0) this.attackCooldown -= dt;
    if (this.parryCooldown > 0) this.parryCooldown -= dt;
    if (this.dashCooldown > 0) this.dashCooldown -= dt;
    if (this.dropThroughTimer > 0) this.dropThroughTimer -= dt;
    if (this.boundaryDamageCooldown > 0) this.boundaryDamageCooldown -= dt;

    // Dynamic Physics Cape simulation
    if (this.capeNodes.length === 0) {
      this.capeNodes = [
        { x: this.x, y: this.y },
        { x: this.x, y: this.y + 6 },
        { x: this.x, y: this.y + 14 },
        { x: this.x, y: this.y + 22 }
      ];
    }
    const anchorX = this.x - (this.facingLeft ? -6 : 6);
    const anchorY = this.y - 10;
    this.capeNodes[0].x = anchorX;
    this.capeNodes[0].y = anchorY;

    for (let i = 1; i < this.capeNodes.length; i++) {
      const prev = this.capeNodes[i - 1];
      const cur = this.capeNodes[i];
      const segmentLen = 7;

      let windOffsetX = (this.facingLeft ? 1 : -1) * 3;
      if (this.isDashing) {
        windOffsetX = (this.facingLeft ? 1 : -1) * 22;
      } else {
        windOffsetX += -(this.vx * 0.035);
      }

      const targetX = prev.x + windOffsetX;
      const targetY = prev.y + segmentLen + Math.max(-4, this.vy * 0.015);

      cur.x += (targetX - cur.x) * Math.min(1.0, 22 * dt);
      cur.y += (targetY - cur.y) * Math.min(1.0, 22 * dt);
    }

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
          this.squashX = 0.82;
          this.squashY = 1.26;
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
          this.squashX = 0.84;
          this.squashY = 1.24;
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
    this.updateCollisions(dt, platforms, hazards, sound, particles, boundaryType);

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
            particles.emitCombatText(this.x, this.y - 24, 'PARRY!', '#ffd166', 16);
            particles.emitDirectionalSparks(this.x, this.y, -proj.vx, -proj.vy, 18, '#ffd166');
            this.parrySparkleTimer = 0.35;
            this.stats.parries++;
          }
        }
      }

      if (this.parryTimer <= 0) {
        this.isParrying = false;
      }
    }

    // 2. Sword Attack Trigger
    if (input.attackJustPressed && this.attackCooldown <= 0 && !this.isParrying) {
      this.isAttacking = true;

      // Aerial Down-thrust check
      const isDownThrust = !this.isGrounded && input.down;
      if (isDownThrust) {
        this.isDownThrusting = true;
        this.comboStep = 0;
        this.comboResetTimer = 0;
        this.attackTimer = 0.22;
        this.attackCooldown = 0.26;
        this.vy = Math.max(this.vy, 680); // Fast fall pogo
        sound.playSwordSwing(1.4);
        particles.createSlashArc(this.x, this.y + 12, 36, this.facingLeft, '#00f5d4', 'downthrust');
      } else {
        this.isDownThrusting = false;
        // 3-Hit Melee Combo Chain
        if (this.comboResetTimer > 0 && this.comboStep === 1) {
          // Combo 2: Cross Slash
          this.comboStep = 2;
          this.comboResetTimer = 0.44;
          this.attackTimer = 0.16;
          this.attackCooldown = this.hasPowerUp('blade-flurry') ? 0.12 : 0.24;
          this.vx += (this.facingLeft ? -1 : 1) * 140; // Forward cross step
          sound.playSwordSwing(1.3);
          const arcRadius = this.hasPowerUp('titan-cleaver') ? 60 : 38;
          particles.createSlashArc(
            this.x + (this.facingLeft ? -18 : 18),
            this.y,
            arcRadius,
            this.facingLeft,
            this.hasPowerUp('titan-cleaver') ? '#f77f00' : '#4cc9f0',
            'slash2'
          );
        } else if (this.comboResetTimer > 0 && this.comboStep === 2) {
          // Combo 3: Finisher Thrust / Cleave
          this.comboStep = 3;
          this.comboResetTimer = 0; // Finisher concludes combo
          this.attackTimer = 0.24;
          this.attackCooldown = this.hasPowerUp('blade-flurry') ? 0.20 : 0.38;
          this.vx += (this.facingLeft ? -1 : 1) * 240; // Heavy forward lunge
          sound.playComboFinisher();
          const arcRadius = this.hasPowerUp('titan-cleaver') ? 72 : 46;
          particles.createSlashArc(
            this.x + (this.facingLeft ? -22 : 22),
            this.y,
            arcRadius,
            this.facingLeft,
            this.hasPowerUp('titan-cleaver') ? '#ff5400' : '#ffd166',
            'finisher'
          );
          particles.emitCombatText(this.x, this.y - 28, 'FINISHER!', '#ffd166', 15);
          particles.emitSparks(this.x + (this.facingLeft ? -25 : 25), this.y, 10, '#ffd166');
        } else {
          // Combo 1: Quick Slash
          this.comboStep = 1;
          this.comboResetTimer = 0.46;
          this.attackTimer = 0.14;
          this.attackCooldown = this.hasPowerUp('blade-flurry') ? 0.10 : 0.20;
          this.vx += (this.facingLeft ? -1 : 1) * 70; // Subtle forward step
          sound.playSwordSwing(1.0);
          const arcRadius = this.hasPowerUp('titan-cleaver') ? 56 : 36;
          particles.createSlashArc(
            this.x + (this.facingLeft ? -15 : 15),
            this.y,
            arcRadius,
            this.facingLeft,
            this.hasPowerUp('titan-cleaver') ? '#f77f00' : '#f72585',
            'slash1'
          );
        }
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
      const isFinisher = this.comboStep === 3;
      const hitReach = this.hasPowerUp('titan-cleaver') ? (isFinisher ? 78 : 65) : (isFinisher ? 52 : 42);
      const hitX = this.x + (this.facingLeft ? -hitReach * 0.5 : hitReach * 0.5);
      const hitY = this.y;

      for (const other of allPlayers) {
        if (other.index !== this.index && other.isAlive) {
          const dx = Math.abs(other.x - hitX);
          const dy = Math.abs(other.y - hitY);
          if (dx < hitReach && dy < 38) {
            // Check if opponent is parrying
            if (other.isParrying && !this.hasPowerUp('titan-cleaver')) {
              // Parried! Attacker gets stunned and staggered
              this.vx = (this.facingLeft ? 1 : -1) * 360;
              this.vy = -200;
              this.attackCooldown = 0.52;
              this.comboStep = 0;
              this.comboResetTimer = 0;
              sound.playStagger();
              particles.emitSparks(hitX, hitY, 18, '#ffd166');
              particles.emitCombatText(this.x, this.y - 20, 'STAGGERED!', '#ef476f', 15);
              particles.emitCombatText(other.x, other.y - 20, 'PARRIED!', '#ffd166', 15);
              other.stats.parries++;
            } else {
              // Direct hit!
              const baseDamage = isFinisher ? 2 : 1;
              const bonusDamage = this.hasPowerUp('titan-cleaver') ? 1 : 0;
              const totalDamage = baseDamage + bonusDamage;

              let kbSpeedX = this.hasPowerUp('titan-cleaver') ? 600 : 380;
              let kbSpeedY = -240;
              if (isFinisher) {
                kbSpeedX *= 1.45;
                kbSpeedY = -340;
              }
              const kbX = (this.facingLeft ? -1 : 1) * kbSpeedX;

              // Down-thrust pogo bounce off enemy head!
              if (this.isDownThrusting && this.y < other.y - 8) {
                this.vy = -540;
                this.jumpsRemaining = Math.max(1, this.jumpsRemaining);
                this.isDownThrusting = false;
                sound.playPogoBounce();
                particles.emitCombatText(this.x, this.y - 22, 'POGO!', '#00f5d4', 16);
                particles.emitSparks(this.x, this.y + 20, 16, '#00f5d4');
                particles.emitDust(this.x, this.y + 15, 8);
                this.squashX = 0.8;
                this.squashY = 1.3;
              }

              other.takeDamage(totalDamage, kbX, kbSpeedY, sound, particles, this);

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
                  particles.emitCombatText(this.x, this.y - 18, '+1 HP', '#06d6a0', 14);
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

    // Update real-time aim vector
    const rawAimX = input.aimX;
    const rawAimY = input.aimY;
    const aimMag = Math.hypot(rawAimX, rawAimY);

    if (aimMag >= 0.2) {
      this.aimDirX = rawAimX / aimMag;
      this.aimDirY = rawAimY / aimMag;
      // Face aiming direction if horizontal component is significant
      if (Math.abs(this.aimDirX) > 0.15) {
        this.facingLeft = this.aimDirX < 0;
      }
    } else if (!this.isDrawingBow && (input.left || input.right)) {
      // While running normally without aiming, face forward
      this.aimDirX = this.facingLeft ? -1 : 1;
      this.aimDirY = 0;
    }
    // NOTE: When drawing bow, aimDir remains firmly locked to the last aimed vector,
    // preventing the aim from erroneously snapping to horizontal when keys/sticks are released!

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

      const arrowSpeed = this.getArrowSpeed(isCharged, this.bowDrawCharge);

      // Skyfall Barrage: if firing high upward
      if (this.hasPowerUp('skyfall-barrage') && this.aimDirY < -0.7) {
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
          const rx = this.aimDirX * ca - this.aimDirY * sa;
          const ry = this.aimDirX * sa + this.aimDirY * ca;

          this.spawnArrow(rx, ry, arrowSpeed, isCharged, projectiles);
        }
      } else {
        this.spawnArrow(this.aimDirX, this.aimDirY, arrowSpeed, isCharged, projectiles);
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
      x: this.x + dirX * 20,
      y: this.y + dirY * 20 - 4,
      vx: dirX * speed,
      vy: dirY * speed,
      ownerIndex: this.index,
      damage: isCharged ? 2 : 1,
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
    this.hitFlashTimer = 0.24;

    sound.playHitImpact();
    particles.emitSparks(this.x, this.y, 14, '#ff4d6d');
    particles.emitCombatText(this.x, this.y - 18, `-${amount}`, '#ef476f', 16);

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
    particles: ParticleSystem,
    boundaryType: MapBoundaryType = 'solid'
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

    // Outer Arena Boundary Collisions
    if (boundaryType === 'solid') {
      if (this.x - halfW < 20) {
        if (this.vx < -280) {
          sound.playWallHit();
          particles.emitDust(20, this.y, 4);
        }
        this.x = 20 + halfW;
        this.vx = 0;
        this.isTouchingWallLeft = true;
      } else if (this.x + halfW > 1260) {
        if (this.vx > 280) {
          sound.playWallHit();
          particles.emitDust(1260, this.y, 4);
        }
        this.x = 1260 - halfW;
        this.vx = 0;
        this.isTouchingWallRight = true;
      }
    } else if (boundaryType === 'hazard') {
      if (this.x - halfW <= 22) {
        this.x = 22 + halfW;
        if (this.boundaryDamageCooldown <= 0) {
          this.boundaryDamageCooldown = 0.5;
          this.takeDamage(1, 460, -220, sound, particles);
          sound.playHazardShock();
          particles.emitCombatText(this.x, this.y - 20, 'SHOCK!', '#ff5400', 16);
          particles.emitDirectionalSparks(this.x, this.y, 1, 0, 16, '#ff9e00');
        } else {
          this.vx = Math.max(this.vx, 260);
        }
      } else if (this.x + halfW >= 1258) {
        this.x = 1258 - halfW;
        if (this.boundaryDamageCooldown <= 0) {
          this.boundaryDamageCooldown = 0.5;
          this.takeDamage(1, -460, -220, sound, particles);
          sound.playHazardShock();
          particles.emitCombatText(this.x, this.y - 20, 'SHOCK!', '#ff5400', 16);
          particles.emitDirectionalSparks(this.x, this.y, -1, 0, 16, '#ff9e00');
        } else {
          this.vx = Math.min(this.vx, -260);
        }
      }
    } else if (boundaryType === 'bouncy') {
      if (this.x - halfW <= 24 && this.vx <= 0) {
        this.x = 24 + halfW;
        const bounceSpeed = Math.max(580, Math.abs(this.vx) * 1.6);
        this.vx = bounceSpeed;
        this.facingLeft = false;
        this.squashX = 0.65;
        this.squashY = 1.35;
        sound.playWallBounce();
        particles.emitDirectionalSparks(this.x, this.y, 1, (Math.random() - 0.5) * 0.4, 14, '#00f5d4');
        particles.emitCombatText(this.x + 20, this.y - 15, 'BOUNCE!', '#00f5d4', 15);
      } else if (this.x + halfW >= 1256 && this.vx >= 0) {
        this.x = 1256 - halfW;
        const bounceSpeed = Math.max(580, Math.abs(this.vx) * 1.6);
        this.vx = -bounceSpeed;
        this.facingLeft = true;
        this.squashX = 0.65;
        this.squashY = 1.35;
        sound.playWallBounce();
        particles.emitDirectionalSparks(this.x, this.y, -1, (Math.random() - 0.5) * 0.4, 14, '#00f5d4');
        particles.emitCombatText(this.x - 20, this.y - 15, 'BOUNCE!', '#00f5d4', 15);
      }
    } else if (boundaryType === 'updraft') {
      if (this.x <= 75) {
        this.vy = Math.min(this.vy, -600);
        this.vx += 220 * dt;
        this.jumpsRemaining = Math.max(1, this.jumpsRemaining);
        if (Math.random() < 0.4) {
          particles.emitSparks(this.x + (Math.random() - 0.5) * 16, this.y + 15, 1, '#90e0ef');
        }
        if (this.x < -40) this.x = -40;
      } else if (this.x >= 1205) {
        this.vy = Math.min(this.vy, -600);
        this.vx -= 220 * dt;
        this.jumpsRemaining = Math.max(1, this.jumpsRemaining);
        if (Math.random() < 0.4) {
          particles.emitSparks(this.x + (Math.random() - 0.5) * 16, this.y + 15, 1, '#90e0ef');
        }
        if (this.x > 1320) this.x = 1320;
      }
    } else if (boundaryType === 'portal') {
      if (this.x <= -12) {
        this.x = 1262;
        sound.playPortalWarp();
        particles.emitSparks(1262, this.y, 14, '#c77dff');
        particles.emitSparks(-12, this.y, 14, '#c77dff');
        for (const n of this.capeNodes) n.x += 1274;
      } else if (this.x >= 1292) {
        this.x = 18;
        sound.playPortalWarp();
        particles.emitSparks(18, this.y, 14, '#c77dff');
        particles.emitSparks(1292, this.y, 14, '#c77dff');
        for (const n of this.capeNodes) n.x -= 1274;
      }
    } else if (boundaryType === 'open') {
      if (this.x < -200) { this.x = -200; this.vx = 0; }
      if (this.x > 1480) { this.x = 1480; this.vx = 0; }
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

          const impactVy = this.vy;
          this.y = plat.y - halfH;
          this.isGrounded = true;

          // Landing squash & compression dust
          if (impactVy > 240) {
            this.squashX = 1.25;
            this.squashY = 0.78;
            particles.emitDust(this.x, this.y + halfH, 5);
          }

          // Down-thrust ground impact shockwave
          if (this.isDownThrusting) {
            particles.emitDust(this.x, this.y + halfH, 14);
            particles.emitSparks(this.x, this.y + halfH, 8, '#ffd166');
            sound.playHitImpact();
            this.squashX = 1.35;
            this.squashY = 0.70;
            this.isDownThrusting = false;
          }

          // Bouncy pad
          if (plat.bouncy) {
            this.vy = -540 * plat.bouncy;
            this.squashX = 0.78;
            this.squashY = 1.32;
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

  public render(
    ctx: CanvasRenderingContext2D,
    platforms: Platform[] = [],
    gravityMultiplier: number = 1.0,
    allPlayers: Player[] = [],
    boundaryType: MapBoundaryType = 'solid'
  ): void {
    if (!this.isAlive) return;

    // 1. Render Physics Cloth Cape (World Coordinates)
    if (this.capeNodes.length >= 2) {
      ctx.save();
      ctx.fillStyle = this.color;
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(this.capeNodes[0].x, this.capeNodes[0].y);
      for (let i = 1; i < this.capeNodes.length; i++) {
        ctx.lineTo(this.capeNodes[i].x, this.capeNodes[i].y);
      }
      const last = this.capeNodes[this.capeNodes.length - 1];
      const flairDir = this.facingLeft ? 1 : -1;
      ctx.lineTo(last.x + flairDir * 7, last.y - 2);
      for (let i = this.capeNodes.length - 2; i >= 0; i--) {
        ctx.lineTo(this.capeNodes[i].x + flairDir * (4 + i * 2), this.capeNodes[i].y - 2);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    // 2. Character Body Transform with Squash & Stretch
    ctx.save();
    ctx.translate(this.x, this.y);

    // Invulnerability flicker
    if (this.isInvulnerable && Math.floor(this.animTimer * 24) % 2 === 0) {
      ctx.globalAlpha = 0.45;
    }

    // Direction flip and squash & stretch deformation
    const flipX = this.facingLeft ? -1 : 1;
    ctx.scale(flipX * this.squashX, this.squashY);

    // Dynamic Running Leg Cycle & Torso Bob
    let frontFootX = 2;
    let frontFootY = 12;
    let backFootX = -8;
    let backFootY = 12;
    let bobY = 0;

    if (this.isGrounded && Math.abs(this.vx) > 20) {
      const legPhase = Math.sin(this.animTimer * 18);
      const swing = legPhase * 7;
      frontFootX = 2 + swing;
      frontFootY = 12 + Math.max(0, -swing * 0.4);
      backFootX = -8 - swing;
      backFootY = 12 + Math.max(0, swing * 0.4);
      bobY = Math.abs(legPhase) * 2;
    } else if (!this.isGrounded) {
      if (this.vy < 0) {
        frontFootX = 2;
        frontFootY = 9;
        backFootX = -8;
        backFootY = 13;
      } else {
        frontFootX = 1;
        frontFootY = 14;
        backFootX = -7;
        backFootY = 14;
      }
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
      ctx.arc(0, -bobY, 32, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    // Draw Frozen Block if frozen
    if (this.freezeTimer > 0) {
      ctx.fillStyle = 'rgba(160, 196, 255, 0.6)';
      ctx.strokeStyle = '#caf0f8';
      ctx.lineWidth = 2;
      ctx.fillRect(-18, -26 - bobY, 36, 52);
      ctx.strokeRect(-18, -26 - bobY, 36, 52);
    }

    // Draw Boots / Feet
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(backFootX, backFootY, 6, 8);
    ctx.fillRect(frontFootX, frontFootY, 6, 8);

    // 3. Back Leather Quiver & Dynamic Physical Arrows
    ctx.fillStyle = '#78350f';
    ctx.fillRect(-12, -7 - bobY, 6, 17);
    ctx.strokeStyle = '#92400e';
    ctx.lineWidth = 1;
    ctx.strokeRect(-12, -7 - bobY, 6, 17);

    if (this.hasPowerUp('infinite-quiver')) {
      // Mystic glowing runic arrows
      ctx.save();
      ctx.shadowColor = '#00f5d4';
      ctx.shadowBlur = 8;
      for (let a = 0; a < 3; a++) {
        ctx.strokeStyle = '#00f5d4';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-11 + a * 2, -6 - bobY);
        ctx.lineTo(-13 + a * 2, -15 - bobY);
        ctx.stroke();
        ctx.fillStyle = '#f72585';
        ctx.fillRect(-14 + a * 2, -16 - bobY, 3, 3);
      }
      ctx.restore();
    } else {
      const visibleArrows = Math.min(3, Math.max(0, this.quiverAmmo));
      for (let a = 0; a < visibleArrows; a++) {
        ctx.strokeStyle = '#d4a373';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(-11 + a * 2, -6 - bobY);
        ctx.lineTo(-13 + a * 2, -14 - bobY);
        ctx.stroke();
        // Feather fletching
        ctx.fillStyle = a === 0 ? '#ef476f' : (a === 1 ? '#ffd166' : '#118ab2');
        ctx.fillRect(-14 + a * 2, -15 - bobY, 3, 3);
      }
    }

    // 4. Body Armor & Tunic with Bobbing
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(-10, -14 - bobY, 20, 26);
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1;
    ctx.strokeRect(-10, -14 - bobY, 20, 26);

    // Tunic Color Stripe
    ctx.fillStyle = this.color;
    ctx.fillRect(-7, -12 - bobY, 14, 22);

    // Gold belt buckle
    ctx.fillStyle = '#d4af37';
    ctx.fillRect(-3, 6 - bobY, 6, 4);

    // 5. Helmet & Expressive Visor Eyes
    ctx.fillStyle = '#475569';
    ctx.beginPath();
    ctx.arc(0, -18 - bobY, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Visor / Glowing eyes with hit-flash and bow-draw tension
    let eyeColor = this.isCpu ? '#06d6a0' : '#ffd166';
    let eyeH = 3;
    let eyeY = -20 - bobY;

    if (this.hitFlashTimer > 0) {
      eyeColor = '#ff0054';
    } else if (this.parrySparkleTimer > 0 || this.isParrying) {
      eyeColor = '#ffffff';
    } else if (this.isDrawingBow) {
      // Acute focused slit
      eyeH = 1.5;
      eyeY = -19 - bobY;
    }

    ctx.save();
    if (this.parrySparkleTimer > 0 || this.isParrying) {
      ctx.shadowColor = '#ffd166';
      ctx.shadowBlur = 10;
    }
    ctx.fillStyle = eyeColor;
    ctx.fillRect(2, eyeY, 5, eyeH);
    ctx.restore();

    // 6. Weapons & Dynamic Stances
    if (this.currentWeapon === 'sword') {
      ctx.save();
      let slashAngle = -0.4;
      if (this.isDownThrusting) {
        slashAngle = 1.57; // Pointed straight down
      } else if (this.isAttacking) {
        if (this.comboStep === 1) slashAngle = 0.75;
        else if (this.comboStep === 2) slashAngle = -0.7;
        else if (this.comboStep === 3) slashAngle = 1.65;
        else slashAngle = 0.8;
      }
      ctx.rotate(slashAngle);

      // Guard
      ctx.fillStyle = '#d4af37';
      ctx.fillRect(8, -3, 4, 10);

      // Steel blade
      const isFinisher = this.comboStep === 3 && this.isAttacking;
      const bladeColor = isFinisher ? '#ffd166' : (this.hasPowerUp('titan-cleaver') ? '#f77f00' : '#f8fafc');
      ctx.fillStyle = bladeColor;
      const bladeLen = this.hasPowerUp('titan-cleaver') ? 38 : (isFinisher ? 30 : 24);
      const bladeW = this.hasPowerUp('titan-cleaver') ? 7 : (isFinisher ? 6 : 4);

      if (isFinisher) {
        ctx.shadowColor = '#ffd166';
        ctx.shadowBlur = 8;
      }
      ctx.fillRect(12, -bladeW * 0.5, bladeLen, bladeW);
      ctx.restore();
    } else {
      // Bow
      ctx.save();
      // Rotate bow towards real-time aiming angle
      const aimAngle = Math.atan2(this.aimDirY, Math.abs(this.aimDirX));
      ctx.rotate(aimAngle);

      ctx.strokeStyle = '#b45309';
      ctx.lineWidth = 3;
      ctx.beginPath();
      // Arch curvature flexes with draw charge
      const archCurve = 0.45 + this.bowDrawCharge * 0.15;
      ctx.arc(10, -bobY, 14, -Math.PI * archCurve, Math.PI * archCurve);
      ctx.stroke();

      // Bowstring
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(10 + Math.cos(-Math.PI * archCurve) * 14, -bobY + Math.sin(-Math.PI * archCurve) * 14);
      const pullX = 10 - this.bowDrawCharge * 13;
      ctx.lineTo(pullX, -bobY);
      ctx.lineTo(10 + Math.cos(Math.PI * archCurve) * 14, -bobY + Math.sin(Math.PI * archCurve) * 14);
      ctx.stroke();

      // Nocked arrow if drawing
      if (this.isDrawingBow) {
        ctx.fillStyle = '#d4a373';
        ctx.fillRect(pullX, -1 - bobY, 18, 2);
        ctx.fillStyle = this.bowDrawCharge >= 0.85 ? '#ffd166' : '#f8fafc';
        ctx.fillRect(pullX + 17, -2 - bobY, 4, 4);
      }
      ctx.restore();
    }

    ctx.restore();

    // 7. Overhead Player Indicator (P1/P2/P3/P4)
    ctx.save();
    ctx.translate(this.x, this.y - 34);
    ctx.fillStyle = this.color;
    ctx.font = 'bold 11px Outfit, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`P${this.index + 1}`, 0, 0);
    ctx.restore();

    // 8. Ballistic Parabolic Trajectory Preview for Bow
    if (this.currentWeapon === 'bow' && this.isDrawingBow) {
      const isCharged = this.bowDrawCharge >= 0.85;
      const arrowSpeed = this.getArrowSpeed(isCharged, this.bowDrawCharge);
      const isRailgun = this.hasPowerUp('railgun-piercer') && isCharged;
      const grav = isRailgun ? 0 : 380 * gravityMultiplier;

      const aimDirX = this.aimDirX;
      const aimDirY = this.aimDirY;
      const startX = this.x + aimDirX * 20;
      const startY = this.y + aimDirY * 20 - 4;

      const trajectoryColor = isRailgun
        ? '#fee440'
        : (this.hasPowerUp('frostbite-quiver') ? '#a0c4ff' : (this.hasPowerUp('explosive-payload') ? '#ff4d6d' : (isCharged ? '#ffd166' : '#cbd5e1')));

      let hitGroundX: number | null = null;
      let hitGroundY: number | null = null;
      let hitTargetPlayer: Player | null = null;

      const points: { x: number; y: number }[] = [];
      const totalSteps = 100; // Increased to 100 so it spans across full arena
      const stepDt = 1 / 60; // Exact 60fps fixed timestep matching GameLoop

      let simX = startX;
      let simY = startY;
      let simVx = aimDirX * arrowSpeed;
      let simVy = aimDirY * arrowSpeed;

      points.push({ x: simX, y: simY });

      for (let s = 1; s <= totalSteps; s++) {
        if (!isRailgun) {
          simVy += grav * stepDt;
        }
        const nextX = simX + simVx * stepDt;
        const nextY = simY + simVy * stepDt;

        // 1. Check collision against alive enemy players (radius 26 matching direct hit in Game.ts)
        if (allPlayers && allPlayers.length > 0) {
          for (const other of allPlayers) {
            if (other.isAlive && other.index !== this.index && !other.isInvulnerable) {
              const d = Math.hypot(nextX - other.x, nextY - other.y);
              if (d < 26) {
                hitTargetPlayer = other;
                hitGroundX = nextX;
                hitGroundY = nextY;
                break;
              }
            }
          }
          if (hitTargetPlayer) {
            points.push({ x: hitGroundX!, y: hitGroundY! });
            break;
          }
        }

        // 2. Platform collision test (matches Game.ts point-in-rect platform test)
        if (!isRailgun && platforms && platforms.length > 0) {
          for (const plat of platforms) {
            if (nextX > plat.x && nextX < plat.x + plat.w && nextY > plat.y && nextY < plat.y + plat.h) {
              hitGroundX = nextX;
              hitGroundY = nextY;
              break;
            }
          }
          if (hitGroundX !== null && hitGroundY !== null) {
            points.push({ x: hitGroundX, y: hitGroundY });
            break;
          }
        }

        // 3. Boundary check according to boundaryType
        let hasBoundaryHit = false;
        if (boundaryType === 'solid') {
          if (nextX <= 20) {
            hitGroundX = 20;
            hitGroundY = nextY;
            points.push({ x: 20, y: nextY });
            hasBoundaryHit = true;
          } else if (nextX >= 1260) {
            hitGroundX = 1260;
            hitGroundY = nextY;
            points.push({ x: 1260, y: nextY });
            hasBoundaryHit = true;
          }
        } else if (boundaryType === 'hazard') {
          if (nextX <= 22) {
            hitGroundX = 22;
            hitGroundY = nextY;
            points.push({ x: 22, y: nextY });
            hasBoundaryHit = true;
          } else if (nextX >= 1258) {
            hitGroundX = 1258;
            hitGroundY = nextY;
            points.push({ x: 1258, y: nextY });
            hasBoundaryHit = true;
          }
        } else if (boundaryType === 'bouncy') {
          if (nextX <= 22) {
            simVx = -simVx;
            points.push({ x: 22, y: nextY });
            simX = 24;
            simY = nextY;
            continue;
          } else if (nextX >= 1258) {
            simVx = -simVx;
            points.push({ x: 1258, y: nextY });
            simX = 1256;
            simY = nextY;
            continue;
          }
        } else if (boundaryType === 'portal') {
          if (nextX < 0) {
            points.push({ x: 0, y: nextY });
            simX = 1280;
            simY = nextY;
            points.push({ x: 1280, y: nextY });
            continue;
          } else if (nextX > 1280) {
            points.push({ x: 1280, y: nextY });
            simX = 0;
            simY = nextY;
            points.push({ x: 0, y: nextY });
            continue;
          }
        } else if (boundaryType === 'updraft') {
          if (nextX < 75 || nextX > 1205) {
            simVy -= 360 * stepDt;
          }
        }

        if (hasBoundaryHit) {
          break;
        }

        // 4. Outer bounds termination
        if (nextX < -150 || nextX > 1430 || nextY > 750 || nextY < -200) {
          hitGroundX = nextX;
          hitGroundY = nextY;
          points.push({ x: nextX, y: nextY });
          break;
        }

        simX = nextX;
        simY = nextY;
        points.push({ x: simX, y: simY });
      }

      ctx.save();
      ctx.shadowColor = trajectoryColor;
      ctx.shadowBlur = isCharged ? 9 : 4;
      ctx.fillStyle = trajectoryColor;

      // Draw dotted ballistic trajectory (spaced every 2nd step for visual clarity)
      for (let i = 0; i < points.length; i++) {
        if (i % 2 !== 0 && i !== points.length - 1) continue;

        const pt = points[i];
        const progress = i / points.length;
        const alpha = Math.max(0.18, 0.95 - progress * 0.5);
        ctx.globalAlpha = alpha;
        const dotSize = Math.max(1.8, (isCharged ? 3.4 : 2.5) - progress * 0.9);
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, dotSize, 0, Math.PI * 2);
        ctx.fill();
      }

      // Draw Target Impact Reticle
      if (hitGroundX !== null && hitGroundY !== null) {
        if (hitTargetPlayer) {
          // LOCK-ON ENEMY RETICLE: High-visibility pulsing lock-on crosshair
          ctx.globalAlpha = 0.95;
          ctx.strokeStyle = '#ef476f';
          ctx.lineWidth = 2.5;
          ctx.shadowColor = '#ef476f';
          ctx.shadowBlur = 12;

          const pulse = Math.sin(performance.now() * 0.015) * 3;
          const r = 16 + pulse;

          ctx.beginPath();
          // Top-left bracket
          ctx.moveTo(hitTargetPlayer.x - r, hitTargetPlayer.y - r + 6);
          ctx.lineTo(hitTargetPlayer.x - r, hitTargetPlayer.y - r);
          ctx.lineTo(hitTargetPlayer.x - r + 6, hitTargetPlayer.y - r);
          // Top-right bracket
          ctx.moveTo(hitTargetPlayer.x + r - 6, hitTargetPlayer.y - r);
          ctx.lineTo(hitTargetPlayer.x + r, hitTargetPlayer.y - r);
          ctx.lineTo(hitTargetPlayer.x + r, hitTargetPlayer.y - r + 6);
          // Bottom-left bracket
          ctx.moveTo(hitTargetPlayer.x - r, hitTargetPlayer.y + r - 6);
          ctx.lineTo(hitTargetPlayer.x - r, hitTargetPlayer.y + r);
          ctx.lineTo(hitTargetPlayer.x - r + 6, hitTargetPlayer.y + r);
          // Bottom-right bracket
          ctx.moveTo(hitTargetPlayer.x + r - 6, hitTargetPlayer.y + r);
          ctx.lineTo(hitTargetPlayer.x + r, hitTargetPlayer.y + r);
          ctx.lineTo(hitTargetPlayer.x + r, hitTargetPlayer.y + r - 6);
          ctx.stroke();

          // Center target pip
          ctx.fillStyle = '#ef476f';
          ctx.beginPath();
          ctx.arc(hitGroundX, hitGroundY, 4, 0, Math.PI * 2);
          ctx.fill();

          // Label
          ctx.font = '900 10px Outfit, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillStyle = '#ef476f';
          ctx.fillText('TARGET LOCKED', hitTargetPlayer.x, hitTargetPlayer.y - r - 6);
        } else {
          // Terrain Impact Crosshair
          ctx.globalAlpha = 0.9;
          ctx.strokeStyle = trajectoryColor;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(hitGroundX, hitGroundY, 6, 0, Math.PI * 2);
          ctx.stroke();

          ctx.beginPath();
          ctx.moveTo(hitGroundX - 9, hitGroundY);
          ctx.lineTo(hitGroundX + 9, hitGroundY);
          ctx.moveTo(hitGroundX, hitGroundY - 9);
          ctx.lineTo(hitGroundX, hitGroundY + 9);
          ctx.stroke();

          ctx.fillStyle = trajectoryColor;
          ctx.beginPath();
          ctx.arc(hitGroundX, hitGroundY, 2.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      ctx.restore();
    }
  }
}
