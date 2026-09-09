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
  }

  public setSingleHumanMatch(isSingle: boolean): void {
    this.isSingleHumanMatch = isSingle;
  }

  public setPrimaryGamepadIndex(index: number | null): void {
    this.primaryGamepadIndex = index;
    if (index !== null) {
      this.assignedGamepads.set(0, index);
    }
  }

  public bindPlayerGamepad(slot: PlayerSlot, gpIndex: number): void {
    this.assignedGamepads.set(slot, gpIndex);
  }

  public resetMatchInput(): void {
    this.virtualInputs = [null, null, null, null];
    this.prevGamepadButtons = [[], [], [], []];
    this.keysJustPressed.clear();
    this.keysJustReleased.clear();

    // Preserve primaryGamepadIndex and slot 0 assignment, but clear other slots
    // so new human players can be cleanly bound without stale mappings
    const p1Index = this.primaryGamepadIndex;
    this.assignedGamepads.clear();
    if (p1Index !== null) {
      this.assignedGamepads.set(0, p1Index);
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

    // 1. Single-human match (Human vs Bots):
    // In a solo match, Player 1 should be controllable by the primary gamepad OR ANY actively used controller!
    if (this.isSingleHumanMatch && slot === 0) {
      // Check if any controller has active button presses or stick movement this frame
      for (const gp of validGamepads) {
        const hasButton = gp.buttons.some(b => b && b.pressed);
        const hasStick = Math.hypot(gp.axes[0] || 0, gp.axes[1] || 0) > 0.35;
        if (hasButton || hasStick) {
          this.primaryGamepadIndex = gp.index;
          this.assignedGamepads.set(0, gp.index);
          return gp;
        }
      }

      // If no gamepad currently has active input this frame, return primary controller if still connected
      if (this.primaryGamepadIndex !== null) {
        const primary = validGamepads.find(g => g.index === this.primaryGamepadIndex);
        if (primary) return primary;
      }

      // Default to the first valid gamepad
      return validGamepads[0];
    }

    // 2. Multi-human couch co-op / PvP match:
    // Check if slot has an explicitly assigned gamepad that is still connected
    const assignedIndex = this.assignedGamepads.get(slot);
    if (assignedIndex !== undefined) {
      const found = validGamepads.find(g => g.index === assignedIndex);
      if (found) return found;
    }

    // Slot 0 defaults to primaryGamepadIndex if available
    if (slot === 0 && this.primaryGamepadIndex !== null) {
      const primary = validGamepads.find(g => g.index === this.primaryGamepadIndex);
      if (primary) {
        this.assignedGamepads.set(0, primary.index);
        return primary;
      }
    }

    // Resolve unassigned controllers without collision
    const usedIndices = new Set<number>();
    for (const [otherSlot, gpIdx] of this.assignedGamepads.entries()) {
      if (otherSlot !== slot) {
        usedIndices.add(gpIdx);
      }
    }

    const available = validGamepads.filter(g => !usedIndices.has(g.index));
    if (available.length > 0) {
      // Check if any available controller is actively pressing something
      for (const gp of available) {
        const hasButton = gp.buttons.some(b => b && b.pressed);
        const hasStick = Math.hypot(gp.axes[0] || 0, gp.axes[1] || 0) > 0.35;
        if (hasButton || hasStick) {
          this.assignedGamepads.set(slot, gp.index);
          return gp;
        }
      }

      // Otherwise take the first available
      this.assignedGamepads.set(slot, available[0].index);
      return available[0];
    }

    // Fallback
    return validGamepads[slot] || validGamepads[0] || null;
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

    // Analog stick aim
    if (Math.hypot(stickX, stickY) > deadzone) {
      state.aimX = stickX;
      state.aimY = stickY;
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
  }
}
