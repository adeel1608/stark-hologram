export interface SafeStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export function browserStorage(): SafeStorage | undefined {
  try {
    return globalThis.localStorage;
  } catch {
    return undefined;
  }
}

export function readStoredJson(storage: SafeStorage | undefined, key: string): unknown {
  if (!storage) return undefined;
  try {
    const serialized = storage.getItem(key);
    return serialized === null ? undefined : (JSON.parse(serialized) as unknown);
  } catch {
    return undefined;
  }
}

export function writeStoredJson(
  storage: SafeStorage | undefined,
  key: string,
  value: unknown,
): void {
  try {
    storage?.setItem(key, JSON.stringify(value));
  } catch {
    // Storage can be unavailable in private or policy-restricted contexts. Preferences are optional.
  }
}

export function removeStoredValue(storage: SafeStorage | undefined, key: string): void {
  try {
    storage?.removeItem(key);
  } catch {
    // A failed preference reset must not break the application.
  }
}
