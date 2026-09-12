import { APP_CONFIG } from '../config';
import {
  browserStorage,
  readStoredJson,
  type SafeStorage,
  writeStoredJson,
} from '../storage/safe-storage';
import type { CameraOption, CameraProvider, CameraSettings, CameraState } from './types';

const STORAGE_KEY = 'spatial-hmi.camera.v1';

const DEFAULT_SETTINGS: CameraSettings = {
  width: APP_CONFIG.camera.defaultWidth,
  height: APP_CONFIG.camera.defaultHeight,
  frameRate: APP_CONFIG.camera.defaultFrameRate,
  mirror: true,
};

export interface CameraMediaDevices {
  getUserMedia?: (constraints?: MediaStreamConstraints) => Promise<MediaStream>;
  enumerateDevices?: () => Promise<MediaDeviceInfo[]>;
  addEventListener?: MediaDevices['addEventListener'];
  removeEventListener?: MediaDevices['removeEventListener'];
}

export interface CameraManagerDependencies {
  mediaDevices?: CameraMediaDevices;
  storage?: SafeStorage;
}

function finiteWithin(value: unknown, minimum: number, maximum: number, fallback: number): number {
  const numeric = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(numeric) && numeric >= minimum && numeric <= maximum ? numeric : fallback;
}

export function normalizeCameraSettings(value: unknown): CameraSettings {
  if (!value || typeof value !== 'object') return { ...DEFAULT_SETTINGS };
  const candidate = value as Record<string, unknown>;
  const deviceId =
    typeof candidate.deviceId === 'string' && candidate.deviceId.length <= 1024
      ? candidate.deviceId || undefined
      : undefined;
  return {
    deviceId,
    width: finiteWithin(candidate.width, 160, 7680, DEFAULT_SETTINGS.width),
    height: finiteWithin(candidate.height, 120, 4320, DEFAULT_SETTINGS.height),
    frameRate: finiteWithin(candidate.frameRate, 1, 120, DEFAULT_SETTINGS.frameRate),
    mirror: typeof candidate.mirror === 'boolean' ? candidate.mirror : DEFAULT_SETTINGS.mirror,
  };
}

export function cameraError(error: unknown): CameraState {
  const name = error instanceof DOMException ? error.name : 'CameraError';
  const messages: Record<string, string> = {
    NotAllowedError:
      'Camera access was denied. You can continue in demo mode or enable access in browser settings.',
    NotFoundError:
      'No browser-supported camera was found. Connect a camera or continue in demo mode.',
    NotReadableError:
      'The selected camera is busy or unavailable. Close other camera apps and try again.',
    OverconstrainedError:
      'The selected resolution is unavailable for this camera. Choose another resolution.',
    SecurityError: 'Camera access requires a secure context such as localhost or HTTPS.',
  };
  return {
    status: 'error',
    code: name,
    message: messages[name] ?? 'The camera could not be started.',
  };
}

export class CameraManager extends EventTarget implements CameraProvider {
  #stream?: MediaStream;
  #state: CameraState = { status: 'idle' };
  #settings: CameraSettings;
  #operation = 0;
  #disposed = false;
  readonly #mediaDevices?: CameraMediaDevices;
  readonly #storage?: SafeStorage;

  constructor(
    private readonly video: HTMLVideoElement,
    dependencies?: CameraManagerDependencies,
  ) {
    super();
    this.#mediaDevices =
      dependencies && 'mediaDevices' in dependencies
        ? dependencies.mediaDevices
        : globalThis.navigator?.mediaDevices;
    this.#storage =
      dependencies && 'storage' in dependencies ? dependencies.storage : browserStorage();
    this.#settings = CameraManager.loadSettings(this.#storage);
    this.#mediaDevices?.addEventListener?.('devicechange', this.handleDeviceChange);
  }

