export interface InputProvider {
  readonly source: string;
  start(): void;
  stop(): void;
}
