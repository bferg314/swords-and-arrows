import { ArenaMap, Platform, InteractiveProp, PlatformMaterial } from '../maps/MapTypes';
import { Player } from '../entities/Player';
import { Projectile } from '../entities/Projectile';
import { ParticleSystem } from './ParticleSystem';

interface WeatherParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
  color: string;
  rotation?: number;
  rotSpeed?: number;
  life?: number;
  maxLife?: number;
  type: 'rain' | 'snow' | 'ember' | 'leaf' | 'star' | 'bubble' | 'wisp';
}

export interface ActiveProp extends InteractiveProp {
  length: number;
  angle: number;
  angularVelocity: number;
  lightColor: string;
  lightRadius: number;
}

export class EnvironmentRenderer {
  public activeProps: ActiveProp[] = [];
  private weatherParticles: WeatherParticle[] = [];
  private maxWeatherParticles: number = 75;
  private weatherTimer: number = 0;

  public initMap(map: ArenaMap): void {
    this.weatherParticles = [];

    // Deep clone props so map definitions remain pristine across rounds
    this.activeProps = (map.props || []).map(p => ({
      ...p,
      angle: p.angle || 0,
      angularVelocity: p.angularVelocity || 0,
      length: p.length || 26,
      lightRadius: p.lightRadius || 75,
      lightColor: p.lightColor || '#ff9e00'
    }));

    // Pre-populate weather particles so the arena feels alive immediately
    this.seedWeather(map);
  }

  private seedWeather(map: ArenaMap): void {
    const ambient = map.ambientType;
    let type: WeatherParticle['type'] = 'star';

    if (ambient === 'embers') type = 'ember';
    else if (ambient === 'snow') type = 'snow';
    else if (ambient === 'water') type = 'bubble';
    else if (ambient === 'ghosts') type = 'wisp';
    else if (map.id === 'stormspire-apex') type = 'rain';
    else if (map.id === 'verdant-canopy') type = 'leaf';

    for (let i = 0; i < this.maxWeatherParticles; i++) {
      this.weatherParticles.push(this.createWeatherParticle(map, type, Math.random() * 720));
    }
  }

  private createWeatherParticle(_map: ArenaMap, type: WeatherParticle['type'], startY?: number): WeatherParticle {
    const y = startY !== undefined ? startY : (type === 'ember' ? 700 + Math.random() * 40 : -20);
    const x = Math.random() * 1320 - 20;

    switch (type) {
      case 'rain':
        return {
          x,
          y,
          vx: -55 + (Math.random() - 0.5) * 20,
          vy: 850 + Math.random() * 200,
          size: 14 + Math.random() * 8,
          alpha: 0.35 + Math.random() * 0.35,
          color: '#90e0ef',
          type: 'rain'
        };
      case 'snow':
        return {
          x,
          y,
          vx: (Math.random() - 0.5) * 35,
          vy: 65 + Math.random() * 55,
          size: 2.2 + Math.random() * 2.8,
          alpha: 0.55 + Math.random() * 0.4,
          color: '#f8fafc',
          rotation: Math.random() * Math.PI * 2,
          rotSpeed: (Math.random() - 0.5) * 1.5,
          type: 'snow'
        };
      case 'ember':
        return {
          x,
          y,
          vx: (Math.random() - 0.5) * 50,
          vy: -(80 + Math.random() * 160),
          size: 2.0 + Math.random() * 2.5,
          alpha: 0.7 + Math.random() * 0.3,
          color: Math.random() < 0.6 ? '#ffba08' : '#e85d04',
          type: 'ember'
        };
      case 'leaf':
        return {
          x,
          y,
          vx: 30 + (Math.random() - 0.5) * 40,
          vy: 70 + Math.random() * 50,
          size: 4 + Math.random() * 4,
          alpha: 0.75 + Math.random() * 0.25,
          color: Math.random() < 0.5 ? '#e76f51' : (Math.random() < 0.5 ? '#f4a261' : '#2a9d8f'),
          rotation: Math.random() * Math.PI * 2,
          rotSpeed: (Math.random() - 0.5) * 3.5,
          type: 'leaf'
        };
      case 'bubble':
        return {
          x,
          y: startY !== undefined ? startY : 680 + Math.random() * 40,
          vx: (Math.random() - 0.5) * 20,
          vy: -(35 + Math.random() * 45),
          size: 2.5 + Math.random() * 4.5,
          alpha: 0.35 + Math.random() * 0.3,
          color: '#52b788',
          type: 'bubble'
        };
      case 'wisp':
        return {
          x,
          y: startY !== undefined ? startY : 500 + Math.random() * 200,
          vx: (Math.random() - 0.5) * 45,
          vy: -(25 + Math.random() * 40),
          size: 4.5 + Math.random() * 5,
          alpha: 0.35 + Math.random() * 0.45,
          color: '#57cc99',
          type: 'wisp'
        };
      case 'star':
      default:
        return {
          x,
          y: Math.random() * 720,
          vx: 0,
          vy: 0,
          size: 1.2 + Math.random() * 2.2,
          alpha: 0.2 + Math.random() * 0.6,
          color: Math.random() < 0.4 ? '#ffd166' : '#ffffff',
          type: 'star'
        };
    }
  }

