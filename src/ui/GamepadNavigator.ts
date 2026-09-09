import { Player } from '../entities/Player';
import { InputManager } from '../core/InputManager';

export type ActiveScreenType = 'title' | 'lobby' | 'maps' | 'controls' | 'codex' | 'draft' | 'podium' | 'game';

export class GamepadNavigator {
  private currentScreen: ActiveScreenType = 'title';
  private draftingPlayer: Player | null = null;
  private inputManager: InputManager | null = null;
  private lastActiveGamepadIndex: number | null = null;

  // Navigation state per screen
  private titleIndex: number = 0;
  private lobbySlotIndex: number = 0;  // 0: P1, 1: P2, 2: P3, 3: P4
  private lobbySubIndex: number = 0;   // 0: Type/Slot, 1: Color
  private lobbyOnBottomBar: boolean = false;
  private lobbyBottomIndex: number = 1; // 0: Back, 1: Fight
  private mapGridIndex: number = 0;
  private mapOnBottomBar: boolean = false;
  private mapBottomIndex: number = 1;  // 0: Back, 1: Confirm
  private draftCardIndex: number = 0;
  private podiumButtonIndex: number = 0;

  // Input repeat timing
  private moveCooldown: number = 0;
  private moveRepeatTimer: number = 0;
  private prevButtons: boolean[] = new Array(20).fill(false);
  private prevGamepadConfirm: Map<number, boolean> = new Map();

  // Focus element tracking
  private currentFocusedElement: HTMLElement | null = null;
  private promptBar: HTMLElement | null = null;

  constructor(inputManager?: InputManager) {
    this.inputManager = inputManager || null;
    this.createPromptBar();
    this.initKeyboardListeners();
    this.initGamepadEvents();
  }

  public setDraftingPlayer(player: Player | null): void {
    this.draftingPlayer = player;
    this.draftCardIndex = 0;
    this.moveCooldown = 0.3; // brief cooldown to prevent carry-over button presses from battle
    this.moveRepeatTimer = 0;

    // Pre-mark currently held buttons so player must release and re-press
    const rawGamepads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (let i = 0; i < rawGamepads.length; i++) {
      const gp = rawGamepads[i];
      if (gp && gp.connected) {
        const isConfirm = (gp.buttons[0]?.pressed ?? false) || (gp.buttons[2]?.pressed ?? false) || (gp.buttons[9]?.pressed ?? false);
        this.prevGamepadConfirm.set(gp.index, isConfirm);
      }
    }

    if (this.currentScreen === 'draft') {
      if (player) {
        if (this.promptBar) {
          this.promptBar.classList.remove('hidden');
          this.promptBar.style.display = 'flex';
        }
        this.updatePromptBar();
        this.applyFocus();
      } else {
        this.clearFocus();
        if (this.promptBar) {
          this.promptBar.classList.add('hidden');
          this.promptBar.style.display = 'none';
          this.promptBar.innerHTML = '';
        }
      }
    }
  }

  private getGamepadForPlayer(slot: number): Gamepad | null {
    if (this.inputManager) {
      return this.inputManager.getGamepadForSlot(slot as any);
    }

    const rawGamepads = navigator.getGamepads ? navigator.getGamepads() : [];
    const connectedGamepads: Gamepad[] = [];
    for (let i = 0; i < rawGamepads.length; i++) {
      const g = rawGamepads[i];
      if (g && g.connected && g.buttons && g.buttons.length >= 4) {
        connectedGamepads.push(g);
      }
    }

    if (connectedGamepads.length === 0) return null;

    if (connectedGamepads[slot]) {
      return connectedGamepads[slot];
    }
    return connectedGamepads[0];
  }

  private createPromptBar(): void {
    const existing = document.getElementById('gp-prompt-bar');
    if (existing) {
      this.promptBar = existing;
      return;
    }

    const bar = document.createElement('div');
    bar.id = 'gp-prompt-bar';
    bar.className = 'gamepad-prompt-bar';
    bar.innerHTML = `
      <span><span class="gp-key">ARROWS / WASD</span> Navigate</span>
      <span><span class="gp-key">ENTER / A</span> Select</span>
      <span><span class="gp-key gp-b">ESC / B</span> Back</span>
      <span><span class="gp-key gp-start">START</span> Fight</span>
    `;
    document.getElementById('canvas-container')?.appendChild(bar);
    this.promptBar = bar;
  }

