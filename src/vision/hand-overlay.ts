import type { TrackingFrame } from './types';

const CONNECTIONS: ReadonlyArray<readonly [number, number]> = [
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 4],
  [0, 5],
  [5, 6],
  [6, 7],
  [7, 8],
  [5, 9],
  [9, 10],
  [10, 11],
  [11, 12],
  [9, 13],
  [13, 14],
  [14, 15],
  [15, 16],
  [13, 17],
  [17, 18],
  [18, 19],
  [19, 20],
  [0, 17],
];

export class HandOverlay {
  readonly #context: CanvasRenderingContext2D;

  constructor(private readonly canvas: HTMLCanvasElement) {
    const context = canvas.getContext('2d');
    if (!context) throw new Error('2D canvas is unavailable');
    this.#context = context;
  }

  draw(frame: TrackingFrame): void {
    this.resize();
    const { width, height } = this.canvas;
    this.#context.clearRect(0, 0, width, height);
    for (const hand of frame.hands) {
      const color = hand.handedness === 'Left' ? '#ffb84d' : '#37e6f4';
      this.#context.strokeStyle = color;
      this.#context.lineWidth = Math.max(1.5, width / 360);
      this.#context.globalAlpha = 0.72;
      for (const [from, to] of CONNECTIONS) {
        const a = hand.landmarks[from];
        const b = hand.landmarks[to];
        if (!a || !b) continue;
        this.#context.beginPath();
        this.#context.moveTo(a.x * width, a.y * height);
        this.#context.lineTo(b.x * width, b.y * height);
        this.#context.stroke();
      }
      for (const [index, point] of hand.landmarks.entries()) {
        this.#context.fillStyle = index === 4 || index === 8 ? '#f2feff' : color;
        this.#context.globalAlpha = index === 4 || index === 8 ? 0.95 : 0.7;
        this.#context.beginPath();
        this.#context.arc(
          point.x * width,
          point.y * height,
          index === 4 || index === 8 ? 3.4 : 2.2,
          0,
          Math.PI * 2,
        );
        this.#context.fill();
      }
    }
    this.#context.globalAlpha = 1;
  }

  clear(): void {
    this.#context.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  private resize(): void {
    const width = Math.max(Math.round(this.canvas.clientWidth * Math.min(devicePixelRatio, 2)), 1);
    const height = Math.max(
      Math.round(this.canvas.clientHeight * Math.min(devicePixelRatio, 2)),
      1,
    );
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
    }
  }
}
