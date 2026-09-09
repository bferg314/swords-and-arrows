import { Camera } from './Camera';
import { InputManager } from './InputManager';
import { SoundEngine } from './SoundEngine';
import { ParticleSystem } from './ParticleSystem';
import { ArenaMap } from '../maps/MapTypes';
import { ARENA_MAPS, getRandomMap, getMapById } from '../maps/MapRegistry';
import { Player } from '../entities/Player';
import { BotController } from '../entities/BotController';
import { Projectile } from '../entities/Projectile';
import { PowerUpDefinition } from '../powerups/PowerUpTypes';
import { drawRandomPowerUps } from '../powerups/PowerUpRegistry';

export type GameState = 'lobby' | 'playing' | 'round-end' | 'draft' | 'podium';

export interface GamePlayerConfig {
  slot: number;
  active: boolean;
  name: string;
  color: string;
  type: 'human' | 'cpu-easy' | 'cpu-med' | 'cpu-hard';
}

export class Game {
  public canvas: HTMLCanvasElement;
  public ctx: CanvasRenderingContext2D;
  public camera: Camera;
  public input: InputManager;
  public sound: SoundEngine;
  public particles: ParticleSystem;

  public state: GameState = 'lobby';
  public currentMap: ArenaMap;
  public players: Player[] = [];
  public bots: Map<number, BotController> = new Map();
  public projectiles: Projectile[] = [];

  // Match Configuration
  public targetWins: number = 3;
  public roundHp: number = 3;
  public roundNumber: number = 1;
  public selectedMapId: string = 'random';

  // Round flow state
  private roundStateTimer: number = 0;
  public roundWinner: Player | null = null;
  public matchWinner: Player | null = null;

  // Loser Draft queue (in case multiple losers draft)
  public draftQueue: Player[] = [];
  public currentDraftingPlayer: Player | null = null;
  public currentDraftCards: PowerUpDefinition[] = [];

  // Pause State
  public isPaused: boolean = false;

  // UI callbacks
  public onHudUpdate?: (game: Game) => void;
  public onRoundAnnounce?: (title: string, sub: string) => void;
  public onDraftOpen?: (player: Player, cards: PowerUpDefinition[]) => void;
  public onDraftClose?: () => void;
  public onPodiumOpen?: (winner: Player, rankings: Player[]) => void;
  public onPauseChange?: (isPaused: boolean) => void;
  public onMenuUpdate?: (dt: number) => void;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.camera = new Camera();
    this.input = new InputManager();
    this.sound = new SoundEngine();
    this.particles = new ParticleSystem();