  private initKeyboardListeners(): void {
    window.addEventListener('keydown', (e) => {
      // If actively playing in arena combat, let Player.ts handle gameplay keys
      if (this.currentScreen === 'game') return;

      // Draft Screen: ISOLATE strictly to drafting player's controls
      if (this.currentScreen === 'draft') {
        if (!this.draftingPlayer || this.draftingPlayer.isCpu) {
          return; // Lock out all keyboards if AI is drafting
        }

        const slot = this.draftingPlayer.index;
        const code = e.code;
        let isLeft = false;
        let isRight = false;
        let isSelect = false;

        if (slot === 0) {
          // P1: A / D to move, F / Space / Enter to select
          if (code === 'KeyA') isLeft = true;
          if (code === 'KeyD') isRight = true;
          if (code === 'KeyF' || code === 'Space' || code === 'Enter') isSelect = true;
        } else if (slot === 1) {
          // P2: ArrowLeft / ArrowRight to move, K / Enter / NumpadEnter to select
          if (code === 'ArrowLeft') isLeft = true;
          if (code === 'ArrowRight') isRight = true;
          if (code === 'KeyK' || code === 'Enter' || code === 'NumpadEnter') isSelect = true;
        } else if (slot === 2) {
          // P3: J / L to move, U / P to select
          if (code === 'KeyJ') isLeft = true;
          if (code === 'KeyL') isRight = true;
          if (code === 'KeyU' || code === 'KeyP') isSelect = true;
        } else if (slot === 3) {
          // P4: Numpad 4 / 6 to move, Numpad 1 / 5 / Enter to select
          if (code === 'Numpad4') isLeft = true;
          if (code === 'Numpad6') isRight = true;
          if (code === 'Numpad1' || code === 'Numpad5' || code === 'NumpadEnter') isSelect = true;
        }

        if (isLeft) {
          e.preventDefault();
          this.handleDirectionMove(-1, 0);
        } else if (isRight) {
          e.preventDefault();
          this.handleDirectionMove(1, 0);
        } else if (isSelect) {
          e.preventDefault();
          this.handleButtonA();
        }
        return;
      }

      // Other screens: title, lobby, maps, controls, codex, podium
      const code = e.code;

      if (code === 'ArrowUp' || code === 'KeyW') {
        e.preventDefault();
        this.handleDirectionMove(0, -1);
      } else if (code === 'ArrowDown' || code === 'KeyS') {
        e.preventDefault();
        this.handleDirectionMove(0, 1);
      } else if (code === 'ArrowLeft' || code === 'KeyA') {
        e.preventDefault();
        this.handleDirectionMove(-1, 0);
      } else if (code === 'ArrowRight' || code === 'KeyD') {
        e.preventDefault();
        this.handleDirectionMove(1, 0);
      } else if (code === 'Enter' || code === 'Space' || code === 'NumpadEnter') {
        e.preventDefault();
        this.handleButtonA();
      } else if (code === 'Escape' || code === 'Backspace') {
        e.preventDefault();
        this.handleButtonB();
      } else if (code === 'Tab') {
        e.preventDefault();
        this.handleDirectionMove(e.shiftKey ? -1 : 1, 0);
      }
    });

    // Also listen to mouse hover on buttons/cards so focus ring updates seamlessly
    document.addEventListener('mouseover', (e) => {
      if (this.currentScreen === 'game') return;
      const target = (e.target as HTMLElement).closest('.btn, .map-card, .draft-card, .slot-select, .color-swatch, .btn-toggle-slot') as HTMLElement;
      if (target && target !== this.currentFocusedElement) {
        if (this.currentScreen === 'draft') {
          if (!this.draftingPlayer || this.draftingPlayer.isCpu) return;
          const idxStr = target.getAttribute('data-card-index');
          if (idxStr) {
            const idx = parseInt(idxStr);
            if (!isNaN(idx)) this.draftCardIndex = idx;
          }
        }
        this.setFocusDirectly(target);
      }
    });
  }

