import { APP_CONFIG } from '../config';
import type { TwinScene } from '../rendering/twin-scene';
import type { InputProvider } from './types';

export class PointerInput implements InputProvider {
  readonly source = 'pointer';
  #dragging = false;
  #lastX = 0;
  #lastY = 0;
  #pointerId?: number;
  #started = false;
  readonly #surface: HTMLCanvasElement;

  constructor(private readonly scene: TwinScene) {
    this.#surface = scene.renderer.domElement;
    this.start();
  }

  start(): void {
    if (this.#started) return;
    this.#started = true;
    this.#surface.addEventListener('pointerdown', this.onPointerDown);
    this.#surface.addEventListener('pointermove', this.onPointerMove);
    this.#surface.addEventListener('pointerup', this.onPointerUp);
    this.#surface.addEventListener('pointercancel', this.onPointerUp);
    this.#surface.addEventListener('lostpointercapture', this.onLostPointerCapture);
    this.#surface.addEventListener('wheel', this.onWheel, { passive: false });
  }

  stop(): void {
    if (!this.#started) return;
    this.#started = false;
    this.#dragging = false;
    this.#pointerId = undefined;
    this.#surface.removeEventListener('pointerdown', this.onPointerDown);
    this.#surface.removeEventListener('pointermove', this.onPointerMove);
    this.#surface.removeEventListener('pointerup', this.onPointerUp);
    this.#surface.removeEventListener('pointercancel', this.onPointerUp);
    this.#surface.removeEventListener('lostpointercapture', this.onLostPointerCapture);
    this.#surface.removeEventListener('wheel', this.onWheel);
  }

  private onPointerDown = (event: PointerEvent): void => {
    if (!event.isPrimary || (event.pointerType === 'mouse' && event.button !== 0)) return;
    this.#dragging = true;
    this.#pointerId = event.pointerId;
    this.#lastX = event.clientX;
    this.#lastY = event.clientY;
    this.scene.renderer.domElement.setPointerCapture(event.pointerId);
  };

  private onPointerMove = (event: PointerEvent): void => {
    if (!this.#dragging || event.pointerId !== this.#pointerId) return;
    const dx = event.clientX - this.#lastX;
    const dy = event.clientY - this.#lastY;
    if (event.shiftKey) this.scene.rotate(dx * APP_CONFIG.interaction.rotationGain);
    else {
      this.scene.translate(
        dx * APP_CONFIG.interaction.translationGain,
        -dy * APP_CONFIG.interaction.translationGain,
        0,
      );
    }
    this.#lastX = event.clientX;
    this.#lastY = event.clientY;
  };

  private onPointerUp = (event: PointerEvent): void => {
    if (event.pointerId !== this.#pointerId) return;
    this.#dragging = false;
    if (this.#surface.hasPointerCapture(event.pointerId)) {
      this.#surface.releasePointerCapture(event.pointerId);
    }
    this.#pointerId = undefined;
  };

  private onLostPointerCapture = (event: PointerEvent): void => {
    if (event.pointerId !== this.#pointerId) return;
    this.#dragging = false;
    this.#pointerId = undefined;
  };

  private onWheel = (event: WheelEvent): void => {
    event.preventDefault();
    if (event.ctrlKey) this.scene.scale(Math.exp(-event.deltaY * 0.001));
    else this.scene.translate(0, 0, event.deltaY * APP_CONFIG.interaction.depthGain);
  };
}
