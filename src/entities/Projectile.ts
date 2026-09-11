import { Platform, MapBoundaryType } from '../maps/MapTypes';

export type ProjectileType = 'arrow' | 'sword-beam' | 'shrapnel' | 'skyfall-arrow';

export interface ProjectileOptions {
  x: number;
  y: number;
  vx: number;
  vy: number;
  ownerIndex: number;
  damage: number;
  type?: ProjectileType;
  isCharged?: boolean;
  bouncesLeft?: number;
  isHoming?: boolean;
  isExplosive?: boolean;
  isPiercing?: boolean;
  isFrost?: boolean;
  isGrapple?: boolean;
  isShrapnel?: boolean;
  color?: string;
  hasGravity?: boolean;
}

export class Projectile {
  public x: number;
  public y: number;
  public vx: number;
  public vy: number;
  public ownerIndex: number;
  public damage: number;
  public type: ProjectileType;
  public isCharged: boolean;
  public bouncesLeft: number;
  public isHoming: boolean;
  public isExplosive: boolean;
  public isPiercing: boolean;
  public isFrost: boolean;
  public isGrapple: boolean;
  public isShrapnel: boolean;
  public color: string;
  public hasGravity: boolean;

  public isStuck: boolean = false;
  public stuckPlatform: Platform | null = null;
  public isDead: boolean = false;
  public lifeTimer: number = 10.0; // Despawns after 10s if stuck
  public flightTime: number = 0;
  public angle: number = 0;
  public width: number = 22;
  public height: number = 6;

  constructor(opts: ProjectileOptions) {
    this.x = opts.x;
    this.y = opts.y;
    this.vx = opts.vx;
    this.vy = opts.vy;
    this.ownerIndex = opts.ownerIndex;
    this.damage = opts.damage;
    this.type = opts.type ?? 'arrow';
    this.isCharged = opts.isCharged ?? false;
    this.bouncesLeft = opts.bouncesLeft ?? 0;
    this.isHoming = opts.isHoming ?? false;
    this.isExplosive = opts.isExplosive ?? false;
    this.isPiercing = opts.isPiercing ?? false;
    this.isFrost = opts.isFrost ?? false;
    this.isGrapple = opts.isGrapple ?? false;
    this.isShrapnel = opts.isShrapnel ?? false;
    this.color = opts.color ?? '#f8fafc';
    this.hasGravity = opts.hasGravity ?? (this.type === 'arrow' || this.type === 'skyfall-arrow');

    this.angle = Math.atan2(this.vy, this.vx);
  }