  private initGamepadEvents(): void {
    window.addEventListener('gamepadconnected', (e) => {
      console.log('🎮 Gamepad connected at index %d: %s', e.gamepad.index, e.gamepad.id);
      this.updateStatusBar(e.gamepad);
    });

    window.addEventListener('gamepaddisconnected', (e) => {
      console.log('🎮 Gamepad disconnected from index %d: %s', e.gamepad.index, e.gamepad.id);
      this.updateStatusBar(null);
    });
  }

  private updateStatusBar(connectedGp: Gamepad | null): void {
    const textElem = document.getElementById('gamepad-status-text');
    if (!textElem) return;

    if (connectedGp) {
      const name = connectedGp.id.split('(')[0].trim() || 'Gamepad';
      textElem.textContent = `🎮 Controller Connected: ${name} (Couch Co-op Ready!)`;
      textElem.style.color = '#06d6a0';
    } else {
      const allGps = navigator.getGamepads ? navigator.getGamepads() : [];
      let count = 0;
      for (let i = 0; i < allGps.length; i++) {
        if (allGps[i] && allGps[i]!.connected) count++;
      }
      if (count > 0) {
        textElem.textContent = `🎮 ${count} Controller${count > 1 ? 's' : ''} Connected (Couch Ready!)`;
        textElem.style.color = '#06d6a0';
      } else {
        textElem.textContent = '⌨️ Keyboard Ready (Arrows / WASD + Enter) • Connect Gamepad & Press any button';
        textElem.style.color = '#ffd166';
      }
    }
  }

  public setScreen(screen: ActiveScreenType): void {
    this.currentScreen = screen;
    this.clearFocus();

    if (screen === 'game') {
      if (this.promptBar) {
        this.promptBar.classList.add('hidden');
        this.promptBar.style.display = 'none';
        this.promptBar.innerHTML = '';
      }
      this.podiumButtonIndex = 0;
      this.moveCooldown = 0.3;
      this.moveRepeatTimer = 0;
    } else {
      if (this.promptBar) {
        this.promptBar.classList.remove('hidden');
        this.promptBar.style.display = 'flex';
      }
      if (screen === 'podium') {
        this.podiumButtonIndex = 0;
      }
      this.updatePromptBar();
      this.applyFocus();
    }
  }

  public update(dt: number): void {
    if (this.currentScreen === 'game') return;

    if (this.currentScreen === 'draft') {
      this.updateDraftGamepad(dt);
      return;
    }

    // Scan ALL connected gamepads for general menu navigation
    const rawGamepads = navigator.getGamepads ? navigator.getGamepads() : [];
    let aggregatedStickX = 0;
    let aggregatedStickY = 0;
    let dpadUp = false;
    let dpadDown = false;
    let dpadLeft = false;
    let dpadRight = false;
    let btnA = false;
    let btnB = false;
    let btnX = false;
    let btnY = false;
    let btnStart = false;

    let hasAnyGamepad = false;

    for (let i = 0; i < rawGamepads.length; i++) {
      const gp = rawGamepads[i];
      if (!gp || !gp.connected) continue;

      hasAnyGamepad = true;
      const deadzone = 0.45;

      const sx = gp.axes[0] || 0;
      const sy = gp.axes[1] || 0;
      const hasStick = Math.abs(sx) > deadzone || Math.abs(sy) > deadzone;
      if (Math.abs(sx) > deadzone) aggregatedStickX = sx;
      if (Math.abs(sy) > deadzone) aggregatedStickY = sy;

      const pUp = gp.buttons[12]?.pressed ?? false;
      const pDown = gp.buttons[13]?.pressed ?? false;
      const pLeft = gp.buttons[14]?.pressed ?? false;
      const pRight = gp.buttons[15]?.pressed ?? false;

      if (pUp) dpadUp = true;
      if (pDown) dpadDown = true;
      if (pLeft) dpadLeft = true;
      if (pRight) dpadRight = true;

      const pA = gp.buttons[0]?.pressed ?? false;
      const pB = gp.buttons[1]?.pressed ?? false;
      const pX = gp.buttons[2]?.pressed ?? false;
      const pY = gp.buttons[3]?.pressed ?? false;
      const pStart = (gp.buttons[9]?.pressed ?? false) || (gp.buttons[8]?.pressed ?? false);

      if (pA) btnA = true;
      if (pB) btnB = true;
      if (pX) btnX = true;
      if (pY) btnY = true;
      if (pStart) btnStart = true;

      // Track active gamepad input
      if (hasStick || pUp || pDown || pLeft || pRight || pA || pB || pX || pY || pStart) {
        this.lastActiveGamepadIndex = gp.index;
        this.inputManager?.setPrimaryGamepadIndex(gp.index);
        this.inputManager?.bindPlayerGamepad(0, gp.index);
      }
    }

    if (hasAnyGamepad) {
      const activeGp = (this.lastActiveGamepadIndex !== null ? rawGamepads[this.lastActiveGamepadIndex] : null)
        || rawGamepads.find(g => g && g.connected)
        || null;
      this.updateStatusBar(activeGp);

      const up = dpadUp || aggregatedStickY < -0.45;
      const down = dpadDown || aggregatedStickY > 0.45;
      const left = dpadLeft || aggregatedStickX < -0.45;
      const right = dpadRight || aggregatedStickX > 0.45;

      let moveDirX = 0;
      let moveDirY = 0;

      if (left) moveDirX = -1;
      if (right) moveDirX = 1;
      if (up) moveDirY = -1;
      if (down) moveDirY = 1;

      if (moveDirX !== 0 || moveDirY !== 0) {
        if (this.moveCooldown <= 0) {
          this.handleDirectionMove(moveDirX, moveDirY);
          this.moveCooldown = this.moveRepeatTimer === 0 ? 0.28 : 0.16;
          this.moveRepeatTimer += dt;
        } else {
          this.moveCooldown -= dt;
        }
      } else {
        this.moveCooldown = 0;
        this.moveRepeatTimer = 0;
      }

      // Button edge detection
      if (btnA && !this.prevButtons[0]) {
        this.handleButtonA();
      }
      if (btnB && !this.prevButtons[1]) {
        this.handleButtonB();
      }
      if (btnStart && !this.prevButtons[9]) {
        this.handleButtonStart();
      }

      this.prevButtons[0] = btnA;
      this.prevButtons[1] = btnB;
      this.prevButtons[2] = btnX;
      this.prevButtons[3] = btnY;
      this.prevButtons[9] = btnStart;
    }
  }

