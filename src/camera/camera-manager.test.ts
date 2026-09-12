import { describe, expect, it, vi } from 'vitest';
import { CameraManager, normalizeCameraSettings, type CameraMediaDevices } from './camera-manager';
import type { CameraSettings } from './types';

interface FakeTrack {
  stop: ReturnType<typeof vi.fn>;
  end(): void;
}

function fakeStream(label = 'Test camera'): { stream: MediaStream; track: FakeTrack } {
  let ended: (() => void) | undefined;
  const track: FakeTrack & {
    label: string;
    getSettings(): MediaTrackSettings;
    addEventListener(_name: string, listener: () => void): void;
  } = {
    label,
    stop: vi.fn(),
    end: () => ended?.(),
    getSettings: () => ({ deviceId: 'camera-1', width: 1280, height: 720, frameRate: 30 }),
    addEventListener: (_name, listener) => {
      ended = listener;
    },
  };
  const stream = {
    getVideoTracks: () => [track],
    getTracks: () => [track],
  } as unknown as MediaStream;
  return { stream, track };
}

function fakeVideo(): HTMLVideoElement {
  return {
    srcObject: null,
    play: vi.fn().mockResolvedValue(undefined),
    classList: { toggle: vi.fn() },
  } as unknown as HTMLVideoElement;
}

const settings: CameraSettings = {
  width: 1280,
  height: 720,
  frameRate: 30,
  mirror: true,
};

describe('CameraManager', () => {
  it('normalizes untrusted persisted settings', () => {
    expect(
      normalizeCameraSettings({
        width: -1,
        height: '720',
        frameRate: 1000,
        mirror: 'yes',
        deviceId: 42,
      }),
    ).toEqual({ width: 960, height: 720, frameRate: 30, mirror: true, deviceId: undefined });
  });

  it('lets the newest start win and stops the superseded stream', async () => {
    const first = fakeStream('First');
    const second = fakeStream('Second');
    let resolveFirst: ((stream: MediaStream) => void) | undefined;
    let resolveSecond: ((stream: MediaStream) => void) | undefined;
    const firstPromise = new Promise<MediaStream>((resolve) => {
      resolveFirst = resolve;
    });
    const secondPromise = new Promise<MediaStream>((resolve) => {
      resolveSecond = resolve;
    });
    const mediaDevices: CameraMediaDevices = {
      getUserMedia: vi.fn().mockReturnValueOnce(firstPromise).mockReturnValueOnce(secondPromise),
      enumerateDevices: vi.fn().mockResolvedValue([]),
    };
    const manager = new CameraManager(fakeVideo(), { mediaDevices });
    const oldStart = manager.start(settings).catch((error: unknown) => error);
    const newStart = manager.start(settings);
    resolveSecond?.(second.stream);
    await expect(newStart).resolves.toBe(second.stream);
    resolveFirst?.(first.stream);
    const oldError = await oldStart;
    expect(oldError).toBeInstanceOf(DOMException);
    expect((oldError as DOMException).name).toBe('AbortError');
    expect(first.track.stop).toHaveBeenCalled();
    expect(second.track.stop).not.toHaveBeenCalled();
    manager.dispose();
  });

  it('retries without preferred resolution after an overconstrained result', async () => {
    const fallback = fakeStream();
    const mediaDevices: CameraMediaDevices = {
      getUserMedia: vi
        .fn()
        .mockRejectedValueOnce(new DOMException('unsupported size', 'OverconstrainedError'))
        .mockResolvedValueOnce(fallback.stream),
      enumerateDevices: vi.fn().mockResolvedValue([]),
    };
    const manager = new CameraManager(fakeVideo(), { mediaDevices });
    await expect(manager.start(settings)).resolves.toBe(fallback.stream);
    expect(mediaDevices.getUserMedia).toHaveBeenCalledTimes(2);
    manager.dispose();
  });

  it('ignores an ended event from an obsolete stream', async () => {
    const first = fakeStream('First');
    const second = fakeStream('Second');
    const mediaDevices: CameraMediaDevices = {
      getUserMedia: vi
        .fn()
        .mockResolvedValueOnce(first.stream)
        .mockResolvedValueOnce(second.stream),
      enumerateDevices: vi.fn().mockResolvedValue([]),
    };
    const manager = new CameraManager(fakeVideo(), { mediaDevices });
    await manager.start(settings);
    await manager.start(settings);
    first.track.end();
    expect(manager.getState().status).toBe('active');
    second.track.end();
    expect(manager.getState()).toMatchObject({ status: 'error', code: 'DisconnectedError' });
    manager.dispose();
  });
});