  get settings(): CameraSettings {
    return { ...this.#settings };
  }

  static loadSettings(storage: SafeStorage | undefined = browserStorage()): CameraSettings {
    return normalizeCameraSettings(readStoredJson(storage, STORAGE_KEY));
  }

  async enumerate(): Promise<CameraOption[]> {
    if (!this.#mediaDevices?.enumerateDevices) return [];
    const devices = await this.#mediaDevices.enumerateDevices();
    let cameraNumber = 0;
    return devices
      .filter((device) => device.kind === 'videoinput')
      .map((device) => {
        cameraNumber += 1;
        return { deviceId: device.deviceId, label: device.label || `Camera ${cameraNumber}` };
      });
  }

  async start(settings: CameraSettings = this.#settings): Promise<MediaStream> {
    if (this.#disposed) throw new Error('Camera manager has been disposed');
    if (!this.#mediaDevices?.getUserMedia) {
      const state: CameraState = {
        status: 'error',
        code: 'UnsupportedError',
        message:
          'This browser does not expose the standard camera API. Use a current browser or demo mode.',
      };
      this.setState(state);
      throw new Error(state.message);
    }

    const operation = ++this.#operation;
    this.releaseActiveStream();
    this.setState({ status: 'requesting' });
    const normalized = normalizeCameraSettings(settings);
    let stream: MediaStream | undefined;
    try {
      stream = await this.requestStream(normalized);
      this.assertCurrent(operation, stream);
      const track = stream.getVideoTracks()[0];
      if (!track) throw new Error('Camera stream contains no video track');
      this.video.srcObject = stream;
      await this.video.play();
      this.assertCurrent(operation, stream);
      this.#stream = stream;
      const activeStream = stream;
      track.addEventListener('ended', () => this.handleTrackEnded(activeStream), { once: true });
      const actual = track.getSettings();
      this.#settings = {
        ...normalized,
        deviceId: actual.deviceId || normalized.deviceId,
        width: actual.width ?? normalized.width,
        height: actual.height ?? normalized.height,
        frameRate: actual.frameRate ?? normalized.frameRate,
      };
      writeStoredJson(this.#storage, STORAGE_KEY, this.#settings);
      this.video.classList.toggle('mirrored', this.#settings.mirror);
      let options: CameraOption[] = [];
      try {
        options = await this.enumerate();
      } catch {
        // Enumeration is optional after capture starts; track settings and label remain authoritative.
      }
      this.assertCurrent(operation, stream);
      const option = options.find((candidate) => candidate.deviceId === actual.deviceId);
      this.setState({
        status: 'active',
        label: option?.label ?? track.label ?? 'Browser camera',
        width: actual.width ?? normalized.width,
        height: actual.height ?? normalized.height,
        frameRate: actual.frameRate,
      });
      return stream;
    } catch (error) {
      this.releaseStream(stream);
      if (this.video.srcObject === stream) this.video.srcObject = null;
      if (operation !== this.#operation) throw error;
      const state = cameraError(error);
      this.setState(state);
      throw error;
    }
  }

  stop(): void {
    this.#operation += 1;
    this.releaseActiveStream();
    this.setState({ status: 'idle' });
  }

  getState(): CameraState {
    return this.#state;
  }

  setMirror(mirror: boolean): void {
    this.#settings.mirror = mirror;
    this.video.classList.toggle('mirrored', mirror);
    writeStoredJson(this.#storage, STORAGE_KEY, this.#settings);
  }

  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    this.stop();
    this.#mediaDevices?.removeEventListener?.('devicechange', this.handleDeviceChange);
  }

  private setState(state: CameraState): void {
    this.#state = state;
    this.dispatchEvent(new CustomEvent<CameraState>('statechange', { detail: state }));
  }

  private handleTrackEnded(stream: MediaStream): void {
    if (this.#stream !== stream) return;
    this.#stream = undefined;
    this.video.srcObject = null;
    this.setState({
      status: 'error',
      code: 'DisconnectedError',
      message: 'The active camera disconnected. Choose another source or continue in demo mode.',
    });
  }

  private handleDeviceChange = (): void => {
    this.dispatchEvent(new Event('deviceschange'));
  };

  private async requestStream(settings: CameraSettings): Promise<MediaStream> {
    const mediaDevices = this.#mediaDevices;
    if (!mediaDevices?.getUserMedia) throw new Error('Camera API is unavailable');
    const preferred: MediaStreamConstraints = {
      audio: false,
      video: {
        deviceId: settings.deviceId ? { exact: settings.deviceId } : undefined,
        width: { ideal: settings.width },
        height: { ideal: settings.height },
        frameRate: { ideal: settings.frameRate, max: Math.min(settings.frameRate, 60) },
      },
    };
    try {
      return await mediaDevices.getUserMedia(preferred);
    } catch (error) {
      if (!(error instanceof DOMException) || error.name !== 'OverconstrainedError') throw error;
      return mediaDevices.getUserMedia({
        audio: false,
        video: { deviceId: settings.deviceId ? { exact: settings.deviceId } : undefined },
      });
    }
  }

  private assertCurrent(operation: number, stream: MediaStream): void {
    if (operation === this.#operation && !this.#disposed) return;
    this.releaseStream(stream);
    throw new DOMException('Camera start was superseded by a newer request', 'AbortError');
  }

  private releaseActiveStream(): void {
    const stream = this.#stream;
    this.#stream = undefined;
    this.releaseStream(stream);
    this.video.srcObject = null;
  }

  private releaseStream(stream: MediaStream | undefined): void {
    if (!stream) return;
    for (const track of stream.getTracks()) track.stop();
  }
}