  public update(
    dt: number,
    map: ArenaMap,
    players: Player[],
    projectiles: Projectile[],
    particles: ParticleSystem
  ): void {
    const time = performance.now() * 0.001;
    this.weatherTimer += dt;

    // 1. Update Interactive Hanging Props with Damped Harmonic Pendulum Physics
    const g = 480; // Pendulum gravity constant
    for (const prop of this.activeProps) {
      const length = Math.max(16, prop.length);
      const accel = -(g / length) * Math.sin(prop.angle) - 2.8 * prop.angularVelocity;
      prop.angularVelocity += accel * dt;
      prop.angle += prop.angularVelocity * dt;

      // Current swing tip coordinate
      prop.x = prop.anchorX + Math.sin(prop.angle) * length;
      prop.y = prop.anchorY + Math.cos(prop.angle) * length;

      // A. Player Interaction (Dashing through or sprinting past)
      for (const p of players) {
        if (!p.isAlive) continue;
        const d = Math.hypot(p.x - prop.x, p.y - prop.y);
        if (d < 50) {
          const impulseDir = Math.sign(p.vx) || (p.facingLeft ? -1 : 1);
          const force = p.isDashing ? 14.0 : (Math.abs(p.vx) > 150 ? 8.0 : 4.0);
          prop.angularVelocity += impulseDir * force * dt * 18;
          if (Math.abs(prop.angularVelocity) > 4 && Math.random() < 0.25) {
            particles.emitSparks(prop.x, prop.y, 4, prop.lightColor);
          }
        }
      }

      // B. Projectile Interaction (Arrows or sword beams passing by)
      for (const proj of projectiles) {
        if (proj.isDead || proj.isStuck) continue;
        const d = Math.hypot(proj.x - prop.x, proj.y - prop.y);
        if (d < 36) {
          const impulseDir = Math.sign(proj.vx) || 1;
          prop.angularVelocity += impulseDir * 12.0;
          particles.emitSparks(prop.x, prop.y, 6, '#ffd166');
        }
      }
    }

    // 2. Update Weather Particles
    const activePlatforms = map.platforms.filter(p => p.crumbleState !== 'vanished');
    for (let i = this.weatherParticles.length - 1; i >= 0; i--) {
      const wp = this.weatherParticles[i];

      if (wp.type === 'rain') {
        wp.x += wp.vx * dt;
        wp.y += wp.vy * dt;

        // Platform collision splash
        let hitPlatform = false;
        for (const plat of activePlatforms) {
          if (wp.x >= plat.x && wp.x <= plat.x + plat.w && wp.y >= plat.y && wp.y <= plat.y + 12) {
            hitPlatform = true;
            if (Math.random() < 0.2) {
              particles.emitDust(wp.x, plat.y, 2);
            }
            break;
          }
        }

        if (hitPlatform || wp.y > 730 || wp.x < -40) {
          this.weatherParticles[i] = this.createWeatherParticle(map, 'rain');
        }
      } else if (wp.type === 'snow') {
        wp.x += (wp.vx + Math.sin(time * 2 + wp.y * 0.05) * 22) * dt;
        wp.y += wp.vy * dt;
        if (wp.rotation !== undefined && wp.rotSpeed !== undefined) {
          wp.rotation += wp.rotSpeed * dt;
        }
        if (wp.y > 730 || wp.x < -30 || wp.x > 1310) {
          this.weatherParticles[i] = this.createWeatherParticle(map, 'snow');
        }
      } else if (wp.type === 'ember') {
        wp.x += (wp.vx + Math.sin(time * 3 + wp.y * 0.04) * 35) * dt;
        wp.y += wp.vy * dt;
        wp.alpha -= dt * 0.15;
        if (wp.y < 340 || wp.alpha <= 0) {
          this.weatherParticles[i] = this.createWeatherParticle(map, 'ember');
        }
      } else if (wp.type === 'leaf') {
        wp.x += (wp.vx + Math.sin(time * 2.5 + wp.y * 0.03) * 45) * dt;
        wp.y += wp.vy * dt;
        if (wp.rotation !== undefined && wp.rotSpeed !== undefined) {
          wp.rotation += wp.rotSpeed * dt;
        }
        if (wp.y > 730 || wp.x > 1320) {
          this.weatherParticles[i] = this.createWeatherParticle(map, 'leaf');
        }
      } else if (wp.type === 'bubble' || wp.type === 'wisp') {
        wp.x += (wp.vx + Math.sin(time * 2 + wp.y * 0.04) * 25) * dt;
        wp.y += wp.vy * dt;
        if (wp.y < 100) {
          this.weatherParticles[i] = this.createWeatherParticle(map, wp.type);
        }
      } else if (wp.type === 'star') {
        // Twinkle alpha
        wp.alpha = 0.25 + Math.sin(time * 3 + wp.x * 0.1) * 0.25;
      }
    }
  }

  // =========================================================================
  // 1. PROCEDURAL PLATFORM TEXTURES
  // =========================================================================

  public renderPlatform(
    ctx: CanvasRenderingContext2D,
    plat: Platform,
    map: ArenaMap,
    animTime: number
  ): void {
    if (plat.crumbleState === 'vanished') return;

    ctx.save();
    if (plat.crumbleState === 'shaking') {
      const shakeOffset = (Math.random() - 0.5) * 4;
      ctx.translate(shakeOffset, 0);
    }

    const mat = this.determineMaterial(plat, map);

    switch (mat) {
      case 'stone':
      case 'ancient':
        this.renderStonePlatform(ctx, plat, mat === 'ancient', animTime);
        break;
      case 'wood':
        this.renderWoodPlatform(ctx, plat, animTime);
        break;
      case 'basalt':
        this.renderBasaltPlatform(ctx, plat, animTime);
        break;
      case 'ice':
        this.renderIcePlatform(ctx, plat, animTime);
        break;
      case 'tech':
        this.renderTechPlatform(ctx, plat, animTime);
        break;
      case 'celestial':
        this.renderCelestialPlatform(ctx, plat, animTime);
        break;
      case 'crystal':
        this.renderCrystalPlatform(ctx, plat, animTime);
        break;
      case 'cloud':
        this.renderCloudPlatform(ctx, plat, animTime);
        break;
      default:
        this.renderStonePlatform(ctx, plat, false, animTime);
        break;
    }

    // Bouncy highlight sheen if not already cloud
    if (plat.bouncy && mat !== 'cloud') {
      ctx.fillStyle = '#00b4d8';
      ctx.shadowColor = '#00b4d8';
      ctx.shadowBlur = 8;
      ctx.fillRect(plat.x, plat.y, plat.w, 4);
    }

    // Speed boost indicators
    if (plat.speedBoost) {
      ctx.fillStyle = plat.speedBoost > 0 ? '#00f5d4' : '#f72585';
      ctx.font = 'bold 12px Outfit, sans-serif';
      ctx.textAlign = 'center';
      const arrow = plat.speedBoost > 0 ? '>>>' : '<<<';
      ctx.fillText(arrow, plat.x + plat.w * 0.5, plat.y + 8);
    }

    ctx.restore();
  }