  private updateDraftGamepad(dt: number): void {
    // If no player or drafting player is CPU, completely lock out all controllers
    if (!this.draftingPlayer || this.draftingPlayer.isCpu) {
      return;
    }

    // Only read the designated controller for this drafting player
    const gp = this.getGamepadForPlayer(this.draftingPlayer.index);
    if (!gp || !gp.connected) {
      return; // Player may be using keyboard
    }

    const deadzone = 0.45;
    const sx = gp.axes[0] || 0;
    const dpadLeft = gp.buttons[14]?.pressed ?? false;
    const dpadRight = gp.buttons[15]?.pressed ?? false;

    const left = dpadLeft || sx < -deadzone;
    const right = dpadRight || sx > deadzone;

    let moveDirX = 0;
    if (left) moveDirX = -1;
    if (right) moveDirX = 1;

    if (moveDirX !== 0) {
      if (this.moveCooldown <= 0) {
        this.handleDirectionMove(moveDirX, 0);
        this.moveCooldown = this.moveRepeatTimer === 0 ? 0.28 : 0.16;
        this.moveRepeatTimer += dt;
      } else {
        this.moveCooldown -= dt;
      }
    } else {
      this.moveCooldown = 0;
      this.moveRepeatTimer = 0;
    }

    // Only allow A / X / Start on THIS player's controller to select
    const btnA = gp.buttons[0]?.pressed ?? false;
    const btnX = gp.buttons[2]?.pressed ?? false;
    const btnStart = (gp.buttons[9]?.pressed ?? false) || (gp.buttons[8]?.pressed ?? false);
    const isConfirm = btnA || btnX || btnStart;

    const prevConfirm = this.prevGamepadConfirm.get(gp.index) ?? false;
    if (isConfirm && !prevConfirm) {
      this.handleButtonA();
    }
    this.prevGamepadConfirm.set(gp.index, isConfirm);
  }

