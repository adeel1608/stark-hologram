import type { HandLandmarker, HandLandmarkerResult } from '@mediapipe/tasks-vision';
import { APP_CONFIG } from '../config';
import { LandmarkSmoother } from './landmark-smoother';
import type {
  Handedness,
  TrackingFrame,
  TrackingListener,
  TrackingMetrics,
  TrackedHand,
} from './types';

export class HandTracker extends EventTarget {
  readonly #smoother = new LandmarkSmoother({
    alpha: APP_CONFIG.vision.smoothingAlpha,
    maxJump: APP_CONFIG.vision.maxLandmarkJump,
  });
  #landmarker?: HandLandmarker;
  #initializing?: Promise<void>;
  #listener?: TrackingListener;
  #video?: HTMLVideoElement;
  #running = false;
  #operation = 0;
  #disposed = false;
  #requestId = 0;
  #lastVideoTime = -1;
  #metrics: TrackingMetrics = { inferenceMs: 0, trackingFps: 0, frameTimestamp: 0, handCount: 0 };
  #trackedFrames = 0;
  #fpsWindowStarted = performance.now();

  get metrics(): TrackingMetrics {
    return { ...this.#metrics };
  }

  async initialize(): Promise<void> {
    if (this.#disposed) throw new Error('Hand tracker has been disposed');
    if (this.#landmarker) return;
    if (this.#initializing) return this.#initializing;
    this.dispatchEvent(new CustomEvent('statechange', { detail: 'loading' }));
    this.#initializing = this.createLandmarker();
    try {
      await this.#initializing;
    } finally {
      this.#initializing = undefined;
    }
  }

  private async createLandmarker(): Promise<void> {
    try {
      const { FilesetResolver, HandLandmarker } = await import('@mediapipe/tasks-vision');
      const vision = await FilesetResolver.forVisionTasks(APP_CONFIG.vision.wasmUrl);
      let landmarker: HandLandmarker;
      try {
        landmarker = await HandLandmarker.createFromOptions(vision, {
          baseOptions: { modelAssetPath: APP_CONFIG.vision.modelUrl, delegate: 'GPU' },
          runningMode: 'VIDEO',
          numHands: APP_CONFIG.vision.maxHands,
          minHandDetectionConfidence: APP_CONFIG.vision.minDetectionConfidence,
          minHandPresenceConfidence: APP_CONFIG.vision.minPresenceConfidence,
          minTrackingConfidence: APP_CONFIG.vision.minTrackingConfidence,
        });
      } catch {
        landmarker = await HandLandmarker.createFromOptions(vision, {
          baseOptions: { modelAssetPath: APP_CONFIG.vision.modelUrl, delegate: 'CPU' },
          runningMode: 'VIDEO',
          numHands: APP_CONFIG.vision.maxHands,
          minHandDetectionConfidence: APP_CONFIG.vision.minDetectionConfidence,
          minHandPresenceConfidence: APP_CONFIG.vision.minPresenceConfidence,
          minTrackingConfidence: APP_CONFIG.vision.minTrackingConfidence,
        });
      }
      if (this.#disposed) {
        landmarker.close();
        throw new Error('Hand tracker was disposed during initialization');
      }
      this.#landmarker = landmarker;
    } catch {
      this.dispatchEvent(new CustomEvent('statechange', { detail: 'error' }));
      throw new Error('Hand tracker assets could not be initialized');
    }
    this.dispatchEvent(new CustomEvent('statechange', { detail: 'ready' }));
  }

  async start(video: HTMLVideoElement, listener: TrackingListener): Promise<void> {
    const operation = ++this.#operation;
    await this.initialize();
    if (operation !== this.#operation || this.#disposed) {
      throw new DOMException('Hand tracker start was superseded', 'AbortError');
    }
    this.stopLoop();
    this.#video = video;
    this.#listener = listener;
    this.#running = true;
    this.#lastVideoTime = -1;
    this.schedule();
  }

  stop(): void {
    this.#operation += 1;
    this.stopLoop();
  }

  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    this.stop();
    this.#landmarker?.close();
    this.#landmarker = undefined;
  }

  private schedule(): void {
    if (!this.#running) return;
    this.#requestId = requestAnimationFrame(this.processFrame);
  }

  private processFrame = (): void => {
    if (!this.#running || !this.#video || !this.#landmarker) return;
    if (
      this.#video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA &&
      this.#video.currentTime !== this.#lastVideoTime
    ) {
      const timestamp = performance.now();
      const inferenceStarted = performance.now();
      let result: HandLandmarkerResult;
      try {
        result = this.#landmarker.detectForVideo(this.#video, timestamp);
      } catch {
        this.#running = false;
        this.dispatchEvent(new CustomEvent('statechange', { detail: 'error' }));
        return;
      }
      const inferenceMs = performance.now() - inferenceStarted;
      this.#lastVideoTime = this.#video.currentTime;
      const hands = this.#smoother.process(this.convertResult(result));
      this.#trackedFrames += 1;
      const elapsed = timestamp - this.#fpsWindowStarted;
      if (elapsed >= 1000) {
        this.#metrics.trackingFps = (this.#trackedFrames * 1000) / elapsed;
        this.#trackedFrames = 0;
        this.#fpsWindowStarted = timestamp;
      }
      this.#metrics = {
        ...this.#metrics,
        inferenceMs,
        frameTimestamp: timestamp,
        handCount: hands.length,
      };
      const frame: TrackingFrame = { timestamp, hands, inferenceMs, source: 'camera' };
      this.#listener?.(frame);
    }
    this.schedule();
  };

  private stopLoop(): void {
    this.#running = false;
    if (this.#requestId) cancelAnimationFrame(this.#requestId);
    this.#requestId = 0;
    this.#listener = undefined;
    this.#video = undefined;
    this.#lastVideoTime = -1;
    this.#trackedFrames = 0;
    this.#fpsWindowStarted = performance.now();
    this.#smoother.reset();
  }

  private convertResult(result: HandLandmarkerResult): TrackedHand[] {
    return result.landmarks.map((landmarks, index) => {
      const category = result.handedness[index]?.[0];
      const name = category?.categoryName ?? category?.displayName ?? 'Unknown';
      const handedness: Handedness = name === 'Left' || name === 'Right' ? name : 'Unknown';
      return {
        handedness,
        handednessScore: category?.score,
        landmarks: landmarks.map((point) => ({
          x: point.x,
          y: point.y,
          z: point.z,
          visibility: point.visibility,
        })),
        worldLandmarks: result.worldLandmarks[index]?.map((point) => ({
          x: point.x,
          y: point.y,
          z: point.z,
          visibility: point.visibility,
        })),
      };
    });
  }
}
