import { APP_CONFIG } from '../config';
import type { CameraOption, CameraProvider, CameraSettings, CameraState } from './types';

const STORAGE_KEY = 'spatial-hmi.camera.v1';

const DEFAULT_SETTINGS: CameraSettings = {
  width: APP_CONFIG.camera.defaultWidth,
  height: APP_CONFIG.camera.defaultHeight,
  frameRate: APP_CONFIG.camera.defaultFrameRate,
  mirror: true,
};

function cameraError(error: unknown): CameraState {
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

  constructor(private readonly video: HTMLVideoElement) {
    super();
    this.#settings = CameraManager.loadSettings();
    navigator.mediaDevices?.addEventListener('devicechange', this.handleDeviceChange);
  }

  get settings(): CameraSettings {
    return { ...this.#settings };
  }

  static loadSettings(): CameraSettings {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return { ...DEFAULT_SETTINGS };
      const parsed = JSON.parse(stored) as Partial<CameraSettings>;
      return {
        ...DEFAULT_SETTINGS,
        ...parsed,
        width: Number(parsed.width) || DEFAULT_SETTINGS.width,
        height: Number(parsed.height) || DEFAULT_SETTINGS.height,
        frameRate: Number(parsed.frameRate) || DEFAULT_SETTINGS.frameRate,
      };
    } catch {
      return { ...DEFAULT_SETTINGS };
    }
  }

  async enumerate(): Promise<CameraOption[]> {
    if (!navigator.mediaDevices?.enumerateDevices) return [];
    const devices = await navigator.mediaDevices.enumerateDevices();
    let cameraNumber = 0;
    return devices
      .filter((device) => device.kind === 'videoinput')
      .map((device) => {
        cameraNumber += 1;
        return { deviceId: device.deviceId, label: device.label || `Camera ${cameraNumber}` };
      });
  }

  async start(settings: CameraSettings = this.#settings): Promise<MediaStream> {
    if (!navigator.mediaDevices?.getUserMedia) {
      const state: CameraState = {
        status: 'error',
        code: 'UnsupportedError',
        message:
          'This browser does not expose the standard camera API. Use a current browser or demo mode.',
      };
      this.setState(state);
      throw new Error(state.message);
    }

    this.stop();
    this.setState({ status: 'requesting' });
    try {
      const constraints: MediaStreamConstraints = {
        audio: false,
        video: {
          deviceId: settings.deviceId ? { exact: settings.deviceId } : undefined,
          width: { ideal: settings.width },
          height: { ideal: settings.height },
          frameRate: { ideal: settings.frameRate, max: 60 },
        },
      };
      this.#stream = await navigator.mediaDevices.getUserMedia(constraints);
      this.video.srcObject = this.#stream;
      await this.video.play();
      const track = this.#stream.getVideoTracks()[0];
      if (!track) throw new Error('Camera stream contains no video track');
      track.addEventListener('ended', this.handleTrackEnded, { once: true });
      const actual = track.getSettings();
      this.#settings = {
        ...settings,
        deviceId: actual.deviceId || settings.deviceId,
        width: actual.width ?? settings.width,
        height: actual.height ?? settings.height,
        frameRate: actual.frameRate ?? settings.frameRate,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.#settings));
      this.video.classList.toggle('mirrored', this.#settings.mirror);
      const options = await this.enumerate();
      const option = options.find((candidate) => candidate.deviceId === actual.deviceId);
      this.setState({
        status: 'active',
        label: option?.label ?? track.label ?? 'Browser camera',
        width: actual.width ?? settings.width,
        height: actual.height ?? settings.height,
        frameRate: actual.frameRate,
      });
      return this.#stream;
    } catch (error) {
      const state = cameraError(error);
      this.setState(state);
      throw error;
    }
  }

  stop(): void {
    if (this.#stream) {
      for (const track of this.#stream.getTracks()) track.stop();
      this.#stream = undefined;
    }
    this.video.srcObject = null;
    if (this.#state.status !== 'error') this.setState({ status: 'idle' });
  }

  getState(): CameraState {
    return this.#state;
  }

  setMirror(mirror: boolean): void {
    this.#settings.mirror = mirror;
    this.video.classList.toggle('mirrored', mirror);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.#settings));
  }

  dispose(): void {
    this.stop();
    navigator.mediaDevices?.removeEventListener('devicechange', this.handleDeviceChange);
  }

  private setState(state: CameraState): void {
    this.#state = state;
    this.dispatchEvent(new CustomEvent<CameraState>('statechange', { detail: state }));
  }

  private handleTrackEnded = (): void => {
    this.#stream = undefined;
    this.video.srcObject = null;
    this.setState({
      status: 'error',
      code: 'DisconnectedError',
      message: 'The active camera disconnected. Choose another source or continue in demo mode.',
    });
  };

  private handleDeviceChange = (): void => {
    this.dispatchEvent(new Event('deviceschange'));
  };
}