    this.currentMap = ARENA_MAPS[0];
  }

  public initMatch(playerConfigs: GamePlayerConfig[], mapId: string = 'random', targetWins: number = 3, roundHp: number = 3): void {
    this.sound.init();
    this.selectedMapId = mapId;
    this.targetWins = targetWins;
    this.roundHp = roundHp;
    this.roundNumber = 1;
    this.matchWinner = null;
    this.roundWinner = null;
    this.isPaused = false;
    this.projectiles = [];
    this.particles.clear();
    this.input.resetMatchInput();

    const humanCount = playerConfigs.filter(cfg => cfg.active && !cfg.type.startsWith('cpu')).length;
    this.input.setSingleHumanMatch(humanCount <= 1);

    // Select arena map
    if (mapId === 'random') {
      this.currentMap = getRandomMap();
    } else {
      this.currentMap = getMapById(mapId) || ARENA_MAPS[0];
    }

    // Instantiate players
    this.players = [];
    this.bots.clear();

    playerConfigs.forEach((cfg) => {
      if (!cfg.active) return;
      const isCpu = cfg.type.startsWith('cpu');
      const p = new Player(cfg.slot, cfg.name, cfg.color, isCpu);
      if (isCpu) {
        if (cfg.type === 'cpu-easy') p.cpuDifficulty = 'easy';
        else if (cfg.type === 'cpu-hard') p.cpuDifficulty = 'hard';
        else p.cpuDifficulty = 'med';
        this.bots.set(cfg.slot, new BotController(p));
      }
      this.players.push(p);
    });

    this.startRound();
  }

  public startRound(): void {
    this.state = 'playing';
    this.roundWinner = null;
    this.projectiles = [];
    this.particles.clear();
    this.camera.reset();

    // If map was set to random, rotate map each round for maximum fun!
    if (this.selectedMapId === 'random' && this.roundNumber > 1) {
      this.currentMap = getRandomMap();
    }

    // Reset platforms (e.g. crumble blocks)
    for (const plat of this.currentMap.platforms) {
      if (plat.crumble) {
        plat.crumbleState = 'solid';
        plat.crumbleTimer = 0;
      }
    }

    // Spawn players
    const spawns = this.currentMap.spawnPoints;
    this.players.forEach((p, index) => {
      const sp = spawns[index % spawns.length];
      p.resetForRound(sp.x, sp.y, this.roundHp);
    });

    if (this.onRoundAnnounce) {
      this.onRoundAnnounce(`ROUND ${this.roundNumber}`, `FIRST TO ${this.targetWins} WINS`);
    }

    if (this.onHudUpdate) {
      this.onHudUpdate(this);
    }
  }

  public update(dt: number): void {
    // UI & Gamepad Menu Navigator update
    if (this.onMenuUpdate) {
      this.onMenuUpdate(dt);
    }

    if (this.isPaused) {
      this.input.endFrame();
      return;
    }

    // 1. Update Game Loop based on State
    if (this.state === 'playing') {
      this.updateBattle(dt);
    } else if (this.state === 'round-end') {
      this.roundStateTimer -= dt;
      if (this.roundStateTimer <= 0) {
        this.advanceFromRoundEnd();
      }
    }

    // Always update visual FX & camera
    this.particles.update(dt);
    this.camera.update(dt, this.players.map(p => ({ x: p.x, y: p.y, isAlive: p.isAlive })));

    // End frame input clearances
    this.input.endFrame();
  }

  public pause(): void {
    if (this.state !== 'playing' || this.isPaused) return;
    this.isPaused = true;
    if (this.onPauseChange) this.onPauseChange(true);
  }

  public resume(): void {
    if (!this.isPaused) return;
    this.isPaused = false;
    if (this.onPauseChange) this.onPauseChange(false);
  }

  public togglePause(): void {
    if (this.isPaused) {
      this.resume();
    } else {
      this.pause();
    }
  }

  private updateBattle(dt: number): void {
    // 1. Update platforms (crumble timer)
    for (const plat of this.currentMap.platforms) {
      if (plat.crumble && plat.crumbleState === 'shaking') {
        plat.crumbleTimer = (plat.crumbleTimer ?? 0.6) - dt;
        if (plat.crumbleTimer <= 0) {
          plat.crumbleState = 'vanished';
          this.particles.emitSparks(plat.x + plat.w * 0.5, plat.y, 12, '#a4161a');
        }
      }
    }

    // 2. Generate inputs for Bots
    this.bots.forEach((bot, slot) => {
      const botInput = bot.generateInput(
        dt,
        this.players,
        this.projectiles,
        this.currentMap.platforms,
        this.currentMap.hazards
      );
      this.input.setVirtualInput(slot as any, botInput);
    });

    // 3. Update Players
    const activePlatforms = this.currentMap.platforms.filter(p => p.crumbleState !== 'vanished');
    const gravScale = this.currentMap.gravityScale ?? 1.0;

    for (const p of this.players) {
      const pInput = this.input.getInput(p.index as any);
      p.update(
        dt,
        pInput,
        activePlatforms,
        this.currentMap.hazards,
        this.sound,
        this.particles,
        this.projectiles,
        this.players,
        this.currentMap.hasScreenWrap ?? false,
        gravScale
      );
    }

    // 4. Update Projectiles & Collisions
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const proj = this.projectiles[i];
      proj.update(dt, this.players.map(p => ({ x: p.x, y: p.y, isAlive: p.isAlive, index: p.index })));

      // Emit flight particles
      if (!proj.isStuck && Math.random() < 0.4) {
        this.particles.emitArrowTrail(proj.x, proj.y, proj.color);
      }

      if (proj.isDead) {
        this.projectiles.splice(i, 1);
        continue;
      }

      if (proj.isStuck) continue;

      // Check collision against other projectiles (mid-air arrow clash!)
      for (let j = i - 1; j >= 0; j--) {
        const otherProj = this.projectiles[j];
        if (!otherProj.isStuck && otherProj.ownerIndex !== proj.ownerIndex) {
          const d = Math.hypot(otherProj.x - proj.x, otherProj.y - proj.y);
          if (d < 18) {
            // Arrow clash!
            this.sound.playSwordClash();
            this.particles.emitSparks((proj.x + otherProj.x) * 0.5, (proj.y + otherProj.y) * 0.5, 14, '#ffd166');
            proj.vx *= -0.4;
            proj.vy = 200;
            otherProj.vx *= -0.4;
            otherProj.vy = 200;
            break;
          }
        }
      }

      // Check collision against platforms
      if (!proj.isPiercing) {
        for (const plat of activePlatforms) {
          if (
            proj.x > plat.x &&
            proj.x < plat.x + plat.w &&
            proj.y > plat.y &&
            proj.y < plat.y + plat.h
          ) {
            // Ricochet check
            if (proj.bouncesLeft > 0) {
              proj.bouncesLeft--;
              proj.vy = -proj.vy * 1.1;
              proj.vx *= 1.1;
              this.sound.playArrowWallHit();
              this.particles.emitSparks(proj.x, proj.y, 8, proj.color);
            } else if (proj.isExplosive) {
              // Explode!
              this.sound.playExplosion();
              this.particles.emitExplosion(proj.x, proj.y, 45);
              this.camera.addTrauma(0.4);
              // AOE blast
              for (const p of this.players) {
                if (p.isAlive) {
                  const dist = Math.hypot(p.x - proj.x, p.y - proj.y);
                  if (dist < 85) {
                    const blastDir = Math.atan2(p.y - proj.y, p.x - proj.x);
                    p.takeDamage(1, Math.cos(blastDir) * 450, Math.sin(blastDir) * 350, this.sound, this.particles);
                  }
                }
              }
              proj.isDead = true;
            } else if (proj.isShrapnel) {
              // Split into 3 fragments
              this.sound.playExplosion();
              for (let s = 0; s < 3; s++) {
                const sAngle = (s - 1) * 0.4 - Math.PI * 0.5;
                this.projectiles.push(new Projectile({
                  x: proj.x,
                  y: proj.y,
                  vx: Math.cos(sAngle) * 550,
                  vy: Math.sin(sAngle) * 550,
                  ownerIndex: proj.ownerIndex,
                  damage: 1,
                  type: 'shrapnel',
                  color: '#ff9e00'
                }));
              }
              proj.isDead = true;
            } else {
              // Stick in platform
              proj.stick(plat, proj.x, proj.y);
              this.sound.playArrowWallHit();
              this.particles.emitDust(proj.x, proj.y, 4);
            }
            break;
          }
        }
      }

      // Check collision against players
      if (!proj.isDead && !proj.isStuck) {
        for (const p of this.players) {
          if (p.isAlive && p.index !== proj.ownerIndex && !p.isInvulnerable) {
            const hitDist = Math.hypot(p.x - proj.x, p.y - proj.y);
            if (hitDist < 26) {
              // Check if player is parrying
              if (p.isParrying) {
                // Parried and reflected!
                const speedMultiplier = p.hasPowerUp('aegis-mastery') ? 2.2 : 1.7;
                proj.reflect(p.index, speedMultiplier);
                if (p.hasPowerUp('aegis-mastery')) {
                  proj.isExplosive = true;
                }
                this.sound.playParrySuccess();
                this.particles.emitSparks(proj.x, proj.y, 18, '#ffd166');
                this.camera.addTrauma(0.3);
                p.stats.parries++;
                break;
              }

              // Direct hit on player
              const kbX = Math.sign(proj.vx) * (proj.isCharged ? 480 : 320);
              const kbY = -220;
              const ownerPlayer = this.players.find(pl => pl.index === proj.ownerIndex);

              p.takeDamage(proj.damage, kbX, kbY, this.sound, this.particles, ownerPlayer);
              this.camera.addTrauma(0.35);

              // Frostbite freeze
              if (proj.isFrost) {
                p.freezeTimer = 1.2;
                this.particles.emitIceCrystals(p.x, p.y);
              }

              // Grapple pull archer to hit player
              if (proj.isGrapple && ownerPlayer && ownerPlayer.isAlive) {
                ownerPlayer.x = p.x - Math.sign(proj.vx) * 35;
                ownerPlayer.y = p.y;
                ownerPlayer.vx = 0;
                ownerPlayer.vy = -180;
                this.particles.emitSparks(ownerPlayer.x, ownerPlayer.y, 10, '#52b788');
              }

              // Explosive Payload detonation
              if (proj.isExplosive) {
                this.sound.playExplosion();
                this.particles.emitExplosion(proj.x, proj.y, 50);
              }

              proj.isDead = true;
              break;
            }
          }
        }
      }
    }

    // 5. Check Round End Condition: only 1 or 0 players alive
    const alivePlayers = this.players.filter(p => p.isAlive);
    if (alivePlayers.length <= 1) {
      this.state = 'round-end';
      this.roundStateTimer = 2.0;

      if (alivePlayers.length === 1) {
        this.roundWinner = alivePlayers[0];
        this.roundWinner.wins++;
        this.sound.playRoundWinHorn();
        this.particles.emitConfetti(this.roundWinner.x, this.roundWinner.y, 60);

        if (this.onRoundAnnounce) {
          this.onRoundAnnounce(`${this.roundWinner.name.toUpperCase()} WINS!`, `SCORE: ${this.roundWinner.wins} / ${this.targetWins}`);
        }
      } else {
        // Draw round
        this.roundWinner = null;
        if (this.onRoundAnnounce) {
          this.onRoundAnnounce('DOUBLE KO!', 'DRAW ROUND');
        }
      }

      if (this.onHudUpdate) {
        this.onHudUpdate(this);
      }
    }

    if (this.onHudUpdate) {
      this.onHudUpdate(this);
    }
  }

  private advanceFromRoundEnd(): void {
    // Check if a player reached 3 wins
    const grandChampion = this.players.find(p => p.wins >= this.targetWins);
    if (grandChampion) {
      this.state = 'podium';
      this.matchWinner = grandChampion;
      this.sound.playMatchVictoryFanfare();

      // Rank players by wins then kills
      const rankings = [...this.players].sort((a, b) => {
        if (b.wins !== a.wins) return b.wins - a.wins;
        return b.stats.kills - a.stats.kills;
      });

      if (this.onPodiumOpen) {
        this.onPodiumOpen(grandChampion, rankings);
      }
      return;
    }

    // Match continues! Set up Underdog Draft for round loser(s)
    this.roundNumber++;

    // Loser(s) are all players who did NOT win this round
    this.draftQueue = this.players.filter(p => p !== this.roundWinner);

    if (this.draftQueue.length > 0) {
      this.state = 'draft';
      this.advanceDraftQueue();
    } else {
      this.startRound();
    }
  }

  private advanceDraftQueue(): void {
    if (this.draftQueue.length === 0) {
      // Draft finished! Start next round
      if (this.onDraftClose) this.onDraftClose();
      this.startRound();
      return;
    }

    this.currentDraftingPlayer = this.draftQueue.shift()!;
    // Draw 3 random powerups
    const existingPowerUps = Object.keys(this.currentDraftingPlayer.powerUps);
    this.currentDraftCards = drawRandomPowerUps(3, existingPowerUps);

    this.sound.playPowerUpDraftChime();

    if (this.currentDraftingPlayer.isCpu) {
      // Bot selects after a brief realistic pause
      const bot = this.bots.get(this.currentDraftingPlayer.index);
      const chosen = bot ? bot.pickDraftPowerUp(this.currentDraftCards) : this.currentDraftCards[0];

      if (this.onDraftOpen) {
        this.onDraftOpen(this.currentDraftingPlayer, this.currentDraftCards);
      }

      setTimeout(() => {
        this.selectDraftPowerUp(chosen);
      }, 1400);
    } else {
      // Human selects via UI
      if (this.onDraftOpen) {
        this.onDraftOpen(this.currentDraftingPlayer, this.currentDraftCards);
      }
    }
  }

  public selectDraftPowerUp(card: PowerUpDefinition): void {
    if (!this.currentDraftingPlayer) return;
    const player = this.currentDraftingPlayer;
    this.currentDraftingPlayer = null;

    player.powerUps[card.id] = true;
    this.sound.playPowerUpDraftChime();
    this.particles.emitSparks(640, 360, 24, card.color);

    // Advance to next loser in draft queue
    this.advanceDraftQueue();
  }

  public render(): void {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // 1. Render Parallax Background
    this.renderBackground(ctx);

    // 2. Apply Dynamic Camera Transform
    this.camera.applyTransform(ctx);

    // 3. Render Arena Platforms & Hazards
    this.renderPlatformsAndHazards(ctx);

    // 4. Render Projectiles (stuck & in-flight)
    for (const proj of this.projectiles) {
      proj.render(ctx);
    }

    // 5. Render Players
    for (const p of this.players) {
      p.render(ctx);
    }

    // 6. Render Particles
    this.particles.render(ctx);

    // 7. Reset Camera Transform
    this.camera.resetTransform(ctx);
  }

  private renderBackground(ctx: CanvasRenderingContext2D): void {
    const map = this.currentMap;

    // Gradient background
    const grad = ctx.createLinearGradient(0, 0, 0, 720);
    grad.addColorStop(0, map.bgGradient[0]);
    grad.addColorStop(1, map.bgGradient[1]);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 1280, 720);

    // Ambient floating particles
    ctx.save();
    const time = performance.now() * 0.001;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';

    for (let i = 0; i < 24; i++) {
      const px = ((i * 57 + time * 20) % 1320) - 20;
      const py = ((i * 37 + Math.sin(time + i) * 30 + 100) % 740);
      const size = (i % 3) + 1.5;
      ctx.beginPath();
      ctx.arc(px, py, size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  private renderPlatformsAndHazards(ctx: CanvasRenderingContext2D): void {
    // Render Hazards
    for (const h of this.currentMap.hazards) {
      if (!h.active) continue;
      ctx.save();
      if (h.type === 'lava') {
        const time = performance.now() * 0.003;
        ctx.fillStyle = '#d90429';
        ctx.shadowColor = '#ff5400';
        ctx.shadowBlur = 20;
        ctx.fillRect(h.x, h.y, h.w, h.h);
        // Molten glow ripples
        ctx.fillStyle = '#ffba08';
        for (let x = h.x; x < h.x + h.w; x += 30) {
          const waveY = h.y + Math.sin(x * 0.05 + time) * 6;
          ctx.fillRect(x, waveY, 20, 6);
        }
      } else if (h.type === 'spikes') {
        ctx.fillStyle = '#660708';
        ctx.strokeStyle = '#e5383b';
        ctx.lineWidth = 2;
        const spikeW = 20;
        for (let sx = h.x; sx < h.x + h.w; sx += spikeW) {
          ctx.beginPath();
          ctx.moveTo(sx, h.y + h.h);
          ctx.lineTo(sx + spikeW * 0.5, h.y);
          ctx.lineTo(sx + spikeW, h.y + h.h);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        }
      } else if (h.type === 'laser') {
        ctx.fillStyle = 'rgba(247, 37, 133, 0.7)';
        ctx.shadowColor = '#f72585';
        ctx.shadowBlur = 18;
        ctx.fillRect(h.x, h.y, h.w, h.h);
      } else if (h.type === 'acid') {
        ctx.fillStyle = '#2d6a4f';
        ctx.shadowColor = '#52b788';
        ctx.shadowBlur = 15;
        ctx.fillRect(h.x, h.y, h.w, h.h);
      }
      ctx.restore();
    }

    // Render Platforms
    for (const plat of this.currentMap.platforms) {
      if (plat.crumbleState === 'vanished') continue;

      ctx.save();
      const shakeOffset = plat.crumbleState === 'shaking' ? (Math.random() - 0.5) * 4 : 0;
      ctx.translate(shakeOffset, 0);

      // Main body
      ctx.fillStyle = plat.color || '#334155';
      ctx.fillRect(plat.x, plat.y, plat.w, plat.h);

      // Top glowing border / ledge
      ctx.strokeStyle = plat.borderColor || '#94a3b8';
      ctx.lineWidth = plat.oneWay ? 3 : 2;
      ctx.strokeRect(plat.x, plat.y, plat.w, plat.h);

      // Bouncy highlight
      if (plat.bouncy) {
        ctx.fillStyle = '#00b4d8';
        ctx.shadowColor = '#00b4d8';
        ctx.shadowBlur = 8;
        ctx.fillRect(plat.x, plat.y, plat.w, 4);
      }

      // Speed boost arrows
      if (plat.speedBoost) {
        ctx.fillStyle = plat.speedBoost > 0 ? '#00f5d4' : '#f72585';
        ctx.font = 'bold 12px Outfit';
        ctx.textAlign = 'center';
        const arrow = plat.speedBoost > 0 ? '>>>' : '<<<';
        ctx.fillText(arrow, plat.x + plat.w * 0.5, plat.y + 8);
      }

      ctx.restore();
    }
  }
}
