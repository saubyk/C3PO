type Entry<T> = { value: T; expiresAt: number };

export type Cache = {
  get<T>(key: string): T | undefined;
  set<T>(key: string, value: T, ttlMs: number): void;
  delete(key: string): void;
  clear(): void;
};

export function createCache(): Cache {
  const store = new Map<string, Entry<unknown>>();
  return {
    get<T>(key: string): T | undefined {
      const e = store.get(key);
      if (!e) return undefined;
      if (Date.now() > e.expiresAt) {
        store.delete(key);
        return undefined;
      }
      return e.value as T;
    },
    set<T>(key: string, value: T, ttlMs: number): void {
      store.set(key, { value, expiresAt: Date.now() + ttlMs });
    },
    delete(key: string): void {
      store.delete(key);
    },
    clear(): void {
      store.clear();
    },
  };
}
