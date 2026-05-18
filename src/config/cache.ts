type Entry<T> = { value: T; expiresAt: number };

export class TtlCache {
  private store = new Map<string, Entry<unknown>>();

  constructor(private defaultTtlMs: number = 60_000) {}

  get<T>(key: string): T | undefined {
    const e = this.store.get(key) as Entry<T> | undefined;
    if (!e) return undefined;
    if (e.expiresAt <= Date.now()) {
      this.store.delete(key);
      return undefined;
    }
    return e.value;
  }

  set<T>(key: string, value: T, ttlMs?: number): void {
    const ttl = ttlMs ?? this.defaultTtlMs;
    this.store.set(key, { value, expiresAt: Date.now() + ttl });
  }

  delete(key: string): void {
    this.store.delete(key);
  }

  invalidatePrefix(prefix: string): number {
    let count = 0;
    for (const k of this.store.keys()) {
      if (k.startsWith(prefix)) {
        this.store.delete(k);
        count++;
      }
    }
    return count;
  }

  clear(): void {
    this.store.clear();
  }

  size(): number {
    return this.store.size;
  }

  async wrap<T>(key: string, ttlMs: number | undefined, loader: () => Promise<T>): Promise<T> {
    const hit = this.get<T>(key);
    if (hit !== undefined) return hit;
    const value = await loader();
    this.set(key, value, ttlMs);
    return value;
  }
}

export const cache = new TtlCache();

export const CACHE_KEYS = {
  playersListPrefix: 'players:list:',
  playerByIdPrefix: 'players:byId:',
  rankingPrefix: 'quote:ranking:',
};

export const TTL = {
  playersList: 60_000,
  playerById: 60_000,
  ranking: 30_000,
};