  public handleDirectionMove(dx: number, dy: number): void {
    if (this.currentScreen === 'title') {
      if (dy !== 0) {
        const count = 4;
        this.titleIndex = (this.titleIndex + dy + count) % count;
        this.applyFocus();
      }
    } else if (this.currentScreen === 'lobby') {
      if (this.lobbyOnBottomBar) {
        if (dy < 0) {
          // Move up back to player slots
          this.lobbyOnBottomBar = false;
          this.applyFocus();
        } else if (dx !== 0) {
          this.lobbyBottomIndex = this.lobbyBottomIndex === 0 ? 1 : 0;
          this.applyFocus();
        }
      } else {
        if (dy > 0) {
          if (this.lobbySubIndex === 0) {
            this.lobbySubIndex = 1;
            this.applyFocus();
          } else {
            // Move down to bottom bar
            this.lobbyOnBottomBar = true;
            this.applyFocus();
          }
        } else if (dy < 0) {
          if (this.lobbySubIndex === 1) {
            this.lobbySubIndex = 0;
            this.applyFocus();
          }
        } else if (dx !== 0) {
          // Left / Right moves between player slots
          this.lobbySlotIndex = (this.lobbySlotIndex + dx + 4) % 4;
          this.applyFocus();
        }
      }
    } else if (this.currentScreen === 'maps') {
      const gridCount = 16; // 1 random + 15 maps
      if (this.mapOnBottomBar) {
        if (dy < 0) {
          this.mapOnBottomBar = false;
          this.applyFocus();
        } else if (dx !== 0) {
          this.mapBottomIndex = this.mapBottomIndex === 0 ? 1 : 0;
          this.applyFocus();
        }
      } else {
        if (dy > 0 && this.mapGridIndex >= 12) {
          this.mapOnBottomBar = true;
          this.applyFocus();
        } else {
          if (dx !== 0) {
            this.mapGridIndex = Math.max(0, Math.min(gridCount - 1, this.mapGridIndex + dx));
            this.applyFocus();
          }
          if (dy !== 0) {
            const next = this.mapGridIndex + dy * 4;
            if (next >= 0 && next < gridCount) {
              this.mapGridIndex = next;
              this.applyFocus();
            } else if (next >= gridCount) {
              this.mapOnBottomBar = true;
              this.applyFocus();
            }
          }
        }
      }
    } else if (this.currentScreen === 'draft') {
      if (dx !== 0) {
        this.draftCardIndex = (this.draftCardIndex + dx + 3) % 3;
        this.applyFocus();
      }
    } else if (this.podiumButtonIndex !== undefined && this.currentScreen === 'podium') {
      if (dx !== 0) {
        this.podiumButtonIndex = (this.podiumButtonIndex + dx + 3) % 3;
        this.applyFocus();
      }
    }
  }

  public handleButtonA(): void {
    if (this.currentScreen === 'title') {
      const titleBtns = [
        document.getElementById('btn-start-game'),
        document.getElementById('btn-show-maps'),
        document.getElementById('btn-show-controls'),
        document.getElementById('btn-show-powerups')
      ];
      titleBtns[this.titleIndex]?.click();
    } else if (this.currentScreen === 'lobby') {
      if (this.lobbyOnBottomBar) {
        if (this.lobbyBottomIndex === 0) {
          document.getElementById('btn-lobby-back')?.click();
        } else {
          document.getElementById('btn-lobby-fight')?.click();
        }
      } else {
        const slot = this.lobbySlotIndex;
        const slotElem = document.getElementById(`slot-p${slot + 1}`);
        const isActive = slotElem?.classList.contains('active');

        if (!isActive && (slot === 2 || slot === 3)) {
          // Activate slot
          document.getElementById(`toggle-p${slot + 1}`)?.click();
          this.applyFocus();
          return;
        }

        if (this.lobbySubIndex === 0) {
          // Cycle Type selector (Human, CPU Novice, CPU Skilled, CPU Deadly)
          const select = document.getElementById(`p${slot + 1}-type`) as HTMLSelectElement;
          if (select) {
            select.selectedIndex = (select.selectedIndex + 1) % select.options.length;
            select.dispatchEvent(new Event('change'));
          }
        } else if (this.lobbySubIndex === 1) {
          // Cycle Color swatches
          const swatches = Array.from(document.querySelectorAll(`.color-swatch[data-player="${slot + 1}"]`)) as HTMLElement[];
          if (swatches.length > 0) {
            const activeIdx = swatches.findIndex(s => s.classList.contains('active'));
            const nextIdx = (activeIdx + 1) % swatches.length;
            swatches[nextIdx]?.click();
          }
        }
      }
    } else if (this.currentScreen === 'maps') {
      if (this.mapOnBottomBar) {
        if (this.mapBottomIndex === 0) {
          document.getElementById('btn-maps-back')?.click();
        } else {
          document.getElementById('btn-maps-confirm')?.click();
        }
      } else {
        const cards = Array.from(document.querySelectorAll('.map-card')) as HTMLElement[];
        cards[this.mapGridIndex]?.click();
      }
    } else if (this.currentScreen === 'controls') {
      document.getElementById('btn-controls-close')?.click();
    } else if (this.currentScreen === 'codex') {
      document.getElementById('btn-codex-close')?.click();
    } else if (this.currentScreen === 'draft') {
      if (!this.draftingPlayer || this.draftingPlayer.isCpu) return;
      const draftCards = Array.from(document.querySelectorAll('.draft-card')) as HTMLElement[];
      const selectedCard = draftCards[this.draftCardIndex];
      if (selectedCard) {
        selectedCard.click();
      }
    } else if (this.currentScreen === 'podium') {
      const podiumBtns = [
        document.getElementById('btn-rematch'),
        document.getElementById('btn-change-map'),
        document.getElementById('btn-main-menu')
      ];
      podiumBtns[this.podiumButtonIndex]?.click();
    }
  }

