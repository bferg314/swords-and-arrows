import { Player } from '../entities/Player';
import { InputManager } from '../core/InputManager';

export type ActiveScreenType = 'title' | 'lobby' | 'maps' | 'controls' | 'codex' | 'draft' | 'podium' | 'game' | 'pause';

export class GamepadNavigator {
  private currentScreen: ActiveScreenType = 'title';
  private draftingPlayer: Player | null = null;
  private inputManager: InputManager | null = null;
  private lastActiveGamepadIndex: number | null = null;

  public onTogglePauseRequested?: () => void;

  // Navigation state per screen
  private titleIndex: number = 0;
  private lobbySlotIndex: number = 0;  // 0: P1, 1: P2, 2: P3, 3: P4
  private lobbySubIndex: number = 1;   // 0: Toggle (+ ADD / ✕ REMOVE), 1: Type, 2: Color
  private lobbyOnBottomBar: boolean = false;
  private lobbyBottomIndex: number = 1; // 0: Back, 1: Fight
  private lobbyOnRulesBar: boolean = false;
  private lobbyRulesIndex: number = 0;  // 0: Target Wins, 1: Round HP
  private mapGridIndex: number = 0;
  private mapOnBottomBar: boolean = false;
  private mapBottomIndex: number = 1;  // 0: Back, 1: Confirm
  private draftCardIndex: number = 0;
  private podiumButtonIndex: number = 0;
  private pauseButtonIndex: number = 0;

  // Input repeat timing
  private moveCooldown: number = 0;
  private moveRepeatTimer: number = 0;
  private prevButtons: boolean[] = new Array(20).fill(false);
  private prevGamepadConfirm: Map<number, boolean> = new Map();
  private prevLobbyJoinPress: Map<number, boolean> = new Map();

  // Focus element tracking
  private currentFocusedElement: HTMLElement | null = null;
  private promptBar: HTMLElement | null = null;

  public getTitleButtons(): HTMLElement[] {
    const btns = [
      document.getElementById('btn-start-game'),
      document.getElementById('btn-show-maps'),
      document.getElementById('btn-show-controls'),
      document.getElementById('btn-show-powerups'),
      document.getElementById('btn-exit-game')
    ].filter((el): el is HTMLElement => !!el && !el.classList.contains('hidden') && el.style.display !== 'none');
    return btns;
  }

  public getPodiumButtons(): HTMLElement[] {
    const btns = [
      document.getElementById('btn-rematch'),
      document.getElementById('btn-change-map'),
      document.getElementById('btn-main-menu'),
      document.getElementById('btn-podium-exit')
    ].filter((el): el is HTMLElement => !!el && !el.classList.contains('hidden') && el.style.display !== 'none');
    return btns;
  }

  public getPauseButtons(): HTMLElement[] {
    const btns = [
      document.getElementById('btn-pause-resume'),
      document.getElementById('btn-pause-restart'),
      document.getElementById('btn-pause-menu'),
      document.getElementById('btn-pause-exit')
    ].filter((el): el is HTMLElement => !!el && !el.classList.contains('hidden') && el.style.display !== 'none');
    return btns;
  }

  public isSlotActive(slot: number): boolean {
    if (slot === 0 || slot === 1) return true;
    const slotElem = document.getElementById(`slot-p${slot + 1}`);
    return slotElem?.classList.contains('active') ?? false;
  }

  public hasSlotToggle(slot: number): boolean {
    return slot === 2 || slot === 3;
  }

  public getTopSubIndexForSlot(slot: number): number {
    return this.hasSlotToggle(slot) ? 0 : 1;
  }

  public getBottomSubIndexForSlot(slot: number): number {
    return this.isSlotActive(slot) ? 2 : 0;
  }

  private isMouseActive: boolean = false;

  public setMouseActive(active: boolean): void {
    if (this.isMouseActive === active && document.body.classList.contains('non-mouse-active') === !active) return;
    this.isMouseActive = active;
    if (active) {
      document.body.classList.remove('non-mouse-active');
    } else {
      document.body.classList.add('non-mouse-active');
    }
  }

