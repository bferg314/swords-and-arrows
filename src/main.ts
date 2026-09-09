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
  new UIManager(game);

  // Start fixed-timestep game loop
  const loop = new GameLoop(
    (dt) => game.update(dt),
    () => game.render()
  );
  loop.start();

  console.log('⚔️ Swords & Arrows: Engine Initialized Successfully! 🏹');
});
