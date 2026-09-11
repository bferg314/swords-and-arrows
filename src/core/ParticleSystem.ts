export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  life: number;
  maxLife: number;
  alpha: number;
  shape?: 'circle' | 'square' | 'line' | 'spark' | 'sparkle';
  gravity?: number;
  friction?: number;
}

export interface SlashArc {
  x: number;
  y: number;
  angle: number;
  radius: number;
  startAngle: number;
  endAngle: number;
  color: string;
  life: number;
  maxLife: number;
  width: number;
}

export interface LightningBolt {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  segments: { x: number; y: number }[];
  color: string;
  life: number;
  maxLife: number;
}

export interface FloatingCombatText {
  x: number;
  y: number;
  vy: number;
  text: string;
  color: string;
  fontSize: number;
  life: number;
  maxLife: number;
  scale: number;
}

export class ParticleSystem {
  private particles: Particle[] = [];
  private slashArcs: SlashArc[] = [];
  private lightningBolts: LightningBolt[] = [];
  private floatingTexts: FloatingCombatText[] = [];

  public update(dt: number): void {
    // Update particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }

      p.vx *= p.friction ?? 0.96;
      p.vy *= p.friction ?? 0.96;
      p.vy += (p.gravity ?? 180) * dt;

      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.alpha = Math.max(0, p.life / p.maxLife);
    }

    // Update slash arcs
    for (let i = this.slashArcs.length - 1; i >= 0; i--) {
      const arc = this.slashArcs[i];
      arc.life -= dt;
      if (arc.life <= 0) {
        this.slashArcs.splice(i, 1);
      }
    }

    // Update lightning bolts
    for (let i = this.lightningBolts.length - 1; i >= 0; i--) {
      const bolt = this.lightningBolts[i];
      bolt.life -= dt;
      if (bolt.life <= 0) {
        this.lightningBolts.splice(i, 1);
      }
    }