  constructor(inputManager?: InputManager) {
    this.inputManager = inputManager || null;
    this.createPromptBar();
    this.initKeyboardListeners();
    this.initMouseListeners();
    this.initGamepadEvents();
    this.setMouseActive(false);
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
      this.setMouseActive(false);

      // If actively playing in arena combat, allow Escape to toggle pause
      if (this.currentScreen === 'game') {
        if (e.code === 'Escape') {
          e.preventDefault();
          this.onTogglePauseRequested?.();
        }
        return;
      }

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

      // Codex & Controls screens: Allow ArrowUp/ArrowDown/PageUp/PageDown to scroll
      if (this.currentScreen === 'codex' || this.currentScreen === 'controls') {
        const code = e.code;
        if (code === 'ArrowUp' || code === 'KeyW' || code === 'PageUp') {
          e.preventDefault();
          this.scrollActiveContainer(-70);
          return;
        } else if (code === 'ArrowDown' || code === 'KeyS' || code === 'PageDown') {
          e.preventDefault();
          this.scrollActiveContainer(70);
          return;
        }
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
  }

  private initMouseListeners(): void {
    let lastMouseX = -1;
    let lastMouseY = -1;

    window.addEventListener('mousemove', (e) => {
      if (lastMouseX === -1 && lastMouseY === -1) {
        lastMouseX = e.clientX;
        lastMouseY = e.clientY;
        return;
      }
      const dist = Math.hypot(e.clientX - lastMouseX, e.clientY - lastMouseY);
      if (dist > 3) {
        lastMouseX = e.clientX;
        lastMouseY = e.clientY;
        this.setMouseActive(true);
      }
    });

    window.addEventListener('mousedown', () => {
      this.setMouseActive(true);
    });

    // Also listen to mouse hover on buttons/cards so focus ring updates seamlessly when mouse is active
    document.addEventListener('mouseover', (e) => {
      if (this.currentScreen === 'game') return;
      if (!this.isMouseActive) return; // Completely ignore mouse hover when using controller or non-mouse!
      const target = (e.target as HTMLElement).closest('.btn, .map-card, .draft-card, .slot-select, .rule-select, .color-swatch, .btn-toggle-slot') as HTMLElement;
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

    document.addEventListener('click', (e) => {
      this.setMouseActive(true);
      if (this.currentScreen === 'maps') {
        const card = (e.target as HTMLElement).closest('.map-card') as HTMLElement;
        if (card) {
          const cards = Array.from(document.querySelectorAll('.map-card'));
          const idx = cards.indexOf(card);
          if (idx !== -1) {
            this.mapGridIndex = idx;
            this.mapOnBottomBar = false;
            this.applyFocus();
          }
        }
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
    if (!this.isMouseActive) {
      document.body.classList.add('non-mouse-active');
    }

    if (screen === 'game') {
      if (this.promptBar) {
        this.promptBar.classList.add('hidden');
        this.promptBar.style.display = 'none';
        this.promptBar.innerHTML = '';
      }
      this.podiumButtonIndex = 0;
      this.pauseButtonIndex = 0;
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
      if (screen === 'pause') {
        this.pauseButtonIndex = 0;
      }
      if (screen === 'maps') {
        const grid = document.getElementById('maps-grid') || document.querySelector('.maps-grid-container');
        if (grid) grid.scrollTop = 0;
      }
      if (screen === 'codex') {
        const codex = document.getElementById('codex-container') || document.querySelector('.codex-container');
        if (codex) codex.scrollTop = 0;
      }
      if (screen === 'controls') {
        const modal = document.querySelector('#controls-screen .modal-card');
        if (modal) modal.scrollTop = 0;
      }
      if (screen === 'lobby') {
        this.lobbyOnRulesBar = false;
        this.lobbyOnBottomBar = false;
      }
      this.updatePromptBar();
      this.applyFocus();
    }
  }

  public setLobbySlotFocus(slot: number, subIndex: number = 1): void {
    this.lobbySlotIndex = Math.max(0, Math.min(3, slot));
    this.lobbySubIndex = subIndex;
    this.lobbyOnRulesBar = false;
    this.lobbyOnBottomBar = false;
    this.applyFocus();
  }

  public scrollActiveContainer(deltaPx: number): void {
    let container: HTMLElement | null = null;
    if (this.currentScreen === 'maps') {
      container = document.getElementById('maps-grid') || document.querySelector('.maps-grid-container');
    } else if (this.currentScreen === 'codex') {
      container = document.getElementById('codex-container') || document.querySelector('.codex-container');
    } else if (this.currentScreen === 'controls') {
      container = document.querySelector('#controls-screen .modal-card');
    }

    if (container) {
      container.scrollBy({ top: deltaPx, behavior: 'auto' });
    }
  }

  public update(dt: number): void {
    if (this.currentScreen === 'game') {
      // Check if START button was pressed on any gamepad to pause during battle
      const rawGamepads = navigator.getGamepads ? navigator.getGamepads() : [];
      let btnStart = false;
      for (let i = 0; i < rawGamepads.length; i++) {
        const gp = rawGamepads[i];
        if (!gp || !gp.connected) continue;
        const pStart = (gp.buttons[9]?.pressed ?? false) || (gp.buttons[8]?.pressed ?? false);
        if (pStart) btnStart = true;
      }
      if (btnStart && !this.prevButtons[9]) {
        this.onTogglePauseRequested?.();
      }
      this.prevButtons[9] = btnStart;
      return;
    }

    if (this.currentScreen === 'draft') {
      this.updateDraftGamepad(dt);
      return;
    }

    // Scan ALL connected gamepads for general menu navigation
    const rawGamepads = navigator.getGamepads ? navigator.getGamepads() : [];
    let aggregatedStickX = 0;
    let aggregatedStickY = 0;
    let aggregatedRightStickY = 0;
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

      // Right Stick (axes[2], axes[3])
      const rx = (gp.axes.length >= 3 ? gp.axes[2] : 0) || 0;
      const ry = (gp.axes.length >= 4 ? gp.axes[3] : 0) || 0;
      const rightDeadzone = 0.15;
      const hasRightStick = Math.abs(rx) > rightDeadzone || Math.abs(ry) > rightDeadzone;
      if (Math.abs(ry) > rightDeadzone && Math.abs(ry) > Math.abs(aggregatedRightStickY)) {
        aggregatedRightStickY = ry;
      }

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
      if (hasStick || hasRightStick || pUp || pDown || pLeft || pRight || pA || pB || pX || pY || pStart) {
        this.setMouseActive(false);
        this.lastActiveGamepadIndex = gp.index;
        // Only register primary gamepad on Title Screen if slot 0 is not yet assigned.
        // NEVER overwrite or rebind player controllers during podium, rematch, pause, or draft!
        if (this.currentScreen === 'title' && this.inputManager && !this.inputManager.hasAssignedGamepad(0)) {
          this.inputManager.setPrimaryGamepadIndex(gp.index);
          this.inputManager.bindPlayerGamepad(0, gp.index);
        }
      }

      // In the warrior lobby: if an unassigned controller presses A or Start, join as human!
      const isConfirmPress = pA || pStart;
      const prevJoinPress = this.prevLobbyJoinPress.get(gp.index) ?? false;
      this.prevLobbyJoinPress.set(gp.index, isConfirmPress);

      if (this.currentScreen === 'lobby' && isConfirmPress && !prevJoinPress && this.inputManager) {
        let isAssignedToActiveHuman = false;
        for (let s = 0; s < 4; s++) {
          if (this.inputManager.getAssignedGamepad(s as any) === gp.index) {
            const select = document.getElementById(`p${s + 1}-type`) as HTMLSelectElement;
            const slotElem = document.getElementById(`slot-p${s + 1}`);
            const isActive = slotElem?.classList.contains('active') ?? false;
            const isHuman = select && !select.value.startsWith('cpu');
            if (isActive && isHuman) {
              isAssignedToActiveHuman = true;
              break;
            }
          }
        }

        if (!isAssignedToActiveHuman) {
          // If this controller matches a slot and the lobby cursor is actively on that slot,
          // allow button A to interact normally with the focused menu control (e.g. cycle CPU difficulty or select color).
          // Only trigger auto-join if:
          // 1) The slot is currently inactive, OR
          // 2) The cursor is NOT on this slot, OR
          // 3) The player pressed the START button to join
          const matchingSlot = gp.index >= 0 && gp.index <= 3 ? gp.index : null;
          const isNavigatingOwnActiveSlot = (
            matchingSlot !== null &&
            !this.lobbyOnRulesBar &&
            !this.lobbyOnBottomBar &&
            this.lobbySlotIndex === matchingSlot &&
            this.isSlotActive(matchingSlot) &&
            pA && !pStart
          );

          if (!isNavigatingOwnActiveSlot) {
            const joinedSlot = this.tryJoinLobbySlot(gp.index);
            if (joinedSlot !== null) {
              btnA = false;
              btnStart = false;
            }
          }
        }
      }
    }

    if (hasAnyGamepad) {
      const activeGp = (this.lastActiveGamepadIndex !== null ? rawGamepads[this.lastActiveGamepadIndex] : null)
        || rawGamepads.find(g => g && g.connected)
        || null;
      this.updateStatusBar(activeGp);

      // Right stick analog scrolling for Power Up Codex and Arena Selection
      if (this.currentScreen === 'maps' || this.currentScreen === 'codex' || this.currentScreen === 'controls') {
        const rightDeadzone = 0.15;
        if (Math.abs(aggregatedRightStickY) > rightDeadzone) {
          const sign = Math.sign(aggregatedRightStickY);
          const norm = (Math.abs(aggregatedRightStickY) - rightDeadzone) / (1 - rightDeadzone);
          const curved = Math.pow(norm, 1.35);
          const scrollSpeed = 850; // px per second at full deflection
          const delta = sign * curved * scrollSpeed * dt;
          this.scrollActiveContainer(delta);
        }
      }

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

    if (moveDirX !== 0 || (isConfirm && !prevConfirm)) {
      this.setMouseActive(false);
    }
  }

  public handleDirectionMove(dx: number, dy: number): void {
    if (this.currentScreen === 'title') {
      if (dy !== 0) {
        const btns = this.getTitleButtons();
        const count = btns.length || 4;
        this.titleIndex = (this.titleIndex + dy + count) % count;
        this.applyFocus();
      }
    } else if (this.currentScreen === 'pause') {
      if (dy !== 0) {
        const btns = this.getPauseButtons();
        const count = btns.length || 3;
        this.pauseButtonIndex = (this.pauseButtonIndex + dy + count) % count;
        this.applyFocus();
      }
    } else if (this.currentScreen === 'lobby') {
      if (this.lobbyOnRulesBar) {
        if (dy > 0) {
          // Move down back to player slots
          this.lobbyOnRulesBar = false;
          this.lobbySubIndex = this.getTopSubIndexForSlot(this.lobbySlotIndex);
          this.applyFocus();
        } else if (dx !== 0) {
          this.lobbyRulesIndex = this.lobbyRulesIndex === 0 ? 1 : 0;
          this.applyFocus();
        }
      } else if (this.lobbyOnBottomBar) {
        if (dy < 0) {
          // Move up back to player slots
          this.lobbyOnBottomBar = false;
          this.lobbySubIndex = this.getBottomSubIndexForSlot(this.lobbySlotIndex);
          this.applyFocus();
        } else if (dx !== 0) {
          this.lobbyBottomIndex = this.lobbyBottomIndex === 0 ? 1 : 0;
          this.applyFocus();
        }
      } else {
        const slot = this.lobbySlotIndex;
        const active = this.isSlotActive(slot);
        const hasToggle = this.hasSlotToggle(slot);

        if (dy > 0) {
          // Moving DOWN
          if (!active) {
            // Inactive slot only has toggle (0) -> go to bottom bar
            this.lobbyOnBottomBar = true;
            this.applyFocus();
          } else {
            // Active slot: Row 0 (Toggle) -> Row 1 (Type) -> Row 2 (Color) -> Bottom Bar
            if (this.lobbySubIndex === 0) {
              this.lobbySubIndex = 1;
              this.applyFocus();
            } else if (this.lobbySubIndex === 1) {
              this.lobbySubIndex = 2;
              this.applyFocus();
            } else {
              this.lobbyOnBottomBar = true;
              this.applyFocus();
            }
          }
        } else if (dy < 0) {
          // Moving UP
          if (!active) {
            // Inactive slot only has toggle (0) -> go to rules bar
            this.lobbyOnRulesBar = true;
            this.lobbyRulesIndex = this.lobbySlotIndex < 2 ? 0 : 1;
            this.applyFocus();
          } else {
            // Active slot: Row 2 (Color) -> Row 1 (Type) -> Row 0 (Toggle if present) -> Rules Bar
            if (this.lobbySubIndex === 2) {
              this.lobbySubIndex = 1;
              this.applyFocus();
            } else if (this.lobbySubIndex === 1) {
              if (hasToggle) {
                this.lobbySubIndex = 0;
                this.applyFocus();
              } else {
                this.lobbyOnRulesBar = true;
                this.lobbyRulesIndex = this.lobbySlotIndex < 2 ? 0 : 1;
                this.applyFocus();
              }
            } else {
              // From Row 0 (Toggle) up to Rules Bar
              this.lobbyOnRulesBar = true;
              this.lobbyRulesIndex = this.lobbySlotIndex < 2 ? 0 : 1;
              this.applyFocus();
            }
          }
        } else if (dx !== 0) {
          // Left / Right moves between player slots
          this.lobbySlotIndex = (this.lobbySlotIndex + dx + 4) % 4;
          const nextActive = this.isSlotActive(this.lobbySlotIndex);
          if (!nextActive) {
            this.lobbySubIndex = 0;
          } else if (this.lobbySubIndex === 0) {
            this.lobbySubIndex = 1;
          }
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
      const delta = dx !== 0 ? dx : dy;
      if (delta !== 0) {
        const btns = this.getPodiumButtons();
        const count = btns.length || 3;
        this.podiumButtonIndex = (this.podiumButtonIndex + delta + count) % count;
        this.applyFocus();
      }
    } else if (this.currentScreen === 'codex') {
      if (dy !== 0) {
        this.scrollActiveContainer(dy * 120);
      }
    } else if (this.currentScreen === 'controls') {
      if (dy !== 0) {
        this.scrollActiveContainer(dy * 120);
      }
    }
  }

  public handleButtonA(): void {
    if (this.currentScreen === 'title') {
      const titleBtns = this.getTitleButtons();
      titleBtns[this.titleIndex]?.click();
    } else if (this.currentScreen === 'pause') {
      const pauseBtns = this.getPauseButtons();
      pauseBtns[this.pauseButtonIndex]?.click();
    } else if (this.currentScreen === 'lobby') {
      if (this.lobbyOnRulesBar) {
        const selectId = this.lobbyRulesIndex === 0 ? 'lobby-target-wins' : 'lobby-round-hp';
        const select = document.getElementById(selectId) as HTMLSelectElement;
        if (select) {
          select.selectedIndex = (select.selectedIndex + 1) % select.options.length;
          select.dispatchEvent(new Event('change'));
        }
      } else if (this.lobbyOnBottomBar) {
        if (this.lobbyBottomIndex === 0) {
          document.getElementById('btn-lobby-back')?.click();
        } else {
          document.getElementById('btn-lobby-fight')?.click();
        }
      } else {
        const slot = this.lobbySlotIndex;
        const isActive = this.isSlotActive(slot);
        const hasToggle = this.hasSlotToggle(slot);

        if (!isActive || (this.lobbySubIndex === 0 && hasToggle)) {
          if (hasToggle) {
            // Toggle slot (+ ADD or ✕ REMOVE)
            document.getElementById(`toggle-p${slot + 1}`)?.click();
            this.applyFocus();
          }
          return;
        }

        if (this.lobbySubIndex === 0 || this.lobbySubIndex === 1) {
          // Cycle Type selector (Human, CPU Novice, CPU Skilled, CPU Deadly)
          const select = document.getElementById(`p${slot + 1}-type`) as HTMLSelectElement;
          if (select) {
            select.selectedIndex = (select.selectedIndex + 1) % select.options.length;
            select.dispatchEvent(new Event('change'));
          }
        } else if (this.lobbySubIndex === 2) {
          // Cycle Color swatches
          const swatches = Array.from(document.querySelectorAll(`.color-swatch[data-player="${slot + 1}"]`)) as HTMLElement[];
          if (swatches.length > 0) {
            const activeIdx = swatches.findIndex(s => s.classList.contains('active'));
            const nextIdx = (activeIdx + 1) % swatches.length;
            swatches[nextIdx]?.click();
            this.applyFocus();
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
      const podiumBtns = this.getPodiumButtons();
      podiumBtns[this.podiumButtonIndex]?.click();
    }
  }

  public handleButtonB(): void {
    if (this.currentScreen === 'pause') {
      this.onTogglePauseRequested?.();
    } else if (this.currentScreen === 'lobby') {
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
    if (this.currentScreen === 'pause') {
      this.onTogglePauseRequested?.();
    } else if (this.currentScreen === 'title') {
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
    } else if (this.currentScreen === 'pause') {
      this.promptBar.innerHTML = `
        <span><span class="gp-key">ARROWS / WASD</span> Navigate</span>
        <span><span class="gp-key">ENTER / A</span> Select</span>
        <span><span class="gp-key gp-b">ESC / B / START</span> Resume</span>
      `;
    } else if (this.currentScreen === 'lobby') {
      if (this.lobbyOnRulesBar) {
        this.promptBar.innerHTML = `
          <span><span class="gp-key">← / →</span> Switch Rule</span>
          <span><span class="gp-key">A / ENTER</span> Change Value</span>
          <span><span class="gp-key">DOWN</span> Warriors</span>
          <span><span class="gp-key gp-start">START</span> Fight!</span>
        `;
      } else if (this.lobbyOnBottomBar) {
        this.promptBar.innerHTML = `
          <span><span class="gp-key">← / →</span> Select Option</span>
          <span><span class="gp-key">A / ENTER</span> Choose</span>
          <span><span class="gp-key">UP</span> Warriors</span>
          <span><span class="gp-key gp-start">START</span> Fight!</span>
        `;
      } else {
        const slot = this.lobbySlotIndex;
        const active = this.isSlotActive(slot);
        let actionHint = 'Change/Toggle';
        if (!active) {
          actionHint = 'Add Player';
        } else if (this.lobbySubIndex === 0 && this.hasSlotToggle(slot)) {
          actionHint = 'Remove Player';
        } else if (this.lobbySubIndex === 1) {
          actionHint = 'Cycle Type';
        } else if (this.lobbySubIndex === 2) {
          actionHint = 'Cycle Color';
        }

        this.promptBar.innerHTML = `
          <span><span class="gp-key">ARROWS / WASD</span> Navigate</span>
          <span><span class="gp-key">A / ENTER</span> ${actionHint}</span>
          <span><span class="gp-key gp-b">ESC / B</span> Back</span>
          <span><span class="gp-key gp-start">START</span> Fight!</span>
        `;
      }
    } else if (this.currentScreen === 'maps') {
      this.promptBar.innerHTML = `
        <span><span class="gp-key">ARROWS / WASD</span> Choose</span>
        <span><span class="gp-key gp-stick">RIGHT STICK</span> Scroll</span>
        <span><span class="gp-key">ENTER / A</span> Select</span>
        <span><span class="gp-key gp-b">ESC / B</span> Back</span>
        <span><span class="gp-key gp-start">START</span> Confirm</span>
      `;
    } else if (this.currentScreen === 'codex') {
      this.promptBar.innerHTML = `
        <span><span class="gp-key gp-stick">RIGHT STICK</span> Scroll Codex</span>
        <span><span class="gp-key gp-b">ESC / B / ENTER</span> Close</span>
      `;
    } else if (this.currentScreen === 'controls') {
      this.promptBar.innerHTML = `
        <span><span class="gp-key gp-stick">RIGHT STICK</span> Scroll Guide</span>
        <span><span class="gp-key gp-b">ESC / B / ENTER</span> Close</span>
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
      const titleBtns = this.getTitleButtons();
      target = titleBtns[this.titleIndex] || null;
    } else if (this.currentScreen === 'pause') {
      const pauseBtns = this.getPauseButtons();
      target = pauseBtns[this.pauseButtonIndex] || null;
    } else if (this.currentScreen === 'lobby') {
      this.updatePromptBar();
      if (this.lobbyOnRulesBar) {
        target = this.lobbyRulesIndex === 0
          ? document.getElementById('lobby-target-wins')
          : document.getElementById('lobby-round-hp');
      } else if (this.lobbyOnBottomBar) {
        target = this.lobbyBottomIndex === 0
          ? document.getElementById('btn-lobby-back')
          : document.getElementById('btn-lobby-fight');
      } else {
        const slot = this.lobbySlotIndex;
        const active = this.isSlotActive(slot);
        const hasToggle = this.hasSlotToggle(slot);

        if (!active) {
          target = document.getElementById(`toggle-p${slot + 1}`);
        } else {
          if (this.lobbySubIndex === 0 && hasToggle) {
            target = document.getElementById(`toggle-p${slot + 1}`);
          } else if (this.lobbySubIndex === 1 || (!hasToggle && this.lobbySubIndex === 0)) {
            target = document.getElementById(`p${slot + 1}-type`);
          } else {
            const swatches = Array.from(document.querySelectorAll(`.color-swatch[data-player="${slot + 1}"]`)) as HTMLElement[];
            const activeSwatch = swatches.find(s => s.classList.contains('active'));
            target = activeSwatch || swatches[0] || document.getElementById(`slot-p${slot + 1}`);
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
      const podiumBtns = this.getPodiumButtons();
      target = podiumBtns[this.podiumButtonIndex] || null;
    } else if (this.currentScreen === 'codex') {
      target = document.getElementById('btn-codex-close');
    } else if (this.currentScreen === 'controls') {
      target = document.getElementById('btn-controls-close');
    }

    if (target) {
      target.classList.add('gamepad-focused');
      if (this.currentScreen === 'draft' && this.draftingPlayer) {
        target.style.outlineColor = this.draftingPlayer.color;
        target.style.boxShadow = `0 0 25px ${this.draftingPlayer.color}, 0 0 8px #fff`;
      }
      this.currentFocusedElement = target;
      if (this.currentScreen !== 'codex' && this.currentScreen !== 'controls') {
        target.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }
  }

  private setFocusDirectly(target: HTMLElement): void {
    this.clearFocus();
    target.classList.add('gamepad-focused');
    if (this.currentScreen === 'draft' && this.draftingPlayer) {
      target.style.outlineColor = this.draftingPlayer.color;
      target.style.boxShadow = `0 0 25px ${this.draftingPlayer.color}, 0 0 8px #fff`;
    }
    if (this.currentScreen === 'title') {
      const btns = this.getTitleButtons();
      const idx = btns.indexOf(target);
      if (idx !== -1) this.titleIndex = idx;
    } else if (this.currentScreen === 'pause') {
      const btns = this.getPauseButtons();
      const idx = btns.indexOf(target);
      if (idx !== -1) this.pauseButtonIndex = idx;
    } else if (this.currentScreen === 'podium') {
      const btns = this.getPodiumButtons();
      const idx = btns.indexOf(target);
      if (idx !== -1) this.podiumButtonIndex = idx;
    } else if (target.id === 'lobby-target-wins') {
      this.lobbyOnRulesBar = true;
      this.lobbyRulesIndex = 0;
      this.lobbyOnBottomBar = false;
      this.updatePromptBar();
    } else if (target.id === 'lobby-round-hp') {
      this.lobbyOnRulesBar = true;
      this.lobbyRulesIndex = 1;
      this.lobbyOnBottomBar = false;
      this.updatePromptBar();
    } else if (target.id === 'btn-lobby-back') {
      this.lobbyOnBottomBar = true;
      this.lobbyBottomIndex = 0;
      this.lobbyOnRulesBar = false;
      this.updatePromptBar();
    } else if (target.id === 'btn-lobby-fight') {
      this.lobbyOnBottomBar = true;
      this.lobbyBottomIndex = 1;
      this.lobbyOnRulesBar = false;
      this.updatePromptBar();
    } else if (this.currentScreen === 'lobby') {
      this.lobbyOnRulesBar = false;
      this.lobbyOnBottomBar = false;
      if (target.classList.contains('btn-toggle-slot')) {
        const pMatch = target.id.match(/toggle-p(\d+)/);
        if (pMatch) {
          this.lobbySlotIndex = parseInt(pMatch[1]) - 1;
          this.lobbySubIndex = 0;
        }
      } else if (target.classList.contains('slot-select')) {
        const pMatch = target.id.match(/p(\d+)-type/);
        if (pMatch) {
          this.lobbySlotIndex = parseInt(pMatch[1]) - 1;
          this.lobbySubIndex = 1;
        }
      } else if (target.classList.contains('color-swatch')) {
        const pStr = target.getAttribute('data-player');
        if (pStr) {
          this.lobbySlotIndex = parseInt(pStr) - 1;
          this.lobbySubIndex = 2;
        }
      }
      this.updatePromptBar();
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

  private tryJoinLobbySlot(gpIndex: number): number | null {
    if (!this.inputManager) return null;

    const joinSlot = (slot: number): number => {
      const slotElem = document.getElementById(`slot-p${slot + 1}`);
      const selectElem = document.getElementById(`p${slot + 1}-type`) as HTMLSelectElement;
      const isActive = slotElem?.classList.contains('active') ?? false;

      if (!isActive) {
        document.getElementById(`toggle-p${slot + 1}`)?.click();
      }

      if (selectElem && selectElem.value !== 'human') {
        selectElem.value = 'human';
        selectElem.dispatchEvent(new Event('change'));
      }

      this.lobbySlotIndex = slot;
      this.lobbySubIndex = 1; // Always focus directly on the TYPE dropdown
      this.lobbyOnRulesBar = false;
      this.lobbyOnBottomBar = false;
      this.applyFocus();
      return slot;
    };

    // 1. If this controller has a natural matching slot (0 -> P1, 1 -> P2, 2 -> P3, 3 -> P4):
    if (gpIndex >= 0 && gpIndex <= 3) {
      return joinSlot(gpIndex);
    }

    // 2. Fallback: find first inactive or CPU slot (1, 2, 3, 0)
    for (const slot of [1, 2, 3, 0] as const) {
      const slotElem = document.getElementById(`slot-p${slot + 1}`);
      const selectElem = document.getElementById(`p${slot + 1}-type`) as HTMLSelectElement;
      const isActive = slotElem?.classList.contains('active') ?? false;
      const isCpu = selectElem ? selectElem.value.startsWith('cpu') : false;

      if (!isActive || isCpu) {
        return joinSlot(slot);
      }
    }

    return null;
  }
}