  public handleButtonB(): void {
    if (this.currentScreen === 'lobby') {
      document.getElementById('btn-lobby-back')?.click();
    } else if (this.currentScreen === 'maps') {
      document.getElementById('btn-maps-back')?.click();
    } else if (this.currentScreen === 'controls') {
      document.getElementById('btn-controls-close')?.click();
    } else if (this.currentScreen === 'codex') {
      document.getElementById('btn-codex-close')?.click();
    }
  }

  public handleButtonStart(): void {
    if (this.currentScreen === 'title') {
      document.getElementById('btn-start-game')?.click();
    } else if (this.currentScreen === 'lobby') {
      document.getElementById('btn-lobby-fight')?.click();
    } else if (this.currentScreen === 'maps') {
      document.getElementById('btn-maps-confirm')?.click();
    } else if (this.currentScreen === 'podium') {
      document.getElementById('btn-rematch')?.click();
    }
  }

  private updatePromptBar(): void {
    if (!this.promptBar) return;
    if (this.currentScreen === 'title') {
      this.promptBar.innerHTML = `
        <span><span class="gp-key">ARROWS / WASD</span> Move</span>
        <span><span class="gp-key">ENTER / A</span> Select</span>
        <span><span class="gp-key gp-start">START</span> Start</span>
      `;
    } else if (this.currentScreen === 'lobby') {
      this.promptBar.innerHTML = `
        <span><span class="gp-key">ARROWS / WASD</span> Navigate</span>
        <span><span class="gp-key">ENTER / A</span> Change/Toggle</span>
        <span><span class="gp-key gp-b">ESC / B</span> Back</span>
        <span><span class="gp-key gp-start">START</span> Fight!</span>
      `;
    } else if (this.currentScreen === 'maps') {
      this.promptBar.innerHTML = `
        <span><span class="gp-key">ARROWS / WASD</span> Choose Arena</span>
        <span><span class="gp-key">ENTER / A</span> Select</span>
        <span><span class="gp-key gp-b">ESC / B</span> Back</span>
        <span><span class="gp-key gp-start">START</span> Confirm</span>
      `;
    } else if (this.currentScreen === 'draft') {
      if (this.draftingPlayer) {
        if (!this.draftingPlayer.isCpu) {
          const p = this.draftingPlayer;
          const ctrlNum = p.index + 1;
          const kbHint = p.index === 0 ? 'A/D + Space/F' : (p.index === 1 ? '←/→ + Enter/K' : (p.index === 2 ? 'J/L + U' : 'Num 4/6 + 1'));
          this.promptBar.innerHTML = `
            <span style="color:${p.color}; font-weight:800;">🎮 CONTROLLER ${ctrlNum} (${p.name.toUpperCase()}) TURN</span>
            <span><span class="gp-key" style="border:1px solid ${p.color};">PAD / [${kbHint}]</span> Choose</span>
            <span><span class="gp-key">A / ENTER</span> Select Perk</span>
          `;
        } else {
          this.promptBar.innerHTML = `
            <span>🤖 AI Bot Drafting Upgrade...</span>
          `;
        }
      } else {
        this.promptBar.innerHTML = '';
        this.promptBar.classList.add('hidden');
        this.promptBar.style.display = 'none';
      }
    } else if (this.currentScreen === 'podium') {
      this.promptBar.innerHTML = `
        <span><span class="gp-key">ARROWS / WASD</span> Action</span>
        <span><span class="gp-key">ENTER / A</span> Confirm</span>
        <span><span class="gp-key gp-start">START</span> Rematch</span>
      `;
    } else if (this.currentScreen === 'game') {
      this.promptBar.innerHTML = '';
      this.promptBar.classList.add('hidden');
      this.promptBar.style.display = 'none';
    }
  }