  public update(
    dt: number,
    targets?: { x: number; y: number; isAlive: boolean; index: number }[],
    gravityMultiplier: number = 1.0,
    boundaryType: MapBoundaryType = 'solid'
  ): void {
    if (this.isStuck) {
      this.lifeTimer -= dt;
      if (this.lifeTimer <= 0) {
        this.isDead = true;
      }
      return;
    }

    this.flightTime += dt;

    // Homing logic towards closest alive opponent
    if (this.isHoming && targets && this.flightTime > 0.08) {
      let nearestDist = 9999;
      let targetX = 0;
      let targetY = 0;
      let found = false;

      for (const t of targets) {
        if (t.isAlive && t.index !== this.ownerIndex) {
          const d = Math.hypot(t.x - this.x, t.y - this.y);
          if (d < nearestDist && d < 480) {
            nearestDist = d;
            targetX = t.x;
            targetY = t.y;
            found = true;
          }
        }
      }

      if (found) {
        const desiredAngle = Math.atan2(targetY - this.y, targetX - this.x);
        let currentAngle = Math.atan2(this.vy, this.vx);
        let angleDiff = desiredAngle - currentAngle;
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

        const turnRate = 3.5 * dt;
        currentAngle += Math.sign(angleDiff) * Math.min(Math.abs(angleDiff), turnRate);
        const speed = Math.hypot(this.vx, this.vy);
        this.vx = Math.cos(currentAngle) * speed;
        this.vy = Math.sin(currentAngle) * speed;
      }
    }

    // Gravity
    if (this.hasGravity) {
      this.vy += 380 * gravityMultiplier * dt;
    }

    // Move
    this.x += this.vx * dt;
    this.y += this.vy * dt;

    // Update orientation
    this.angle = Math.atan2(this.vy, this.vx);

    // Arena boundary checks & physical interactions
    if (boundaryType === 'solid') {
      if (this.x <= 20 && this.vx < 0) {
        if (this.bouncesLeft > 0) {
          this.bouncesLeft--;
          this.vx = -this.vx * 0.85;
          this.x = 22;
        } else {
          this.isStuck = true;
          this.x = 20;
          this.vx = 0;
          this.vy = 0;
        }
      } else if (this.x >= 1260 && this.vx > 0) {
        if (this.bouncesLeft > 0) {
          this.bouncesLeft--;
          this.vx = -this.vx * 0.85;
          this.x = 1258;
        } else {
          this.isStuck = true;
          this.x = 1260;
          this.vx = 0;
          this.vy = 0;
        }
      }
    } else if (boundaryType === 'hazard') {
      // Magma / electric boundaries incinerate arrows on contact
      if (this.x <= 20 || this.x >= 1260) {
        this.isDead = true;
      }
    } else if (boundaryType === 'bouncy') {
      // Super kinetic ricochet!
      if (this.x <= 20 && this.vx < 0) {
        this.vx = -this.vx;
        this.x = 22;
      } else if (this.x >= 1260 && this.vx > 0) {
        this.vx = -this.vx;
        this.x = 1258;
      }
    } else if (boundaryType === 'portal') {
      // Seamless screen-wrap
      if (this.x < 0) {
        this.x += 1280;
      } else if (this.x > 1280) {
        this.x -= 1280;
      }
    } else if (boundaryType === 'updraft') {
      if (this.x < 75 || this.x > 1205) {
        this.vy -= 400 * dt;
      }
    }

    // Outer dead-zone cull
    if (this.x < -200 || this.x > 1480 || this.y > 800 || this.y < -400) {
      this.isDead = true;
    }
  }

  public render(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);

    if (this.type === 'sword-beam') {
      // Crescent wave
      ctx.strokeStyle = this.color;
      ctx.fillStyle = this.color;
      ctx.lineWidth = 4;
      ctx.shadowColor = this.color;
      ctx.shadowBlur = 15;

      ctx.beginPath();
      ctx.arc(0, 0, 18, -Math.PI * 0.45, Math.PI * 0.45);
      ctx.stroke();

      // Inner white glow
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();
    } else if (this.type === 'shrapnel') {
      // Tiny glowing dart
      ctx.fillStyle = this.color;
      ctx.fillRect(-6, -1.5, 12, 3);
    } else {
      // Arrow
      // Wooden shaft
      ctx.fillStyle = this.isStuck ? '#94a3b8' : (this.isCharged ? '#ffd166' : '#d4a373');
      ctx.fillRect(-12, -2, 22, 4);

      // Arrow tip
      ctx.fillStyle = this.color;
      if (this.isCharged || this.isExplosive || this.isFrost) {
        ctx.shadowColor = this.color;
        ctx.shadowBlur = 10;
      }
      ctx.beginPath();
      ctx.moveTo(10, 0);
      ctx.lineTo(3, -5);
      ctx.lineTo(5, 0);
      ctx.lineTo(3, 5);
      ctx.closePath();
      ctx.fill();

      // Fletching (feathers)
      ctx.fillStyle = '#f8fafc';
      ctx.beginPath();
      ctx.moveTo(-12, 0);
      ctx.lineTo(-16, -4);
      ctx.lineTo(-13, 0);
      ctx.lineTo(-16, 4);
      ctx.closePath();
      ctx.fill();
    }

    ctx.restore();
  }

  public stick(platform: Platform, contactX: number, contactY: number): void {
    this.isStuck = true;
    this.stuckPlatform = platform;
    this.x = contactX;
    this.y = contactY;
    this.vx = 0;
    this.vy = 0;
  }

  public reflect(newOwnerIndex: number, speedMultiplier: number = 1.6): void {
    this.ownerIndex = newOwnerIndex;
    this.vx = -this.vx * speedMultiplier;
    this.vy = -this.vy * speedMultiplier * 0.7;
    this.angle = Math.atan2(this.vy, this.vx);
    this.damage += 1;
    this.color = '#ffd166'; // Parried gold glow
  }
}