  private determineMaterial(plat: Platform, map: ArenaMap): PlatformMaterial {
    if (plat.material) return plat.material;
    if (plat.bouncy) return 'cloud';
    if (plat.slippery) return 'ice';
    if (map.id === 'molten-caverns') return 'basalt';
    if (map.id === 'frostpeak-summit') return 'ice';
    if (map.id === 'neon-cyber-dojo' || map.id === 'clockwork-spire') return 'tech';
    if (map.id === 'crystalline-sanctuary') return 'crystal';
    if (map.id === 'celestial-citadel' || map.id === 'astral-void') return 'celestial';
    if (map.id === 'sunken-ruins' || map.id === 'verdant-canopy' || map.id === 'toxic-catacombs') return 'ancient';
    if (plat.oneWay) return 'wood';
    return 'stone';
  }

  /**
   * Stone / Ancient Masonry Shader:
   * - Top stone coping slab with chisel highlights
   * - Vertical mortar seam joints in running bond pattern
   * - Drooping ivy vines with leafy nodes if ancient
   */
  private renderStonePlatform(
    ctx: CanvasRenderingContext2D,
    plat: Platform,
    isAncient: boolean,
    animTime: number
  ): void {
    const { x, y, w, h } = plat;

    // Base stone gradient
    const grad = ctx.createLinearGradient(x, y, x, y + h);
    grad.addColorStop(0, plat.color || '#334155');
    grad.addColorStop(1, '#0f172a');
    ctx.fillStyle = grad;
    ctx.fillRect(x, y, w, h);

    // Top stone coping ledge (solid dressed slab)
    ctx.fillStyle = plat.borderColor || '#64748b';
    ctx.fillRect(x, y, w, 4);

    // Top edge specular rim
    ctx.fillStyle = 'rgba(255, 255, 255, 0.22)';
    ctx.fillRect(x, y, w, 1.5);

    // Vertical mortar joints (masonry running bond)
    ctx.strokeStyle = 'rgba(15, 23, 42, 0.55)';
    ctx.lineWidth = 1.5;

    const brickW = 44;
    const rows = Math.max(1, Math.floor(h / 18));
    for (let r = 0; r < rows; r++) {
      const rowY = y + 4 + r * 18;
      // Horizontal seam between rows
      if (r > 0) {
        ctx.beginPath();
        ctx.moveTo(x, rowY);
        ctx.lineTo(x + w, rowY);
        ctx.stroke();
      }

      // Staggered vertical joints
      const offset = (r % 2) * (brickW * 0.5);
      for (let bx = x + offset; bx < x + w; bx += brickW) {
        if (bx > x && bx < x + w) {
          ctx.beginPath();
          ctx.moveTo(bx, rowY);
          ctx.lineTo(bx, Math.min(y + h, rowY + 18));
          ctx.stroke();
        }
      }
    }

    // Outer border
    ctx.strokeStyle = plat.borderColor || '#475569';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x, y, w, h);

