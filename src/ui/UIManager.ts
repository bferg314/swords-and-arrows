import { Game, GamePlayerConfig } from '../core/Game';
import { ARENA_MAPS } from '../maps/MapRegistry';
import { SWORD_POWERUPS, BOW_POWERUPS } from '../powerups/PowerUpRegistry';
import { PowerUpDefinition } from '../powerups/PowerUpTypes';
import { Player } from '../entities/Player';
import { GamepadNavigator } from './GamepadNavigator';

export class UIManager {
  private game: Game;
  private gamepadNav: GamepadNavigator;

  // Screen elements
  private titleScreen = document.getElementById('title-screen')!;
  private lobbyScreen = document.getElementById('lobby-screen')!;
  private mapSelectScreen = document.getElementById('map-select-screen')!;
  private controlsScreen = document.getElementById('controls-screen')!;
  private codexScreen = document.getElementById('codex-screen')!;
  private draftScreen = document.getElementById('draft-screen')!;
  private podiumScreen = document.getElementById('podium-screen')!;
  private pauseScreen = document.getElementById('pause-screen')!;
  private hudLayer = document.getElementById('hud-layer')!;

  // Lobby state
  private playerConfigs: GamePlayerConfig[] = [
    { slot: 0, active: true, name: 'Player 1', color: '#e63946', type: 'human' },
    { slot: 1, active: true, name: 'Player 2', color: '#4361ee', type: 'cpu-med' },
    { slot: 2, active: false, name: 'Player 3', color: '#2ec4b6', type: 'cpu-med' },
    { slot: 3, active: false, name: 'Player 4', color: '#ffb703', type: 'cpu-med' }
  ];
  private selectedMapId: string = 'random';
  private targetWins: number = 3;
  private roundHp: number = 3;

  constructor(game: Game) {
    this.game = game;
    this.gamepadNav = new GamepadNavigator(this.game.input);
    this.game.onMenuUpdate = (dt: number) => {
      this.gamepadNav.update(dt);
    };
    this.initEventListeners();
    this.populateMapGrid();
    this.populateCodex();
    this.updateSpritePreviews();
    this.bindGameCallbacks();
    this.gamepadNav.setScreen('title');
  }