  public applyFocus(): void {
    this.clearFocus();

    let target: HTMLElement | null = null;

    if (this.currentScreen === 'title') {
      const titleBtns = [
        document.getElementById('btn-start-game'),
        document.getElementById('btn-show-maps'),
        document.getElementById('btn-show-controls'),
        document.getElementById('btn-show-powerups')
      ];
      target = titleBtns[this.titleIndex] || null;
    } else if (this.currentScreen === 'lobby') {
      if (this.lobbyOnBottomBar) {
        target = this.lobbyBottomIndex === 0
          ? document.getElementById('btn-lobby-back')
          : document.getElementById('btn-lobby-fight');
      } else {
        const slot = this.lobbySlotIndex;
        const slotElem = document.getElementById(`slot-p${slot + 1}`);
        const isActive = slotElem?.classList.contains('active');

        if (!isActive) {
          target = document.getElementById(`toggle-p${slot + 1}`);
        } else {
          if (this.lobbySubIndex === 0) {
            target = document.getElementById(`p${slot + 1}-type`);
          } else {
            const swatches = document.querySelectorAll(`.color-swatch[data-player="${slot + 1}"]`);
            target = (swatches[0] as HTMLElement) || slotElem;
          }
        }
      }
    } else if (this.currentScreen === 'maps') {
      if (this.mapOnBottomBar) {
        target = this.mapBottomIndex === 0
          ? document.getElementById('btn-maps-back')
          : document.getElementById('btn-maps-confirm');
      } else {
        const cards = Array.from(document.querySelectorAll('.map-card')) as HTMLElement[];
        target = cards[this.mapGridIndex] || null;
      }
    } else if (this.currentScreen === 'draft') {
      const draftCards = Array.from(document.querySelectorAll('.draft-card')) as HTMLElement[];
      target = draftCards[this.draftCardIndex] || null;
    } else if (this.currentScreen === 'podium') {
      const podiumBtns = [
        document.getElementById('btn-rematch'),
        document.getElementById('btn-change-map'),
        document.getElementById('btn-main-menu')
      ];
      target = podiumBtns[this.podiumButtonIndex] || null;
    }

    if (target) {
      target.classList.add('gamepad-focused');
      if (this.currentScreen === 'draft' && this.draftingPlayer) {
        target.style.outlineColor = this.draftingPlayer.color;
        target.style.boxShadow = `0 0 25px ${this.draftingPlayer.color}, 0 0 8px #fff`;
      }
      this.currentFocusedElement = target;
      target.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }

  private setFocusDirectly(target: HTMLElement): void {
    this.clearFocus();
    target.classList.add('gamepad-focused');
    if (this.currentScreen === 'draft' && this.draftingPlayer) {
      target.style.outlineColor = this.draftingPlayer.color;
      target.style.boxShadow = `0 0 25px ${this.draftingPlayer.color}, 0 0 8px #fff`;
    }
    this.currentFocusedElement = target;
  }

  private clearFocus(): void {
    if (this.currentFocusedElement) {
      this.currentFocusedElement.classList.remove('gamepad-focused');
      this.currentFocusedElement.style.outlineColor = '';
      this.currentFocusedElement.style.boxShadow = '';
      this.currentFocusedElement = null;
    }
    document.querySelectorAll('.gamepad-focused').forEach(el => {
      (el as HTMLElement).classList.remove('gamepad-focused');
      (el as HTMLElement).style.outlineColor = '';
      (el as HTMLElement).style.boxShadow = '';
    });
  }
}
