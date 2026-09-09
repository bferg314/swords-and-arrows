export interface CameraTarget {
  x: number;
  y: number;
  isAlive: boolean;
}

export class Camera {
  public x: number = 640;
  public y: number = 360;
  public zoom: number = 1.0;
  public targetZoom: number = 1.0;
  public targetX: number = 640;
  public targetY: number = 360;

  private trauma: number = 0; // 0 to 1
  private shakeOffsetX: number = 0;
  private shakeOffsetY: number = 0;

  public readonly viewportWidth: number = 1280;
  public readonly viewportHeight: number = 720;

  public addTrauma(amount: number): void {
    this.trauma = Math.min(1.0, this.trauma + amount);
  }

  public update(dt: number, targets: CameraTarget[]): void {
    // Filter alive targets
    const alive = targets.filter(t => t.isAlive);
    if (alive.length > 0) {
      let minX = alive[0].x;
      let maxX = alive[0].x;
      let minY = alive[0].y;
      let maxY = alive[0].y;

      for (let i = 1; i < alive.length; i++) {
        const t = alive[i];
        if (t.x < minX) minX = t.x;
        if (t.x > maxX) maxX = t.x;
        if (t.y < minY) minY = t.y;
        if (t.y > maxY) maxY = t.y;
      }

      this.targetX = (minX + maxX) * 0.5;
      this.targetY = (minY + maxY) * 0.5 - 20;

      // Calculate span with margin
      const spanX = Math.max(380, maxX - minX + 320);
      const spanY = Math.max(260, maxY - minY + 260);

      const zoomX = this.viewportWidth / spanX;
      const zoomY = this.viewportHeight / spanY;
      this.targetZoom = Math.min(1.2, Math.max(0.72, Math.min(zoomX, zoomY)));
    } else {
      this.targetX = 640;
      this.targetY = 360;
      this.targetZoom = 1.0;
    }

    // Smooth lerp
    const lerpSpeed = 6.0 * dt;
    this.x += (this.targetX - this.x) * lerpSpeed;
    this.y += (this.targetY - this.y) * lerpSpeed;
    this.zoom += (this.targetZoom - this.zoom) * lerpSpeed;

    // Screen shake update
    if (this.trauma > 0) {
      const shakePower = this.trauma * this.trauma;
      const maxOffset = 22 * shakePower;
      this.shakeOffsetX = (Math.random() * 2 - 1) * maxOffset;
      this.shakeOffsetY = (Math.random() * 2 - 1) * maxOffset;

      this.trauma = Math.max(0, this.trauma - dt * 1.8);
    } else {
      this.shakeOffsetX = 0;
      this.shakeOffsetY = 0;
    }
  }

  public applyTransform(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    // Center at viewport origin
    ctx.translate(this.viewportWidth * 0.5, this.viewportHeight * 0.5);
    ctx.scale(this.zoom, this.zoom);
    ctx.translate(-this.x + this.shakeOffsetX, -this.y + this.shakeOffsetY);
  }

  public resetTransform(ctx: CanvasRenderingContext2D): void {
    ctx.restore();
  }

  public reset(): void {
    this.x = 640;
    this.y = 360;
    this.zoom = 1.0;
    this.trauma = 0;
    this.shakeOffsetX = 0;
    this.shakeOffsetY = 0;
  }
}