  private initEventListeners(): void {
    // Match Rules (Target Wins & Round HP)
    const targetWinsSelect = document.getElementById('lobby-target-wins') as HTMLSelectElement;
    targetWinsSelect?.addEventListener('change', (e) => {
      this.targetWins = parseInt((e.target as HTMLSelectElement).value, 10) || 3;
    });

    const roundHpSelect = document.getElementById('lobby-round-hp') as HTMLSelectElement;
    roundHpSelect?.addEventListener('change', (e) => {
      this.roundHp = parseInt((e.target as HTMLSelectElement).value, 10) || 3;
    });

    // Desktop App Support (Electron)
    if (this.isDesktopApp()) {
      document.querySelectorAll('.desktop-only').forEach(el => {
        el.classList.remove('hidden');
      });
    }

    const handleExitGame = () => {
      if ((window as any).electronAPI?.exitGame) {
        (window as any).electronAPI.exitGame();
      } else {
        window.close();
      }
    };

    document.getElementById('btn-exit-game')?.addEventListener('click', handleExitGame);
    document.getElementById('btn-podium-exit')?.addEventListener('click', handleExitGame);
    document.getElementById('btn-pause-exit')?.addEventListener('click', handleExitGame);

    // Pause Screen buttons
    document.getElementById('btn-pause-resume')?.addEventListener('click', () => {
      this.game.resume();
    });

    document.getElementById('btn-pause-restart')?.addEventListener('click', () => {
      this.game.resume();
      this.startGameMatch();
    });

    document.getElementById('btn-pause-menu')?.addEventListener('click', () => {
      this.game.resume();
      this.showScreen('title');
    });

    this.gamepadNav.onTogglePauseRequested = () => {
      if (this.game.state === 'playing') {
        this.game.togglePause();
      }
    };

    // Title Screen buttons
    document.getElementById('btn-start-game')?.addEventListener('click', () => {
      this.game.sound.init();
      this.showScreen('lobby');
    });

    document.getElementById('btn-show-maps')?.addEventListener('click', () => {
      this.game.sound.init();
      this.showScreen('maps');
    });

    document.getElementById('btn-show-controls')?.addEventListener('click', () => {
      this.game.sound.init();
      this.showScreen('controls');
    });

    document.getElementById('btn-show-powerups')?.addEventListener('click', () => {
      this.game.sound.init();
      this.showScreen('codex');
    });

    // Controls modal close
    document.getElementById('btn-controls-close')?.addEventListener('click', () => {
      this.showScreen('title');
    });

    // Codex modal close
    document.getElementById('btn-codex-close')?.addEventListener('click', () => {
      this.showScreen('title');
    });

    // Lobby buttons
    document.getElementById('btn-lobby-back')?.addEventListener('click', () => {
      this.showScreen('title');
    });

    document.getElementById('btn-lobby-fight')?.addEventListener('click', () => {
      this.startGameMatch();
    });

    // Map Select buttons
    document.getElementById('btn-maps-back')?.addEventListener('click', () => {
      this.showScreen('title');
    });

    document.getElementById('btn-maps-confirm')?.addEventListener('click', () => {
      this.showScreen('lobby');
    });

    // Podium buttons
    document.getElementById('btn-rematch')?.addEventListener('click', () => {
      this.showScreen('game');
      this.game.initMatch(this.playerConfigs, this.selectedMapId, this.targetWins, this.roundHp);
    });

    document.getElementById('btn-change-map')?.addEventListener('click', () => {
      this.showScreen('maps');
    });

    document.getElementById('btn-main-menu')?.addEventListener('click', () => {
      this.showScreen('title');
    });

    // Lobby Slot toggles (P3, P4)
    this.setupLobbySlot(2, 'toggle-p3', 'slot-body-p3', 'slot-placeholder-p3', 'slot-p3', 'p3-type');
    this.setupLobbySlot(3, 'toggle-p4', 'slot-body-p4', 'slot-placeholder-p4', 'slot-p4', 'p4-type');

    // Type Selectors
    (document.getElementById('p1-type') as HTMLSelectElement)?.addEventListener('change', (e) => {
      this.playerConfigs[0].type = (e.target as HTMLSelectElement).value as any;
    });

    (document.getElementById('p2-type') as HTMLSelectElement)?.addEventListener('change', (e) => {
      this.playerConfigs[1].type = (e.target as HTMLSelectElement).value as any;
    });

    // Color swatches
    document.querySelectorAll('.color-swatch').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const target = e.currentTarget as HTMLElement;
        const pIndex = parseInt(target.dataset.player!) - 1;
        const color = target.dataset.color!;
        this.playerConfigs[pIndex].color = color;

        // Visual active state
        target.parentElement?.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('active'));
        target.classList.add('active');
        this.updateSpritePreviews();
      });
    });

    // Periodic Gamepad detection indicator
    setInterval(() => {
      const count = this.game.input.getConnectedGamepadsCount();
      const textElem = document.getElementById('gamepad-status-text');
      if (textElem) {
        if (count > 0) {
          textElem.textContent = `${count} Gamepad${count > 1 ? 's' : ''} Connected (Couch Co-op Ready!)`;
          textElem.style.color = '#06d6a0';
        } else {
          textElem.textContent = 'Keyboard Ready (P1: WASD+F/G/R • P2: Arrows+K/L/O • Gamepads Supported)';
          textElem.style.color = '#94a3b8';
        }
      }
    }, 1000);
  }

  private setupLobbySlot(
    slotIndex: number,
    toggleBtnId: string,
    bodyId: string,
    placeholderId: string,
    slotElemId: string,
    selectId: string
  ): void {
    const toggleBtn = document.getElementById(toggleBtnId);
    const body = document.getElementById(bodyId);
    const placeholder = document.getElementById(placeholderId);
    const slotElem = document.getElementById(slotElemId);
    const selectElem = document.getElementById(selectId) as HTMLSelectElement;

    toggleBtn?.addEventListener('click', () => {
      const active = !this.playerConfigs[slotIndex].active;
      this.playerConfigs[slotIndex].active = active;

      if (active) {
        toggleBtn.textContent = '✕ REMOVE';
        toggleBtn.style.color = '#ff4d6d';
        body?.classList.remove('hidden');
        placeholder?.classList.add('hidden');
        slotElem?.classList.add('active');
      } else {
        toggleBtn.textContent = '+ ADD';
        toggleBtn.style.color = '#ffd166';
        body?.classList.add('hidden');
        placeholder?.classList.remove('hidden');
        slotElem?.classList.remove('active');
      }
      this.updateSpritePreviews();
      this.gamepadNav.applyFocus();
    });

    selectElem?.addEventListener('change', (e) => {
      this.playerConfigs[slotIndex].type = (e.target as HTMLSelectElement).value as any;
      this.updateSpritePreviews();
    });
  }

  private populateMapGrid(): void {
    const grid = document.getElementById('maps-grid');
    if (!grid) return;
    grid.innerHTML = '';

    // 1. Random Map Card
    const randomCard = document.createElement('div');
    randomCard.className = `map-card ${this.selectedMapId === 'random' ? 'selected' : ''}`;
    randomCard.innerHTML = `
      <div class="map-card-thumb" style="background: linear-gradient(135deg, #1e293b, #0f172a)">🎲</div>
      <div class="map-card-title">Random Rotation</div>
      <div class="map-card-hazard">Rotates across all 15 arena maps between each round!</div>
    `;
    randomCard.addEventListener('click', () => {
      this.selectMap('random', 'Random Rotation');
    });
    grid.appendChild(randomCard);

    // 2. All 12 Maps
    ARENA_MAPS.forEach(map => {
      const card = document.createElement('div');
      card.className = `map-card ${this.selectedMapId === map.id ? 'selected' : ''}`;
      card.innerHTML = `
        <div class="map-card-thumb" style="background: linear-gradient(135deg, ${map.bgGradient[0]}, ${map.bgGradient[1]})">${map.icon}</div>
        <div class="map-card-title">${map.name}</div>
        <div class="map-card-hazard">${map.hazardDescription}</div>
      `;
      card.addEventListener('click', () => {
        this.selectMap(map.id, map.name);
      });
      grid.appendChild(card);
    });
  }

  private selectMap(mapId: string, mapName: string): void {
    this.selectedMapId = mapId;
    const info = document.getElementById('selected-map-name');
    if (info) info.textContent = mapName;
    this.populateMapGrid();
    this.gamepadNav.applyFocus();
  }

  private populateCodex(): void {
    const swordGrid = document.getElementById('codex-sword-grid');
    const bowGrid = document.getElementById('codex-bow-grid');
    if (!swordGrid || !bowGrid) return;

    swordGrid.innerHTML = SWORD_POWERUPS.map(p => `
      <div class="codex-card">
        <div class="codex-card-icon" style="color:${p.color}">${p.icon}</div>
        <div>
          <div class="codex-card-title">${p.name} <small style="color:${p.color}">• ${p.tagline}</small></div>
          <div class="codex-card-desc">${p.description}</div>
        </div>
      </div>
    `).join('');

    bowGrid.innerHTML = BOW_POWERUPS.map(p => `
      <div class="codex-card">
        <div class="codex-card-icon" style="color:${p.color}">${p.icon}</div>
        <div>
          <div class="codex-card-title">${p.name} <small style="color:${p.color}">• ${p.tagline}</small></div>
          <div class="codex-card-desc">${p.description}</div>
        </div>
      </div>
    `).join('');
  }

  private showScreen(screen: 'title' | 'lobby' | 'maps' | 'controls' | 'codex' | 'game'): void {
    this.titleScreen.classList.add('hidden');
    this.lobbyScreen.classList.add('hidden');
    this.mapSelectScreen.classList.add('hidden');
    this.controlsScreen.classList.add('hidden');
    this.codexScreen.classList.add('hidden');
    this.draftScreen.classList.add('hidden');
    this.podiumScreen.classList.add('hidden');
    this.pauseScreen.classList.add('hidden');

    if (screen === 'title') this.titleScreen.classList.remove('hidden');
    else if (screen === 'lobby') {
      this.lobbyScreen.classList.remove('hidden');
      this.updateSpritePreviews();
    }
    else if (screen === 'maps') this.mapSelectScreen.classList.remove('hidden');
    else if (screen === 'controls') this.controlsScreen.classList.remove('hidden');
    else if (screen === 'codex') this.codexScreen.classList.remove('hidden');
    else if (screen === 'game') {
      this.hudLayer.classList.remove('hidden');
    }

    this.gamepadNav.setScreen(screen);
  }

  private isDesktopApp(): boolean {
    return typeof window !== 'undefined' && (
      !!(window as any).electronAPI?.isElectron ||
      window.location.search.includes('desktop=1')
    );
  }

  private updateSpritePreviews(): void {
    this.playerConfigs.forEach((cfg, idx) => {
      const container = document.getElementById(`sprite-preview-${idx + 1}`);
      if (!container) return;
      container.innerHTML = '';

      const canvas = document.createElement('canvas');
      canvas.width = 60;
      canvas.height = 70;
      canvas.style.display = 'block';
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const isCpu = cfg.type.startsWith('cpu');
      ctx.save();
      ctx.translate(30, 42);

      // Cape
      ctx.fillStyle = cfg.color;
      ctx.beginPath();
      ctx.moveTo(-5, -12);
      ctx.lineTo(-14, 14);
      ctx.lineTo(-4, 10);
      ctx.closePath();
      ctx.fill();

      // Armor body
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(-10, -14, 20, 24);

      // Color plate
      ctx.fillStyle = cfg.color;
      ctx.fillRect(-6, -11, 12, 18);

      // Helmet
      ctx.fillStyle = '#475569';
      ctx.beginPath();
      ctx.arc(0, -18, 9, 0, Math.PI * 2);
      ctx.fill();

      // Glowing Eyes
      ctx.fillStyle = isCpu ? '#06d6a0' : '#ffd166';
      ctx.fillRect(2, -20, 4, 3);

      // Sword
      ctx.fillStyle = '#d4af37';
      ctx.fillRect(8, -4, 3, 8);
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(11, -2, 18, 4);

      // Boots
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(-8, 10, 5, 6);
      ctx.fillRect(3, 10, 5, 6);

      ctx.restore();
      container.appendChild(canvas);
    });
  }

  private startGameMatch(): void {
    this.showScreen('game');
    this.game.initMatch(this.playerConfigs, this.selectedMapId, this.targetWins, this.roundHp);
  }

  private bindGameCallbacks(): void {
    // HUD updates
    this.game.onHudUpdate = (game: Game) => {
      this.updateHud(game);
    };

    // Pause state change
    this.game.onPauseChange = (isPaused: boolean) => {
      if (isPaused) {
        this.pauseScreen.classList.remove('hidden');
        this.gamepadNav.setScreen('pause');
      } else {
        this.pauseScreen.classList.add('hidden');
        this.gamepadNav.setScreen('game');
      }
    };

    // Round Announcement
    this.game.onRoundAnnounce = (title: string, sub: string) => {
      this.draftScreen.classList.add('hidden');
      this.gamepadNav.setScreen('game');
      const banner = document.getElementById('round-announcement');
      const t = document.getElementById('announcement-text');
      const s = document.getElementById('announcement-sub');
      if (banner && t && s) {
        t.textContent = title;
        s.textContent = sub;
        banner.classList.remove('hidden');
        // Re-trigger animation
        banner.style.animation = 'none';
        void banner.offsetWidth; // trigger reflow
        banner.style.animation = 'announcePop 1.8s cubic-bezier(0.16, 1, 0.3, 1) forwards';

        setTimeout(() => {
          banner.classList.add('hidden');
        }, 1900);
      }
    };

    // Underdog Power-Up Draft Open
    this.game.onDraftOpen = (player: Player, cards: PowerUpDefinition[]) => {
      const tag = document.getElementById('draft-player-tag');
      const container = document.getElementById('draft-cards-container');
      const hint = document.getElementById('draft-timer-hint');
      if (!tag || !container) return;

      const ctrlNum = player.index + 1;
      tag.textContent = player.isCpu
        ? `🤖 ${player.name.toUpperCase()} (AI BOT) DRAFTING`
        : `🎮 ${player.name.toUpperCase()} (CONTROLLER ${ctrlNum}) DRAFT TURN`;
      tag.style.color = player.color;
      tag.style.borderColor = player.color;

      if (hint) {
        if (player.isCpu) {
          hint.innerHTML = `<span style="color:#06d6a0">🤖 AI Bot is choosing an upgrade...</span>`;
        } else {
          const kbHint = player.index === 0 ? 'WASD / Space' : (player.index === 1 ? 'Arrows / Enter' : (player.index === 2 ? 'IJKL / U' : 'Numpad 4/6/1'));
          hint.innerHTML = `<span style="color:${player.color}; font-weight:700;">🎮 Controller ${ctrlNum}</span> (or Keys [${kbHint}]) • <span style="color:#ffd166">Only ${player.name} can select this perk!</span>`;
        }
      }

      container.innerHTML = '';
      let hasSelected = false;

      cards.forEach((card, cardIdx) => {
        const cardElem = document.createElement('div');
        cardElem.className = `draft-card ${card.category === 'sword' ? 'sword-card' : 'bow-card'}`;
        cardElem.setAttribute('data-card-index', cardIdx.toString());
        cardElem.innerHTML = `
          <div class="draft-card-badge">${card.category.toUpperCase()} PERK</div>
          <div class="draft-card-icon">${card.icon}</div>
          <div class="draft-card-name">${card.name}</div>
          <div class="draft-card-desc">${card.description}</div>
          <button class="btn btn-primary draft-btn-select">${player.isCpu ? 'SELECTING...' : 'SELECT PERK'}</button>
        `;

        if (!player.isCpu) {
          cardElem.addEventListener('click', () => {
            if (hasSelected) return;
            hasSelected = true;
            this.draftScreen.classList.add('hidden');
            this.game.selectDraftPowerUp(card);
          });
        }

        container.appendChild(cardElem);
      });

      this.draftScreen.classList.remove('hidden');
      this.gamepadNav.setDraftingPlayer(player);
      this.gamepadNav.setScreen('draft');
    };

    // Draft Close
    this.game.onDraftClose = () => {
      this.draftScreen.classList.add('hidden');
      this.gamepadNav.setScreen('game');
      this.gamepadNav.setDraftingPlayer(null);
    };

    // Match Victory Podium Open
    this.game.onPodiumOpen = (winner: Player, rankings: Player[]) => {
      this.hudLayer.classList.add('hidden');
      this.gamepadNav.setScreen('podium');
      const winName = document.getElementById('victory-player-name');
      const victorySubtitle = document.getElementById('victory-subtitle') || document.querySelector('.victory-subtitle');
      if (victorySubtitle) {
        victorySubtitle.textContent = `CHAMPION OF SWORDS & ARROWS (FIRST TO ${this.game.targetWins} WINS)`;
      }
      const stage = document.getElementById('podium-stage');
      const statsContainer = document.getElementById('match-stats-container');
      if (!winName || !stage || !statsContainer) return;

      winName.textContent = `${winner.name.toUpperCase()} IS THE GRAND CHAMPION!`;
      winName.style.color = winner.color;

      // Podium stands
      stage.innerHTML = '';
      const order = rankings.length >= 2
        ? (rankings.length >= 3
           ? [rankings[1], rankings[0], rankings[2], rankings[3]].filter(Boolean)
           : [rankings[1], rankings[0]])
        : rankings;

      order.forEach((p) => {
        const rankIdx = rankings.indexOf(p);
        const rankStandClass = rankIdx === 0 ? 'p-first' : (rankIdx === 1 ? 'p-second' : (rankIdx === 2 ? 'p-third' : 'p-fourth'));
        const rankLabel = rankIdx === 0 ? '1ST' : (rankIdx === 1 ? '2ND' : (rankIdx === 2 ? '3RD' : `${rankIdx + 1}TH`));

        const stand = document.createElement('div');
        stand.className = `podium-stand ${rankStandClass}`;
        stand.innerHTML = `
          <div class="podium-rank">${rankLabel}</div>
          <div class="podium-name" style="color:${p.color}">${p.name}</div>
          <div class="podium-wins-count">${p.wins} Wins</div>
        `;
        stage.appendChild(stand);
      });

      // Stats table
      statsContainer.innerHTML = rankings.map(p => `
        <div class="stat-item">
          <strong style="color:${p.color}">${p.name}</strong>: 
          <span>${p.wins} Wins</span> • 
          <span>${p.stats.kills} Kills</span> • 
          <span>${p.stats.parries} Parries</span> • 
          <span>${p.stats.arrowsShot} Arrows Shot</span>
        </div>
      `).join('');

      this.podiumScreen.classList.remove('hidden');
    };
  }

  private updateHud(game: Game): void {
    // Arena name
    const mapNameElem = document.getElementById('hud-map-name');
    if (mapNameElem) mapNameElem.textContent = game.currentMap.name;

    // Player Cards P1 to P4
    const slots = ['p1', 'p2', 'p3', 'p4'];
    slots.forEach((slotId, index) => {
      const card = document.getElementById(`${slotId}-card`);
      if (!card) return;

      const p = game.players[index];
      if (!p) {
        card.classList.add('hidden');
        return;
      }
      card.classList.remove('hidden');

      // Hearts
      const heartsContainer = document.getElementById(`${slotId}-hearts`);
      if (heartsContainer) {
        let heartsHtml = '';
        for (let h = 0; h < p.maxHealth; h++) {
          if (h < p.health) {
            heartsHtml += '<span class="heart-full">❤️</span>';
          } else {
            heartsHtml += '<span class="heart-empty">🖤</span>';
          }
        }
        heartsContainer.innerHTML = heartsHtml;
      }

      // Wins (Target: 3)
      const winsContainer = document.getElementById(`${slotId}-wins`);
      if (winsContainer) {
        let crownsHtml = '';
        for (let w = 0; w < game.targetWins; w++) {
          if (w < p.wins) {
            crownsHtml += '<span>👑</span>';
          } else {
            crownsHtml += '<span style="opacity:0.25">👑</span>';
          }
        }
        winsContainer.innerHTML = crownsHtml;
      }

      // Weapon badge
      const weaponBadge = document.getElementById(`${slotId}-weapon`);
      if (weaponBadge) {
        if (p.currentWeapon === 'sword') {
          weaponBadge.textContent = '⚔️ SWORD';
          weaponBadge.style.color = '#ff70a6';
          weaponBadge.style.borderColor = '#ff70a6';
        } else {
          weaponBadge.textContent = `🏹 BOW (${p.hasPowerUp('infinite-quiver') ? '∞' : p.quiverAmmo})`;
          weaponBadge.style.color = '#70e4ef';
          weaponBadge.style.borderColor = '#70e4ef';
        }
      }

      // Power-up pills
      const powerupsContainer = document.getElementById(`${slotId}-powerups`);
      if (powerupsContainer) {
        const owned = Object.keys(p.powerUps);
        powerupsContainer.innerHTML = owned.map(id => {
          const isSword = SWORD_POWERUPS.some(sw => sw.id === id);
          const icon = (isSword ? SWORD_POWERUPS : BOW_POWERUPS).find(po => po.id === id)?.icon || '⭐';
          return `<span class="powerup-pill ${isSword ? 'sword' : 'bow'}">${icon} ${id}</span>`;
        }).join('');
      }
    });
  }
}