    // Hanging ancient ivy & moss vines
    if (isAncient && w >= 60) {
      ctx.fillStyle = '#2d6a4f';
      ctx.strokeStyle = '#1b4332';
      ctx.lineWidth = 1.5;

      const vineCount = Math.min(6, Math.floor(w / 60));
      for (let v = 0; v < vineCount; v++) {
        const vx = x + 25 + v * 55;
        const vLen = 8 + ((v * 7 + 11) % 18);
        const sway = Math.sin(animTime * 2 + v * 1.5) * 3;

        ctx.beginPath();
        ctx.moveTo(vx, y + h);
        ctx.quadraticCurveTo(vx + sway * 0.5, y + h + vLen * 0.5, vx + sway, y + h + vLen);
        ctx.stroke();

        // Ivy leaves
        ctx.fillStyle = v % 2 === 0 ? '#40916c' : '#52b788';
        ctx.beginPath();
        ctx.arc(vx + sway, y + h + vLen, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  /**
   * Wood Timber Plank Decking Shader:
   * - Horizontal wood grain lines
   * - Vertical plank divider seams
   * - Brass/iron nail rivets on corners
   */
  private renderWoodPlatform(
    ctx: CanvasRenderingContext2D,
    plat: Platform,
    _animTime: number
  ): void {
    const { x, y, w, h } = plat;

    // Wood base gradient
    const grad = ctx.createLinearGradient(x, y, x, y + h);
    grad.addColorStop(0, plat.color || '#92400e');
    grad.addColorStop(1, '#451a03');
    ctx.fillStyle = grad;
    ctx.fillRect(x, y, w, h);

    // Top timber highlight ledge
    ctx.fillStyle = plat.borderColor || '#d97706';
    ctx.fillRect(x, y, w, 3);

    // Wood grain lines
    ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.fillRect(x, y + 4, w, 1.5);
    if (h > 12) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
      ctx.fillRect(x, y + Math.floor(h * 0.55), w, 1.5);
    }

    // Vertical plank dividers & brass rivets
    const plankW = 38;
    ctx.strokeStyle = '#291205';
    ctx.lineWidth = 1.5;
    ctx.fillStyle = '#fef08a'; // Brass rivets

    for (let px = x + plankW; px < x + w - 10; px += plankW) {
      ctx.beginPath();
      ctx.moveTo(px, y);
      ctx.lineTo(px, y + h);
      ctx.stroke();

      // Top and bottom rivets
      ctx.beginPath();
      ctx.arc(px - 3, y + 5, 1.2, 0, Math.PI * 2);
      ctx.arc(px + 3, y + 5, 1.2, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.strokeStyle = plat.borderColor || '#b45309';
    ctx.lineWidth = plat.oneWay ? 2.5 : 1.5;
    ctx.strokeRect(x, y, w, h);
  }

  /**
   * Volcanic Basalt Shader:
   * - Dark jagged obsidian rock
   * - Pulsing molten magma fissures
   * - Scorched glowing orange rim
   */
  private renderBasaltPlatform(
    ctx: CanvasRenderingContext2D,
    plat: Platform,
    animTime: number
  ): void {
    const { x, y, w, h } = plat;

    // Obsidian base
    ctx.fillStyle = '#1c1917';
    ctx.fillRect(x, y, w, h);

    // Scorched heat glow on top surface
    const pulse = Math.sin(animTime * 3 + x * 0.01) * 0.5 + 0.5;
    ctx.fillStyle = `rgba(255, 84, 0, ${0.4 + pulse * 0.35})`;
    ctx.fillRect(x, y, w, 3.5);

    // Molten magma fissure veins
    ctx.strokeStyle = `rgba(255, 186, 8, ${0.65 + pulse * 0.35})`;
    ctx.lineWidth = 1.8;
    ctx.shadowColor = '#ff5400';
    ctx.shadowBlur = 8 * pulse;

    const crackCount = Math.max(1, Math.floor(w / 70));
    for (let c = 0; c < crackCount; c++) {
      const cx = x + 30 + c * 65;
      ctx.beginPath();
      ctx.moveTo(cx, y + 3);
      ctx.lineTo(cx + 6, y + h * 0.45);
      ctx.lineTo(cx - 3, y + h * 0.75);
      ctx.lineTo(cx + 4, y + h);
      ctx.stroke();
    }
    ctx.shadowBlur = 0;

    // Border
    ctx.strokeStyle = plat.borderColor || '#ea580c';
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, w, h);
  }

  /**
   * Ice & Frost Platform Shader:
   * - Translucent pale cyan ice slab
   * - Specular frost glint top sheen
   * - Hanging stalactite icicles
   */
  private renderIcePlatform(
    ctx: CanvasRenderingContext2D,
    plat: Platform,
    _animTime: number
  ): void {
    const { x, y, w, h } = plat;

    // Ice base gradient
    const grad = ctx.createLinearGradient(x, y, x, y + h);
    grad.addColorStop(0, '#cbf3f0');
    grad.addColorStop(0.5, '#72efdd');
    grad.addColorStop(1, '#2ec4b6');
    ctx.fillStyle = grad;
    ctx.fillRect(x, y, w, h);

    // Specular top frost sheet
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.fillRect(x, y, w, 3);

    // Diagonal crystalline refractions
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.lineWidth = 1.5;
    for (let rx = x + 15; rx < x + w - 10; rx += 45) {
      ctx.beginPath();
      ctx.moveTo(rx, y + 3);
      ctx.lineTo(rx + 16, y + h);
      ctx.stroke();
    }

    // Hanging Icicles
    ctx.fillStyle = '#cbf3f0';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.lineWidth = 1;

    for (let ix = x + 12; ix < x + w - 8; ix += 22) {
      const iLen = 6 + ((ix * 7) % 11);
      ctx.beginPath();
      ctx.moveTo(ix - 4, y + h);
      ctx.lineTo(ix + 4, y + h);
      ctx.lineTo(ix, y + h + iLen);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }

    ctx.strokeStyle = plat.borderColor || '#a0c4ff';
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, w, h);
  }

  /**
   * Cyber Tech Platform Shader:
   * - Dark carbon alloy body
   * - Neon cyan/magenta circuit conduits
   * - Corner circuit bracket pads
   */
  private renderTechPlatform(
    ctx: CanvasRenderingContext2D,
    plat: Platform,
    animTime: number
  ): void {
    const { x, y, w, h } = plat;

    // Dark alloy body
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(x, y, w, h);

    // Glowing neon top conduit
    const neonColor = plat.borderColor || '#00f5d4';
    ctx.fillStyle = neonColor;
    ctx.shadowColor = neonColor;
    ctx.shadowBlur = 8;
    ctx.fillRect(x, y, w, 3.5);

    // Circuit traces
    ctx.strokeStyle = neonColor;
    ctx.lineWidth = 1.4;

    const traceX = x + 18;
    ctx.beginPath();
    ctx.moveTo(traceX, y + h - 4);
    ctx.lineTo(traceX + 20, y + h - 4);
    ctx.lineTo(traceX + 32, y + 7);
    ctx.lineTo(x + w - 24, y + 7);
    ctx.stroke();

    // Corner bracket pads
    ctx.fillStyle = neonColor;
    ctx.fillRect(x + 2, y + 2, 4, 4);
    ctx.fillRect(x + w - 6, y + 2, 4, 4);

    // Pulsing energy pulse
    const pulseProgress = (animTime * 1.5) % 1;
    const pulseX = x + 30 + pulseProgress * (w - 60);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(pulseX, y + 7, 2, 0, Math.PI * 2);
    ctx.fill();

    ctx.shadowBlur = 0;
    ctx.strokeStyle = neonColor;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x, y, w, h);
  }

  /**
   * Celestial Citadel / Astral Void Platform Shader:
   * - White/lapis marble slab
   * - Inlaid gold runic glyphs and azure ley lines
   */
  private renderCelestialPlatform(
    ctx: CanvasRenderingContext2D,
    plat: Platform,
    animTime: number
  ): void {
    const { x, y, w, h } = plat;

    // Marble gradient
    const grad = ctx.createLinearGradient(x, y, x, y + h);
    grad.addColorStop(0, '#f8fafc');
    grad.addColorStop(1, '#cbd5e1');
    ctx.fillStyle = grad;
    ctx.fillRect(x, y, w, h);

    // Gold top border
    ctx.fillStyle = '#ffd166';
    ctx.fillRect(x, y, w, 3.5);

    // Arcane Ley Lines & Inlaid Glyphs
    ctx.strokeStyle = '#0284c7';
    ctx.lineWidth = 1.5;
    const shimmer = Math.sin(animTime * 2.5 + x * 0.02) * 0.3 + 0.7;
    ctx.globalAlpha = shimmer;

    for (let gx = x + 28; gx < x + w - 20; gx += 50) {
      // Small runic diamond glyph
      ctx.beginPath();
      ctx.moveTo(gx, y + 7);
      ctx.lineTo(gx + 5, y + 12);
      ctx.lineTo(gx, y + 17);
      ctx.lineTo(gx - 5, y + 12);
      ctx.closePath();
      ctx.stroke();

      // Connecting ley lines
      ctx.beginPath();
      ctx.moveTo(gx + 5, y + 12);
      ctx.lineTo(gx + 45, y + 12);
      ctx.stroke();
    }
    ctx.globalAlpha = 1.0;

    ctx.strokeStyle = '#ffd166';
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, w, h);
  }

