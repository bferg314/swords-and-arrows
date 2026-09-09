export class GameLoop {
  private lastTime: number = 0;
  private accumulator: number = 0;
  private readonly fixedDt: number = 1 / 60; // 60 Hz physics
  private isRunning: boolean = false;
  private rafId: number = 0;

  private onUpdate: (dt: number) => void;
  private onRender: () => void;

  constructor(onUpdate: (dt: number) => void, onRender: () => void) {
    this.onUpdate = onUpdate;
    this.onRender = onRender;
  }

  public start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.lastTime = performance.now();
    this.accumulator = 0;
    this.rafId = requestAnimationFrame(this.tick);
  }

  public stop(): void {
    this.isRunning = false;
    cancelAnimationFrame(this.rafId);
  }

  private tick = (currentTime: number): void => {
    if (!this.isRunning) return;

    let frameTime = (currentTime - this.lastTime) / 1000;
    if (frameTime > 0.1) frameTime = 0.1; // Clamp spiral of death
    this.lastTime = currentTime;

    this.accumulator += frameTime;

    while (this.accumulator >= this.fixedDt) {
      this.onUpdate(this.fixedDt);
      this.accumulator -= this.fixedDt;
    }

    this.onRender();
    this.rafId = requestAnimationFrame(this.tick);
  };
}
