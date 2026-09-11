import './style.css';
import { Game } from './core/Game';
import { GameLoop } from './core/GameLoop';
import { UIManager } from './ui/UIManager';

window.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
  if (!canvas) {
    console.error('Canvas element #game-canvas not found!');
    return;
  }

  // Handle high-DPI crisp rendering
  const dpr = window.devicePixelRatio || 1;
  const internalWidth = 1280;
  const internalHeight = 720;
  canvas.width = internalWidth * dpr;
  canvas.height = internalHeight * dpr;

  const ctx = canvas.getContext('2d')!;
  ctx.scale(dpr, dpr);

  // Initialize Game & Systems
  const game = new Game(canvas);
  (window as any).game = game;
  const uiManager = new UIManager(game);
  (window as any).uiManager = uiManager;

  // Start fixed-timestep game loop
  const loop = new GameLoop(
    (dt) => game.update(dt),
    () => game.render()
  );
  loop.start();

  // Support ?mockGamepads=N for controller testing in browser environments
  const urlParams = new URLSearchParams(window.location.search);
  const mockCountStr = urlParams.get('mockGamepads');
  if (mockCountStr !== null) {
    const count = parseInt(mockCountStr, 10) || 3;
    const makeGp = (index: number) => ({
      index,
      id: `Xbox 360 Controller #${index + 1} (STANDARD GAMEPAD)`,
      connected: true,
      buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })),
      axes: [0, 0, 0, 0]
    });
    const mockGps: any[] = [];
    for (let i = 0; i < count; i++) {
      mockGps.push(makeGp(i));
    }
    (navigator as any).getGamepads = () => mockGps;
    game.input.ensureHumanGamepadAssignments((uiManager as any).playerConfigs);
    uiManager.updateLobbyGamepadBadges();
    console.log(`[Dev] Mocked ${count} controllers via ?mockGamepads query parameter.`);
  }

  console.log('⚔️ Swords & Arrows: Engine Initialized Successfully! 🏹');
});