  /**
   * Crystal Gemstone Platform Shader:
   * - Faceted diamond edges and deep prismatic violet/cyan core
   */
  private renderCrystalPlatform(
    ctx: CanvasRenderingContext2D,
    plat: Platform,
    animTime: number
  ): void {
    const { x, y, w, h } = plat;

    const grad = ctx.createLinearGradient(x, y, x + w, y + h);
    grad.addColorStop(0, '#7209b7');
    grad.addColorStop(0.5, '#4361ee');
    grad.addColorStop(1, '#4cc9f0');
    ctx.fillStyle = grad;
    ctx.fillRect(x, y, w, h);

    // Prismatic facet cuts
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
    ctx.lineWidth = 1.5;
    const step = 36;
    for (let fx = x + step; fx < x + w; fx += step) {
      ctx.beginPath();
      ctx.moveTo(fx, y);
      ctx.lineTo(fx - 12, y + h);
      ctx.stroke();
    }

    // Glowing crystal core pulse
    const pulse = Math.sin(animTime * 3) * 0.3 + 0.7;
    ctx.fillStyle = `rgba(255, 255, 255, ${pulse * 0.35})`;
    ctx.fillRect(x, y, w, 2.5);

    ctx.strokeStyle = plat.borderColor || '#f72585';
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, w, h);
  }

  /**
   * Cloud Pad Platform Shader:
   * - Bouncy layered puffy cloud billows with soft cyan glow
   */
  private renderCloudPlatform(
    ctx: CanvasRenderingContext2D,
    plat: Platform,
    _animTime: number
  ): void {
    const { x, y, w, h } = plat;

    ctx.save();
    ctx.shadowColor = '#90e0ef';
    ctx.shadowBlur = 10;
    ctx.fillStyle = '#f0f9ff';

    // Rounded overlapping cloud billows
    const billowRadius = Math.max(8, h * 0.65);
    const billowStep = billowRadius * 1.5;

    ctx.beginPath();
    for (let bx = x + billowRadius; bx <= x + w - billowRadius; bx += billowStep) {
      ctx.arc(bx, y + h * 0.5, billowRadius, 0, Math.PI * 2);
    }
    ctx.fill();

    // Cyan base tint
    ctx.fillStyle = '#bae6fd';
    ctx.fillRect(x + 4, y + 4, w - 8, h - 8);

    ctx.restore();
  }

  // =========================================================================
  // 2. INTERACTIVE PROPS RENDERING & DYNAMIC ILLUMINATION
  // =========================================================================

  public renderProps(ctx: CanvasRenderingContext2D, animTime: number): void {
    for (const prop of this.activeProps) {
      ctx.save();

      const { anchorX, anchorY, x, y, lightColor, lightRadius, type } = prop;

      // 1. Soft Dynamic Illumination Halo
      const flicker = Math.sin(animTime * 14 + anchorX * 0.05) * 0.08;
      const alpha = Math.max(0.08, 0.22 + flicker);
      const grad = ctx.createRadialGradient(x, y, 2, x, y, lightRadius);
      grad.addColorStop(0, lightColor);
      grad.addColorStop(1, 'rgba(0, 0, 0, 0)');

      ctx.globalAlpha = alpha;
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(x, y, lightRadius, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1.0;

      // 2. Mount / Chain Links
      if (type === 'lantern') {
        // Iron chain from ceiling anchor
        ctx.strokeStyle = '#475569';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(anchorX, anchorY);
        ctx.lineTo(x, y - 10);
        ctx.stroke();

        // Ceiling plate
        ctx.fillStyle = '#334155';
        ctx.fillRect(anchorX - 5, anchorY - 2, 10, 4);

        // Hanging lantern cage (swings with angle)
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(prop.angle);

        // Lantern cap
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(-7, -10, 14, 4);

        // Glass chamber
        ctx.fillStyle = 'rgba(255, 209, 102, 0.4)';
        ctx.fillRect(-6, -6, 12, 12);

        // Inner glowing candle / flame core
        ctx.fillStyle = '#fff';
        ctx.shadowColor = lightColor;
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(0, 0, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        // Lantern cage bars & bottom plate
        ctx.strokeStyle = '#64748b';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(-6, -6, 12, 12);
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(-7, 6, 14, 3);

        ctx.restore();
      } else if (type === 'torch') {
        // Wall-mounted iron bracket
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(anchorX, anchorY);
        ctx.lineTo(anchorX + (anchorX < x ? 8 : -8), anchorY + 8);
        ctx.stroke();

        // Sconce
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(prop.angle * 0.6);

        // Torch wooden handle
        ctx.fillStyle = '#78350f';
        ctx.fillRect(-2.5, 0, 5, 14);

        // Iron sconce collar
        ctx.fillStyle = '#475569';
        ctx.fillRect(-4, -2, 8, 4);

        // Animated blazing flame teardrop
        const flameBob = Math.sin(animTime * 18 + anchorX) * 2;
        ctx.fillStyle = '#ff5400';
        ctx.shadowColor = '#ffba08';
        ctx.shadowBlur = 10;

        ctx.beginPath();
        ctx.moveTo(-4, -2);
        ctx.quadraticCurveTo(-5, -8 + flameBob, 0, -14 + flameBob);
        ctx.quadraticCurveTo(5, -8 + flameBob, 4, -2);
        ctx.closePath();
        ctx.fill();

        // Inner white-hot flame core
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(0, -5 + flameBob * 0.5, 2.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
      } else if (type === 'crystal') {
        // Floating arcane crystal with iron ring
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(prop.angle + animTime * 1.5);

        ctx.strokeStyle = '#a855f7';
        ctx.lineWidth = 1.5;
        ctx.shadowColor = '#c084fc';
        ctx.shadowBlur = 12;

        ctx.beginPath();
        ctx.moveTo(0, -10);
        ctx.lineTo(6, 0);
        ctx.lineTo(0, 10);
        ctx.lineTo(-6, 0);
        ctx.closePath();
        ctx.fillStyle = '#e9d5ff';
        ctx.fill();
        ctx.stroke();

        ctx.restore();
      }

      ctx.restore();
    }
  }

  // =========================================================================
  // 3. DYNAMIC WEATHER & AMBIANCE LAYER
  // =========================================================================

  public renderWeather(ctx: CanvasRenderingContext2D): void {
    ctx.save();

    for (const wp of this.weatherParticles) {
      ctx.globalAlpha = wp.alpha;

      if (wp.type === 'rain') {
        ctx.strokeStyle = wp.color;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(wp.x, wp.y);
        ctx.lineTo(wp.x + wp.vx * 0.025, wp.y + wp.size);
        ctx.stroke();
      } else if (wp.type === 'snow') {
        ctx.fillStyle = wp.color;
        ctx.beginPath();
        ctx.arc(wp.x, wp.y, wp.size, 0, Math.PI * 2);
        ctx.fill();
      } else if (wp.type === 'ember') {
        ctx.fillStyle = wp.color;
        ctx.shadowColor = '#ff5400';
        ctx.shadowBlur = 6;
        ctx.beginPath();
        ctx.arc(wp.x, wp.y, wp.size, 0, Math.PI * 2);
        ctx.fill();
      } else if (wp.type === 'leaf') {
        ctx.save();
        ctx.translate(wp.x, wp.y);
        if (wp.rotation !== undefined) ctx.rotate(wp.rotation);

        ctx.fillStyle = wp.color;
        ctx.beginPath();
        ctx.ellipse(0, 0, wp.size, wp.size * 0.45, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      } else if (wp.type === 'bubble') {
        ctx.strokeStyle = wp.color;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(wp.x, wp.y, wp.size, 0, Math.PI * 2);
        ctx.stroke();
      } else if (wp.type === 'wisp') {
        ctx.fillStyle = wp.color;
        ctx.shadowColor = wp.color;
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.arc(wp.x, wp.y, wp.size, 0, Math.PI * 2);
        ctx.fill();
      } else if (wp.type === 'star') {
        ctx.fillStyle = wp.color;
        ctx.beginPath();
        ctx.arc(wp.x, wp.y, wp.size, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.restore();
  }

  // =========================================================================
  // 4. ARENA BOUNDARY RENDERING (Solid, Portal, Hazard, Bouncy, Updraft, Open)
  // =========================================================================

  public renderBoundaries(ctx: CanvasRenderingContext2D, map: ArenaMap, time: number): void {
    const boundaryType = map.boundaryType || 'solid';
    const theme = map.boundaryTheme || 'stone';

    if (boundaryType === 'open') {
      // Open abyss: subtle broken ledge edge accents and soft ambient mist at the sides
      ctx.save();
      const leftGrad = ctx.createLinearGradient(0, 0, 45, 0);
      leftGrad.addColorStop(0, 'rgba(255, 255, 255, 0.05)');
      leftGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = leftGrad;
      ctx.fillRect(0, 0, 45, 720);

      const rightGrad = ctx.createLinearGradient(1280, 0, 1235, 0);
      rightGrad.addColorStop(0, 'rgba(255, 255, 255, 0.05)');
      rightGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = rightGrad;
      ctx.fillRect(1235, 0, 45, 720);
      ctx.restore();
      return;
    }

    ctx.save();

    // ----------------- SOLID BASTION WALLS -----------------
    if (boundaryType === 'solid') {
      const renderSolidSide = (startX: number, width: number, isLeft: boolean) => {
        const pillarGrad = ctx.createLinearGradient(startX, 0, startX + width, 0);
        if (theme === 'metal') {
          pillarGrad.addColorStop(0, isLeft ? '#3d2613' : '#160c03');
          pillarGrad.addColorStop(0.5, '#7f4f24');
          pillarGrad.addColorStop(1, isLeft ? '#160c03' : '#3d2613');
        } else if (theme === 'sandstone') {
          pillarGrad.addColorStop(0, isLeft ? '#432818' : '#1a0f00');
          pillarGrad.addColorStop(0.5, '#9c6644');
          pillarGrad.addColorStop(1, isLeft ? '#1a0f00' : '#432818');
        } else {
          // Default stone / castle ashlar
          pillarGrad.addColorStop(0, isLeft ? '#1e293b' : '#0f172a');
          pillarGrad.addColorStop(0.5, '#475569');
          pillarGrad.addColorStop(1, isLeft ? '#0f172a' : '#1e293b');
        }

        ctx.fillStyle = pillarGrad;
        ctx.fillRect(startX, 0, width, 720);

        // Ambient drop shadow cast onto the arena floor
        const shadowGrad = ctx.createLinearGradient(startX, 0, isLeft ? startX + width + 16 : startX - 16, 0);
        shadowGrad.addColorStop(0, 'rgba(0, 0, 0, 0.45)');
        shadowGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = shadowGrad;
        ctx.fillRect(isLeft ? startX + width : startX - 16, 0, 16, 720);

        // Inner highlight edge & outer shadow
        ctx.strokeStyle = theme === 'metal' ? '#dda15e' : (theme === 'sandstone' ? '#ddb892' : '#94a3b8');
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        const edgeX = isLeft ? startX + width : startX;
        ctx.moveTo(edgeX, 0);
        ctx.lineTo(edgeX, 720);
        ctx.stroke();

        // Brick / plate grooves
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.45)';
        ctx.lineWidth = 1.5;
        const blockH = 45;
        for (let y = 0; y < 720; y += blockH) {
          ctx.beginPath();
          ctx.moveTo(startX, y);
          ctx.lineTo(startX + width, y);
          ctx.stroke();

          // Rivet or rune stone detail
          if (theme === 'metal') {
            ctx.fillStyle = '#bc6c25';
            ctx.beginPath();
            ctx.arc(isLeft ? startX + width - 8 : startX + 8, y + blockH * 0.5, 2.5, 0, Math.PI * 2);
            ctx.fill();
          } else if (theme === 'sandstone') {
            ctx.fillStyle = 'rgba(255, 214, 10, 0.25)';
            ctx.fillRect(isLeft ? startX + width - 12 : startX + 4, y + blockH * 0.35, 8, 10);
          }
        }
      };

      renderSolidSide(0, 32, true);
      renderSolidSide(1248, 32, false);
    }

    // ----------------- PORTAL SCREEN-WRAP -----------------
    else if (boundaryType === 'portal') {
      const pulse = Math.sin(time * 0.005) * 0.25 + 0.75;
      let primaryColor = '#c77dff';
      let secondaryColor = '#70e4ef';
      let glowColor = '#9d4edd';

      if (theme === 'portal-toxic') {
        primaryColor = '#52b788';
        secondaryColor = '#74c69d';
        glowColor = '#2d6a4f';
      } else if (theme === 'portal-cosmic') {
        primaryColor = '#8338ec';
        secondaryColor = '#3a86ff';
        glowColor = '#3a0ca3';
      }

      const renderPortalSide = (startX: number, width: number, isLeft: boolean) => {
        // Ethereal vertical aura
        const auraGrad = ctx.createLinearGradient(startX, 0, startX + width, 0);
        if (isLeft) {
          auraGrad.addColorStop(0, primaryColor);
          auraGrad.addColorStop(0.6, secondaryColor);
          auraGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        } else {
          auraGrad.addColorStop(0, 'rgba(0, 0, 0, 0)');
          auraGrad.addColorStop(0.4, secondaryColor);
          auraGrad.addColorStop(1, primaryColor);
        }

        ctx.globalAlpha = 0.65 * pulse;
        ctx.fillStyle = auraGrad;
        ctx.shadowColor = glowColor;
        ctx.shadowBlur = 24;
        ctx.fillRect(startX, 0, width, 720);

        // Pulsating dimensional event horizon beam
        ctx.globalAlpha = 0.95;
        ctx.strokeStyle = secondaryColor;
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        const beamX = isLeft ? 16 : 1264;
        ctx.moveTo(beamX, 0);
        for (let y = 0; y <= 720; y += 25) {
          const wobble = Math.sin(y * 0.04 + time * 0.008) * 5;
          ctx.lineTo(beamX + (isLeft ? wobble : -wobble), y);
        }
        ctx.stroke();

        // Directional Chevron Arrows pointing offscreen into the warp
        ctx.strokeStyle = primaryColor;
        ctx.lineWidth = 2.5;
        const chevronSpacing = 55;
        const scrollOffset = (time * 0.045) % chevronSpacing;
        for (let y = -chevronSpacing; y < 720 + chevronSpacing; y += chevronSpacing) {
          const arrowY = y + scrollOffset;
          ctx.beginPath();
          if (isLeft) {
            ctx.moveTo(26, arrowY - 7);
            ctx.lineTo(10, arrowY);
            ctx.lineTo(26, arrowY + 7);
          } else {
            ctx.moveTo(1254, arrowY - 7);
            ctx.lineTo(1270, arrowY);
            ctx.lineTo(1254, arrowY + 7);
          }
          ctx.stroke();
        }
      };

      renderPortalSide(0, 48, true);
      renderPortalSide(1232, 48, false);
    }

    // ----------------- HAZARDOUS DAMAGING BARRIER -----------------
    else if (boundaryType === 'hazard') {
      const isElectric = theme === 'hazard-electric';
      const mainColor = isElectric ? '#4cc9f0' : '#ff5400';
      const hotColor = isElectric ? '#ffd166' : '#ff0054';

      const renderHazardSide = (startX: number, width: number, isLeft: boolean) => {
        // Base dangerous pillar backing
        ctx.globalAlpha = 0.75;
        ctx.fillStyle = '#110008';
        ctx.fillRect(startX, 0, width, 720);

        // Hazard glow gradient extending inward
        const glowGrad = ctx.createLinearGradient(startX, 0, isLeft ? startX + width : startX, 0);
        if (isLeft) {
          glowGrad.addColorStop(0, mainColor);
          glowGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        } else {
          glowGrad.addColorStop(0, 'rgba(0, 0, 0, 0)');
          glowGrad.addColorStop(1, mainColor);
        }
        ctx.globalAlpha = 0.45;
        ctx.fillStyle = glowGrad;
        ctx.fillRect(startX, 0, width, 720);

        // Warning Hazard Stripes
        ctx.lineWidth = 3.5;
        ctx.strokeStyle = isElectric ? 'rgba(76, 201, 240, 0.45)' : 'rgba(255, 84, 0, 0.45)';
        for (let y = 0; y < 720; y += 24) {
          ctx.beginPath();
          ctx.moveTo(startX, y);
          ctx.lineTo(startX + width, y + 16);
          ctx.stroke();
        }

        // Crackling lightning arcs or boiling magma surge
        ctx.globalAlpha = 0.95;
        ctx.shadowColor = mainColor;
        ctx.shadowBlur = 18;
        ctx.strokeStyle = hotColor;
        ctx.lineWidth = 3;

        const edgeX = isLeft ? startX + width - 4 : startX + 4;
        ctx.beginPath();
        ctx.moveTo(edgeX, 0);

        const segments = 24;
        const segH = 720 / segments;
        for (let i = 1; i <= segments; i++) {
          const segY = i * segH;
          const jitter = (Math.random() - 0.5) * (isElectric ? 12 : 7);
          ctx.lineTo(edgeX + (isLeft ? -jitter : jitter), segY);
        }
        ctx.stroke();

        // Warning Danger Indicators
        ctx.fillStyle = hotColor;
        for (let y = 80; y < 720; y += 160) {
          ctx.beginPath();
          ctx.arc(isLeft ? startX + 16 : startX + width - 16, y, 5, 0, Math.PI * 2);
          ctx.fill();
        }
      };

      renderHazardSide(0, 42, true);
      renderHazardSide(1238, 42, false);
    }

    // ----------------- KINETIC BOUNCY FORCE-FIELD -----------------
    else if (boundaryType === 'bouncy') {
      const isNeon = theme === 'bouncy-neon';
      const bounceColor = isNeon ? '#f72585' : '#00f5d4';
      const glowColor = isNeon ? '#7209b7' : '#0a9396';

      const renderBouncySide = (startX: number, width: number, isLeft: boolean) => {
        // Shimmering forcefield fill
        const grad = ctx.createLinearGradient(startX, 0, startX + width, 0);
        if (isLeft) {
          grad.addColorStop(0, bounceColor);
          grad.addColorStop(0.75, 'rgba(0, 245, 212, 0.25)');
          grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        } else {
          grad.addColorStop(0, 'rgba(0, 0, 0, 0)');
          grad.addColorStop(0.25, 'rgba(0, 245, 212, 0.25)');
          grad.addColorStop(1, bounceColor);
        }

        ctx.globalAlpha = 0.65;
        ctx.fillStyle = grad;
        ctx.shadowColor = glowColor;
        ctx.shadowBlur = 20;
        ctx.fillRect(startX, 0, width, 720);

        // Sine-wave oscillating compression membrane
        ctx.globalAlpha = 0.95;
        ctx.strokeStyle = bounceColor;
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        const membraneX = isLeft ? startX + width - 6 : startX + 6;
        ctx.moveTo(membraneX, 0);
        for (let y = 0; y <= 720; y += 18) {
          const wave = Math.sin(y * 0.05 + time * 0.007) * 6;
          ctx.lineTo(membraneX + (isLeft ? wave : -wave), y);
        }
        ctx.stroke();

        // Kinetic Diamond Lattice Nodes
        ctx.fillStyle = '#ffffff';
        for (let y = 35; y < 720; y += 65) {
          const diamondY = y + Math.sin(y + time * 0.004) * 5;
          const diamondX = isLeft ? startX + 16 : startX + width - 16;
          ctx.beginPath();
          ctx.moveTo(diamondX, diamondY - 6);
          ctx.lineTo(diamondX + 6, diamondY);
          ctx.lineTo(diamondX, diamondY + 6);
          ctx.lineTo(diamondX - 6, diamondY);
          ctx.closePath();
          ctx.fill();
        }
      };

      renderBouncySide(0, 42, true);
      renderBouncySide(1238, 42, false);
    }

    // ----------------- GALE-FORCE UPDRAFT VORTEX -----------------
    else if (boundaryType === 'updraft') {
      const renderUpdraftSide = (startX: number, width: number, isLeft: boolean) => {
        // Vertical wind stream columns
        const windGrad = ctx.createLinearGradient(startX, 0, startX + width, 0);
        if (isLeft) {
          windGrad.addColorStop(0, 'rgba(144, 224, 239, 0.45)');
          windGrad.addColorStop(1, 'rgba(144, 224, 239, 0)');
        } else {
          windGrad.addColorStop(0, 'rgba(144, 224, 239, 0)');
          windGrad.addColorStop(1, 'rgba(144, 224, 239, 0.45)');
        }

        ctx.globalAlpha = 0.55;
        ctx.fillStyle = windGrad;
        ctx.fillRect(startX, 0, width, 720);

        // Rising wind currents (spiraling upward)
        ctx.strokeStyle = '#caf0f8';
        ctx.lineWidth = 2.5;
        ctx.shadowColor = '#90e0ef';
        ctx.shadowBlur = 10;

        const numStreams = 5;
        for (let s = 0; s < numStreams; s++) {
          const streamBaseX = startX + (s + 0.5) * (width / numStreams);
          const scrollY = (time * 0.32 + s * 140) % 720;

          ctx.beginPath();
          for (let dy = 0; dy < 160; dy += 12) {
            const y = 720 - (scrollY + dy) % 720;
            const sway = Math.sin(y * 0.03 + s + time * 0.005) * 8;
            if (dy === 0) ctx.moveTo(streamBaseX + sway, y);
            else ctx.lineTo(streamBaseX + sway, y);
          }
          ctx.stroke();
        }
      };

      renderUpdraftSide(0, 80, true);
      renderUpdraftSide(1200, 80, false);
    }

    ctx.restore();
  }
}