    // Update floating combat texts
    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i];
      ft.life -= dt;
      if (ft.life <= 0) {
        this.floatingTexts.splice(i, 1);
        continue;
      }
      ft.y += ft.vy * dt;
      ft.vy *= 0.93; // Smooth decelerating float
    }
  }

  public render(ctx: CanvasRenderingContext2D): void {
    ctx.save();

    // Render slash arcs
    for (const arc of this.slashArcs) {
      const alpha = Math.max(0, arc.life / arc.maxLife);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = arc.color;
      ctx.lineWidth = arc.width * (arc.life / arc.maxLife);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(arc.x, arc.y, arc.radius, arc.startAngle, arc.endAngle);
      ctx.stroke();

      // Inner white hot core
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = arc.width * 0.4;
      ctx.stroke();
      ctx.restore();
    }

    // Render lightning bolts
    for (const bolt of this.lightningBolts) {
      const alpha = Math.max(0, bolt.life / bolt.maxLife);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = bolt.color;
      ctx.lineWidth = 3;
      ctx.shadowColor = bolt.color;
      ctx.shadowBlur = 12;

      ctx.beginPath();
      if (bolt.segments.length > 0) {
        ctx.moveTo(bolt.segments[0].x, bolt.segments[0].y);
        for (let j = 1; j < bolt.segments.length; j++) {
          ctx.lineTo(bolt.segments[j].x, bolt.segments[j].y);
        }
      }
      ctx.stroke();
      ctx.restore();
    }

    // Render particles
    for (const p of this.particles) {
      ctx.save();
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.color;

      if (p.shape === 'spark') {
        const speed = Math.hypot(p.vx, p.vy);
        const angle = Math.atan2(p.vy, p.vx);
        ctx.translate(p.x, p.y);
        ctx.rotate(angle);
        ctx.fillRect(-p.size * 1.5, -p.size * 0.5, p.size * (2 + speed * 0.01), p.size);
      } else if (p.shape === 'square') {
        ctx.fillRect(p.x - p.size * 0.5, p.y - p.size * 0.5, p.size, p.size);
      } else {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * 0.5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // Render floating combat texts
    for (const ft of this.floatingTexts) {
      const progress = 1 - (ft.life / ft.maxLife);
      const alpha = Math.max(0, Math.min(1, ft.life / (ft.maxLife * 0.4)));
      // Pop in scale effect: starts scaled up, settles, then floats
      const currentScale = progress < 0.2
        ? ft.scale * (0.8 + progress * 2.5)
        : ft.scale * (1.0 + progress * 0.2);

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.font = `900 ${Math.round(ft.fontSize * currentScale)}px Outfit, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      // Thick black stroke outline for high readability against any arena background
      ctx.strokeStyle = '#020617';
      ctx.lineWidth = 3.5;
      ctx.shadowColor = ft.color;
      ctx.shadowBlur = 10;
      ctx.strokeText(ft.text, ft.x, ft.y);

      // Vibrant inner fill
      ctx.fillStyle = ft.color;
      ctx.fillText(ft.text, ft.x, ft.y);
      ctx.restore();
    }

    ctx.restore();
  }

  public createSlashArc(
    x: number,
    y: number,
    radius: number,
    facingLeft: boolean,
    color: string,
    arcType: 'slash1' | 'slash2' | 'finisher' | 'downthrust' = 'slash1'
  ): void {
    let startAngle: number;
    let endAngle: number;
    let width: number = 14;
    let life: number = 0.14;

    if (arcType === 'slash2') {
      // Cross slash (low-to-high reverse slice)
      startAngle = facingLeft ? Math.PI * 1.3 : -Math.PI * 0.7;
      endAngle = facingLeft ? Math.PI * 0.5 : Math.PI * 0.3;
      width = 16;
      life = 0.16;
    } else if (arcType === 'finisher') {
      // 3rd hit finisher: massive blazing sweep arc
      startAngle = facingLeft ? Math.PI * 1.6 : -Math.PI * 0.6;
      endAngle = facingLeft ? Math.PI * 0.2 : Math.PI * 0.8;
      width = 22;
      life = 0.22;
    } else if (arcType === 'downthrust') {
      // Down thrust: concentrated downward cone arc
      startAngle = Math.PI * 0.2;
      endAngle = Math.PI * 0.8;
      width = 16;
      life = 0.15;
    } else {
      // Standard slash 1 (high-to-low diagonal sweep)
      startAngle = facingLeft ? Math.PI * 0.6 : -Math.PI * 0.4;
      endAngle = facingLeft ? Math.PI * 1.4 : Math.PI * 0.4;
      width = 14;
      life = 0.14;
    }

    this.slashArcs.push({
      x,
      y,
      angle: 0,
      radius,
      startAngle,
      endAngle,
      color,
      life,
      maxLife: life,
      width
    });
  }

  public emitSparks(x: number, y: number, count: number = 12, color: string = '#ffd166'): void {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 120 + Math.random() * 260;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color,
        size: 2.5 + Math.random() * 2.5,
        life: 0.2 + Math.random() * 0.25,
        maxLife: 0.35,
        alpha: 1,
        shape: 'spark',
        gravity: 280,
        friction: 0.94
      });
    }
  }

  public emitDust(x: number, y: number, count: number = 6): void {
    for (let i = 0; i < count; i++) {
      this.particles.push({
        x: x + (Math.random() - 0.5) * 16,
        y: y + (Math.random() - 0.5) * 6,
        vx: (Math.random() - 0.5) * 60,
        vy: -20 - Math.random() * 40,
        color: 'rgba(200, 210, 225, 0.7)',
        size: 3 + Math.random() * 4,
        life: 0.25 + Math.random() * 0.2,
        maxLife: 0.4,
        alpha: 0.8,
        shape: 'circle',
        gravity: -20,
        friction: 0.9
      });
    }
  }

  public emitArrowTrail(x: number, y: number, color: string = 'rgba(255,255,255,0.6)'): void {
    this.particles.push({
      x,
      y,
      vx: (Math.random() - 0.5) * 10,
      vy: (Math.random() - 0.5) * 10,
      color,
      size: 3 + Math.random() * 2,
      life: 0.18,
      maxLife: 0.18,
      alpha: 0.8,
      shape: 'circle',
      gravity: 0,
      friction: 0.92
    });
  }

  public emitExplosion(x: number, y: number, radius: number = 30): void {
    // Shockwave ring + fiery debris
    for (let i = 0; i < 28; i++) {
      const angle = (i / 28) * Math.PI * 2 + (Math.random() - 0.5) * 0.2;
      const speed = 80 + Math.random() * 220;
      const colors = ['#ff4d6d', '#ffb703', '#ffffff', '#fb8500'];
      const color = colors[Math.floor(Math.random() * colors.length)];

      this.particles.push({
        x: x + Math.cos(angle) * (radius * 0.2),
        y: y + Math.sin(angle) * (radius * 0.2),
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color,
        size: 3 + Math.random() * 4,
        life: 0.35 + Math.random() * 0.25,
        maxLife: 0.5,
        alpha: 1,
        shape: 'spark',
        gravity: 120,
        friction: 0.9
      });
    }
  }

  public emitFirePatch(x: number, y: number, count: number = 4): void {
    for (let i = 0; i < count; i++) {
      this.particles.push({
        x: x + (Math.random() - 0.5) * 24,
        y: y + (Math.random() - 0.5) * 8,
        vx: (Math.random() - 0.5) * 20,
        vy: -30 - Math.random() * 50,
        color: Math.random() > 0.4 ? '#ff5400' : '#ffdd00',
        size: 3 + Math.random() * 3,
        life: 0.4 + Math.random() * 0.3,
        maxLife: 0.6,
        alpha: 0.9,
        shape: 'circle',
        gravity: -40,
        friction: 0.95
      });
    }
  }

  public emitIceCrystals(x: number, y: number): void {
    for (let i = 0; i < 14; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 50 + Math.random() * 120;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color: '#4cc9f0',
        size: 2 + Math.random() * 3,
        life: 0.3 + Math.random() * 0.2,
        maxLife: 0.45,
        alpha: 1,
        shape: 'sparkle',
        gravity: 80,
        friction: 0.92
      });
    }
  }

  public emitLightningStrike(startX: number, startY: number, endX: number, endY: number): void {
    const segments: { x: number; y: number }[] = [];
    const steps = 12;
    segments.push({ x: startX, y: startY });

    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      const interpX = startX + (endX - startX) * t;
      const interpY = startY + (endY - startY) * t;
      const jitterX = (Math.random() - 0.5) * 36;
      segments.push({ x: interpX + jitterX, y: interpY });
    }
    segments.push({ x: endX, y: endY });

    this.lightningBolts.push({
      startX,
      startY,
      endX,
      endY,
      segments,
      color: '#70d6ff',
      life: 0.18,
      maxLife: 0.18
    });

    this.emitSparks(endX, endY, 15, '#70d6ff');
  }

  public emitDirectionalSparks(
    x: number,
    y: number,
    dirX: number,
    dirY: number,
    count: number = 16,
    color: string = '#ffd166'
  ): void {
    const baseAngle = Math.atan2(dirY, dirX);
    for (let i = 0; i < count; i++) {
      const spread = (Math.random() - 0.5) * Math.PI * 0.7;
      const angle = baseAngle + spread;
      const speed = 180 + Math.random() * 320;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color,
        size: 3 + Math.random() * 3,
        life: 0.22 + Math.random() * 0.22,
        maxLife: 0.4,
        alpha: 1,
        shape: 'spark',
        gravity: 240,
        friction: 0.94
      });
    }
  }

  public emitCombatText(
    x: number,
    y: number,
    text: string,
    color: string = '#ffd166',
    fontSize: number = 14
  ): void {
    this.floatingTexts.push({
      x: x + (Math.random() - 0.5) * 12,
      y: y - 10,
      vy: -110 - Math.random() * 40,
      text,
      color,
      fontSize,
      life: 0.85,
      maxLife: 0.85,
      scale: 1.35
    });
  }

  public emitConfetti(x: number, y: number, count: number = 40): void {
    const colors = ['#ffd166', '#06d6a0', '#118ab2', '#ef476f', '#f72585', '#ffffff'];
    for (let i = 0; i < count; i++) {
      const angle = -Math.PI * 0.5 + (Math.random() - 0.5) * Math.PI * 0.8;
      const speed = 150 + Math.random() * 250;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color: colors[Math.floor(Math.random() * colors.length)],
        size: 4 + Math.random() * 4,
        life: 1.2 + Math.random() * 0.8,
        maxLife: 1.8,
        alpha: 1,
        shape: 'square',
        gravity: 160,
        friction: 0.98
      });
    }
  }

  public clear(): void {
    this.particles = [];
    this.slashArcs = [];
    this.lightningBolts = [];
    this.floatingTexts = [];
  }
}
