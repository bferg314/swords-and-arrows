export interface PlayerInputState {
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
  jump: boolean;
  jumpJustPressed: boolean;
  attack: boolean;
  attackJustPressed: boolean;
  attackJustReleased: boolean;
  parry: boolean;
  parryJustPressed: boolean;
  switchWeapon: boolean;
  switchWeaponJustPressed: boolean;
  dash: boolean;
  dashJustPressed: boolean;
  aimX: number;
  aimY: number;
}

export type PlayerSlot = 0 | 1 | 2 | 3;

export class InputManager {
  private keysDown: Set<string> = new Set();
  private keysJustPressed: Set<string> = new Set();
  private keysJustReleased: Set<string> = new Set();

  private prevGamepadButtons: boolean[][] = [[], [], [], []];
  private virtualInputs: (PlayerInputState | null)[] = [null, null, null, null];
  private assignedGamepads: Map<PlayerSlot, number> = new Map();
  private primaryGamepadIndex: number | null = null;
  private isSingleHumanMatch: boolean = true;

  // Mouse aiming & attack support for PC / Player 1
  private mouseCanvasX: number = 640;
  private mouseCanvasY: number = 360;
  private isMouseDown: boolean = false;
  private mouseJustPressed: boolean = false;
  private mouseJustReleased: boolean = false;
  private isMouseAiming: boolean = false;
  private p1WorldX: number = 640;
  private p1WorldY: number = 360;
  private camera: { screenToWorld: (sx: number, sy: number) => { x: number; y: number } } | null = null;
  private canvas: HTMLCanvasElement | null = null;

  constructor() {
    window.addEventListener('keydown', (e) => {
      if (!this.keysDown.has(e.code)) {
        this.keysJustPressed.add(e.code);
      }
      this.keysDown.add(e.code);
    });

    window.addEventListener('keyup', (e) => {
      this.keysDown.delete(e.code);
      this.keysJustReleased.add(e.code);
    });

    window.addEventListener('mousemove', (e) => {
      this.isMouseAiming = true;
      if (!this.canvas) {
        this.canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
      }
      if (this.canvas) {
        const rect = this.canvas.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          this.mouseCanvasX = (e.clientX - rect.left) * (1280 / rect.width);
          this.mouseCanvasY = (e.clientY - rect.top) * (720 / rect.height);
        }
      }
    });

