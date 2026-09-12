export interface CameraOption {
  deviceId: string;
  label: string;
}

export interface CameraSettings {
  deviceId?: string;
  width: number;
  height: number;
  frameRate: number;
  mirror: boolean;
}

export type CameraState =
  | { status: 'idle' }
  | { status: 'requesting' }
  | { status: 'active'; label: string; width: number; height: number; frameRate?: number }
  | { status: 'error'; code: string; message: string };

export interface CameraProvider {
  enumerate(): Promise<CameraOption[]>;
  start(settings: CameraSettings): Promise<MediaStream>;
  stop(): void;
  getState(): CameraState;
}
