export type AudioCue = 'select' | 'grab' | 'release' | 'mode' | 'reset' | 'warning';

const FREQUENCIES: Record<AudioCue, readonly [number, number]> = {
  select: [620, 760],
  grab: [410, 540],
  release: [540, 360],
  mode: [520, 910],
  reset: [760, 330],
  warning: [240, 180],
};

export class AudioManager {
  #context?: AudioContext;
  #muted = true;
  #volume = 0.24;

  get muted(): boolean {
    return this.#muted;
  }

  setMuted(value: boolean): void {
    this.#muted = value;
  }

  setVolume(value: number): void {
    this.#volume = Math.max(0, Math.min(1, value));
  }

  play(cue: AudioCue): void {
    if (this.#muted) return;
    this.#context ??= new AudioContext();
    const context = this.#context;
    const start = context.currentTime;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = cue === 'warning' ? 'sawtooth' : 'sine';
    oscillator.frequency.setValueAtTime(FREQUENCIES[cue][0], start);
    oscillator.frequency.exponentialRampToValueAtTime(FREQUENCIES[cue][1], start + 0.09);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(Math.max(this.#volume, 0.0001), start + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.12);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start(start);
    oscillator.stop(start + 0.13);
  }

  dispose(): void {
    const context = this.#context;
    this.#context = undefined;
    if (context && context.state !== 'closed') void context.close().catch(() => undefined);
  }
}