    window.addEventListener('mousedown', (e) => {
      if (e.button === 0) { // Left click
        this.isMouseDown = true;
        this.mouseJustPressed = true;
        this.isMouseAiming = true;
      }
    });

    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) {
        this.isMouseDown = false;
        this.mouseJustReleased = true;
      }
    });
  }

  public setCamera(camera: { screenToWorld: (sx: number, sy: number) => { x: number; y: number } }): void {
    this.camera = camera;
  }

  public setP1WorldPos(x: number, y: number): void {
    this.p1WorldX = x;
    this.p1WorldY = y;
  }

  public setSingleHumanMatch(isSingle: boolean): void {
    this.isSingleHumanMatch = isSingle;
  }

  public setPrimaryGamepadIndex(index: number | null): void {
    this.primaryGamepadIndex = index;
    if (index !== null && !this.assignedGamepads.has(0)) {
      this.assignedGamepads.set(0, index);
    }
  }

  public bindPlayerGamepad(slot: PlayerSlot, gpIndex: number): void {
    // Remove gpIndex from any other slot to avoid duplicates
    for (const [s, idx] of this.assignedGamepads.entries()) {
      if (idx === gpIndex && s !== slot) {
        this.assignedGamepads.delete(s);
      }
    }
    this.assignedGamepads.set(slot, gpIndex);
  }

  public unbindPlayerGamepad(slot: PlayerSlot): void {
    this.assignedGamepads.delete(slot);
  }

  public getAssignedGamepad(slot: PlayerSlot): number | undefined {
    return this.assignedGamepads.get(slot);
  }

  public hasAssignedGamepad(slot: PlayerSlot): boolean {
    return this.assignedGamepads.has(slot);
  }

  public resetAllControllerAssignments(): void {
    this.assignedGamepads.clear();
    this.primaryGamepadIndex = null;
  }

  public resetMatchInput(): void {
    this.virtualInputs = [null, null, null, null];
    this.prevGamepadButtons = [[], [], [], []];
    this.keysJustPressed.clear();
    this.keysJustReleased.clear();

    // NOTE: Do NOT clear assignedGamepads! Once assigned, controllers persist
    // across matches and rematches so players never get swapped.
  }

  public ensureHumanGamepadAssignments(playerConfigs: { slot: number; active: boolean; type: string }[]): void {
    const validGamepads = this.getValidGamepads();

    const humanSlots = playerConfigs
      .filter(cfg => cfg.active && !cfg.type.startsWith('cpu'))
      .map(cfg => cfg.slot as PlayerSlot)
      .sort((a, b) => a - b);

    // 1. Clean up slots that are no longer active human
    for (const [slot] of this.assignedGamepads.entries()) {
      if (!humanSlots.includes(slot)) {
        this.assignedGamepads.delete(slot);
      }
    }

    if (validGamepads.length === 0 || humanSlots.length === 0) {
      if (humanSlots.length === 0) {
        this.assignedGamepads.clear();
      }
      return;
    }

    const usedIndices = new Set<number>();
    const assignedSlots = new Set<PlayerSlot>();

    // 2. Exact match phase:
    // If a connected gamepad has index === slot for an active human slot,
    // that gamepad belongs to this player slot! (GP 1 -> P1, GP 2 -> P2, GP 3 -> P3, GP 4 -> P4)
    for (const slot of humanSlots) {
      const exactGp = validGamepads.find(g => g.index === slot);
      if (exactGp) {
        this.assignedGamepads.set(slot, exactGp.index);
        usedIndices.add(exactGp.index);
        assignedSlots.add(slot);
        if (slot === 0 && this.primaryGamepadIndex === null) {
          this.primaryGamepadIndex = exactGp.index;
        }
      }
    }

    // 3. For any active human slots without an exact match:
    // Retain their current valid assignment if it is still connected and not claimed by an exact match
    for (const slot of humanSlots) {
      if (!assignedSlots.has(slot)) {
        const prevAssigned = this.assignedGamepads.get(slot);
        if (prevAssigned !== undefined && validGamepads.some(g => g.index === prevAssigned) && !usedIndices.has(prevAssigned)) {
          usedIndices.add(prevAssigned);
          assignedSlots.add(slot);
        }
      }
    }

    // 4. For any remaining unassigned human slots in slot order (P1 -> P2 -> P3 -> P4):
    // Allocate remaining available gamepads without collision
    for (const slot of humanSlots) {
      if (!assignedSlots.has(slot)) {
        const nextAvailable = validGamepads.find(g => !usedIndices.has(g.index));
        if (nextAvailable) {
          this.assignedGamepads.set(slot, nextAvailable.index);
          usedIndices.add(nextAvailable.index);
          assignedSlots.add(slot);
          if (slot === 0 && this.primaryGamepadIndex === null) {
            this.primaryGamepadIndex = nextAvailable.index;
          }
        } else {
          // No gamepad available -> clear so slot cleanly uses keyboard
          this.assignedGamepads.delete(slot);
        }
      }
    }
  }

  public getValidGamepads(): Gamepad[] {
    const raw = navigator.getGamepads ? navigator.getGamepads() : [];
    const valid: Gamepad[] = [];
    for (let i = 0; i < raw.length; i++) {
      const g = raw[i];
      if (!g || !g.connected) continue;

      // Filter out non-gamepad devices (touchpads, gyro sensors, virtual mice)
      const idLower = (g.id || '').toLowerCase();
      if (
        idLower.includes('sensor') ||
        idLower.includes('touchpad') ||
        idLower.includes('gyro') ||
        idLower.includes('mouse')
      ) {
        continue;
      }

      // A real gamepad must have at least 4 buttons and 2 axes
      if (!g.buttons || g.buttons.length < 4) continue;

      valid.push(g);
    }
    return valid;
  }

  public getConnectedGamepadsCount(): number {
    return this.getValidGamepads().length;
  }

  public getGamepadForSlot(slot: PlayerSlot): Gamepad | null {
    const validGamepads = this.getValidGamepads();
    if (validGamepads.length === 0) return null;

    // 1. Check if slot has an explicitly assigned gamepad that is still connected
    const assignedIndex = this.assignedGamepads.get(slot);
    if (assignedIndex !== undefined) {
      const found = validGamepads.find(g => g.index === assignedIndex);
      if (found) return found;
    }

    // 2. Single-human match (Human vs Bots):
    // In a solo match, Player 1 should be controllable by the primary gamepad or first gamepad
    if (this.isSingleHumanMatch && slot === 0) {
      if (this.primaryGamepadIndex !== null) {
        const primary = validGamepads.find(g => g.index === this.primaryGamepadIndex);
        if (primary) return primary;
      }
      return validGamepads[0];
    }

    // 3. Multi-human couch co-op / PvP match:
    // If not yet assigned, assign from available unassigned gamepads without collision
    const usedIndices = new Set<number>();
    for (const [otherSlot, gpIdx] of this.assignedGamepads.entries()) {
      if (otherSlot !== slot) {
        usedIndices.add(gpIdx);
      }
    }

    const available = validGamepads.filter(g => !usedIndices.has(g.index));
    if (available.length > 0) {
      const matchingGp = available.find(g => g.index === slot);
      const chosen = matchingGp || available[0];
      this.assignedGamepads.set(slot, chosen.index);
      return chosen;
    }

    return null;
  }

  public setVirtualInput(playerIndex: PlayerSlot, input: PlayerInputState | null): void {
    this.virtualInputs[playerIndex] = input;
  }

  public getInput(playerIndex: PlayerSlot, useGamepadIfAvailable: boolean = true): PlayerInputState {
    // If virtual input is supplied by AI bot, return it
    if (this.virtualInputs[playerIndex]) {
      return this.virtualInputs[playerIndex]!;
    }

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

    // 1. Read Keyboard mapping for this player slot
    this.readKeyboard(playerIndex, state);

    // 2. Read Gamepad if available for this slot
    if (useGamepadIfAvailable) {
      this.readGamepad(playerIndex, state);
    }

    return state;
  }

  private readKeyboard(slot: PlayerSlot, state: PlayerInputState): void {
    if (slot === 0) {
      // P1: WASD, F, G, R, Shift / Space
      state.left = state.left || this.keysDown.has('KeyA');
      state.right = state.right || this.keysDown.has('KeyD');
      state.up = state.up || this.keysDown.has('KeyW');
      state.down = state.down || this.keysDown.has('KeyS');
      state.jump = state.jump || this.keysDown.has('KeyW') || this.keysDown.has('Space');
      state.jumpJustPressed = state.jumpJustPressed || this.keysJustPressed.has('KeyW') || this.keysJustPressed.has('Space');
      state.attack = state.attack || this.keysDown.has('KeyF');
      state.attackJustPressed = state.attackJustPressed || this.keysJustPressed.has('KeyF');
      state.attackJustReleased = state.attackJustReleased || this.keysJustReleased.has('KeyF');
      state.parry = state.parry || this.keysDown.has('KeyG');
      state.parryJustPressed = state.parryJustPressed || this.keysJustPressed.has('KeyG');
      state.switchWeapon = state.switchWeapon || this.keysDown.has('KeyR');
      state.switchWeaponJustPressed = state.switchWeaponJustPressed || this.keysJustPressed.has('KeyR');
      state.dash = state.dash || this.keysDown.has('ShiftLeft') || this.keysDown.has('KeyE');
      state.dashJustPressed = state.dashJustPressed || this.keysJustPressed.has('ShiftLeft') || this.keysJustPressed.has('KeyE');
    } else if (slot === 1) {
      // P2: Arrow keys, K, L, O, RightShift
      state.left = state.left || this.keysDown.has('ArrowLeft');
      state.right = state.right || this.keysDown.has('ArrowRight');
      state.up = state.up || this.keysDown.has('ArrowUp');
      state.down = state.down || this.keysDown.has('ArrowDown');
      state.jump = state.jump || this.keysDown.has('ArrowUp');
      state.jumpJustPressed = state.jumpJustPressed || this.keysJustPressed.has('ArrowUp');
      state.attack = state.attack || this.keysDown.has('KeyK');
      state.attackJustPressed = state.attackJustPressed || this.keysJustPressed.has('KeyK');
      state.attackJustReleased = state.attackJustReleased || this.keysJustReleased.has('KeyK');
      state.parry = state.parry || this.keysDown.has('KeyL');
      state.parryJustPressed = state.parryJustPressed || this.keysJustPressed.has('KeyL');
      state.switchWeapon = state.switchWeapon || this.keysDown.has('KeyO') || this.keysDown.has('KeyI');
      state.switchWeaponJustPressed = state.switchWeaponJustPressed || this.keysJustPressed.has('KeyO') || this.keysJustPressed.has('KeyI');
      state.dash = state.dash || this.keysDown.has('ShiftRight') || this.keysDown.has('Slash');
      state.dashJustPressed = state.dashJustPressed || this.keysJustPressed.has('ShiftRight') || this.keysJustPressed.has('Slash');
    } else if (slot === 2) {
      // P3: IJKL, U, P, Y, H
      state.left = state.left || this.keysDown.has('KeyJ');
      state.right = state.right || this.keysDown.has('KeyL');
      state.up = state.up || this.keysDown.has('KeyI');
      state.down = state.down || this.keysDown.has('KeyK');
      state.jump = state.jump || this.keysDown.has('KeyI');
      state.jumpJustPressed = state.jumpJustPressed || this.keysJustPressed.has('KeyI');
      state.attack = state.attack || this.keysDown.has('KeyU');
      state.attackJustPressed = state.attackJustPressed || this.keysJustPressed.has('KeyU');
      state.attackJustReleased = state.attackJustReleased || this.keysJustReleased.has('KeyU');
      state.parry = state.parry || this.keysDown.has('KeyP');
      state.parryJustPressed = state.parryJustPressed || this.keysJustPressed.has('KeyP');
      state.switchWeapon = state.switchWeapon || this.keysDown.has('KeyY');
      state.switchWeaponJustPressed = state.switchWeaponJustPressed || this.keysJustPressed.has('KeyY');
      state.dash = state.dash || this.keysDown.has('KeyH');
      state.dashJustPressed = state.dashJustPressed || this.keysJustPressed.has('KeyH');
    } else if (slot === 3) {
      // P4: Numpad 4568, 1, 2, 3, 0
      state.left = state.left || this.keysDown.has('Numpad4');
      state.right = state.right || this.keysDown.has('Numpad6');
      state.up = state.up || this.keysDown.has('Numpad8');
      state.down = state.down || this.keysDown.has('Numpad5') || this.keysDown.has('Numpad2');
      state.jump = state.jump || this.keysDown.has('Numpad8');
      state.jumpJustPressed = state.jumpJustPressed || this.keysJustPressed.has('Numpad8');
      state.attack = state.attack || this.keysDown.has('Numpad1');
      state.attackJustPressed = state.attackJustPressed || this.keysJustPressed.has('Numpad1');
      state.attackJustReleased = state.attackJustReleased || this.keysJustReleased.has('Numpad1');
      state.parry = state.parry || this.keysDown.has('Numpad2');
      state.parryJustPressed = state.parryJustPressed || this.keysJustPressed.has('Numpad2');
      state.switchWeapon = state.switchWeapon || this.keysDown.has('Numpad3');
      state.switchWeaponJustPressed = state.switchWeaponJustPressed || this.keysJustPressed.has('Numpad3');
      state.dash = state.dash || this.keysDown.has('Numpad0');
      state.dashJustPressed = state.dashJustPressed || this.keysJustPressed.has('Numpad0');
    }

    // Default aim vector from direction buttons
    let ax = 0;
    let ay = 0;
    if (state.left) ax -= 1;
    if (state.right) ax += 1;
    if (state.up) ay -= 1;
    if (state.down) ay += 1;

    state.aimX = ax;
    state.aimY = ay;

    // For Player 1: if mouse is active, calculate precise continuous 360 aim from character to cursor
    if (slot === 0 && this.isMouseAiming && this.camera) {
      const worldMouse = this.camera.screenToWorld(this.mouseCanvasX, this.mouseCanvasY);
      const mDx = worldMouse.x - this.p1WorldX;
      const mDy = worldMouse.y - this.p1WorldY;
      const mDist = Math.hypot(mDx, mDy);
      if (mDist > 12) {
        state.aimX = mDx / mDist;
        state.aimY = mDy / mDist;
      }

      // Mouse left-click triggers attack (draw & release bow, sword combo)
      if (this.isMouseDown) {
        state.attack = true;
      }
      if (this.mouseJustPressed) {
        state.attackJustPressed = true;
      }
      if (this.mouseJustReleased) {
        state.attackJustReleased = true;
      }
    }
  }

  private readGamepad(slot: PlayerSlot, state: PlayerInputState): void {
    const gp = this.getGamepadForSlot(slot);
    if (!gp || !gp.connected) return;

    const deadzone = 0.25;
    const stickX = gp.axes[0] || 0;
    const stickY = gp.axes[1] || 0;

    const dpadUp = gp.buttons[12]?.pressed ?? false;
    const dpadDown = gp.buttons[13]?.pressed ?? false;
    const dpadLeft = gp.buttons[14]?.pressed ?? false;
    const dpadRight = gp.buttons[15]?.pressed ?? false;

    if (stickX < -deadzone || dpadLeft) state.left = true;
    if (stickX > deadzone || dpadRight) state.right = true;
    if (stickY < -deadzone || dpadUp) state.up = true;
    if (stickY > deadzone || dpadDown) state.down = true;

    // Gamepad buttons:
    // 0: A / Cross -> Jump
    // 1: B / Circle -> Parry
    // 2: X / Square -> Attack
    // 3: Y / Triangle -> Switch Weapon
    // 4: LB, 5: RB -> Switch Weapon / Dash
    // 6: LT, 7: RT -> Dash
    const btnJump = gp.buttons[0]?.pressed ?? false;
    const btnParry = gp.buttons[1]?.pressed ?? false;
    const btnAttack = gp.buttons[2]?.pressed ?? false;
    const btnSwitch = (gp.buttons[3]?.pressed ?? false) || (gp.buttons[5]?.pressed ?? false);
    const btnDash = (gp.buttons[4]?.pressed ?? false) || (gp.buttons[6]?.pressed ?? false) || (gp.buttons[7]?.pressed ?? false);

    const prev = this.prevGamepadButtons[slot];

    if (btnJump) {
      state.jump = true;
      if (!prev[0]) state.jumpJustPressed = true;
    }
    if (btnAttack) {
      state.attack = true;
      if (!prev[2]) state.attackJustPressed = true;
    } else if (prev[2]) {
      state.attackJustReleased = true;
    }
    if (btnParry) {
      state.parry = true;
      if (!prev[1]) state.parryJustPressed = true;
    }
    if (btnSwitch) {
      state.switchWeapon = true;
      if (!prev[3] && !prev[5]) state.switchWeaponJustPressed = true;
    }
    if (btnDash) {
      state.dash = true;
      if (!prev[4] && !prev[6] && !prev[7]) state.dashJustPressed = true;
    }

    // Analog stick & D-pad aim
    const rightStickX = gp.axes[2] || 0;
    const rightStickY = gp.axes[3] || 0;

    if (Math.hypot(rightStickX, rightStickY) > deadzone) {
      state.aimX = rightStickX;
      state.aimY = rightStickY;
    } else if (Math.hypot(stickX, stickY) > deadzone) {
      state.aimX = stickX;
      state.aimY = stickY;
    } else if (dpadLeft || dpadRight || dpadUp || dpadDown) {
      let dX = 0;
      let dY = 0;
      if (dpadLeft) dX -= 1;
      if (dpadRight) dX += 1;
      if (dpadUp) dY -= 1;
      if (dpadDown) dY += 1;
      state.aimX = dX;
      state.aimY = dY;
    }

    // Save buttons for next frame edge detection
    this.prevGamepadButtons[slot] = [
      btnJump,
      btnParry,
      btnAttack,
      gp.buttons[3]?.pressed ?? false,
      gp.buttons[4]?.pressed ?? false,
      gp.buttons[5]?.pressed ?? false,
      gp.buttons[6]?.pressed ?? false,
      gp.buttons[7]?.pressed ?? false
    ];
  }

  public endFrame(): void {
    this.keysJustPressed.clear();
    this.keysJustReleased.clear();
    this.mouseJustPressed = false;
    this.mouseJustReleased = false;
  }
}
