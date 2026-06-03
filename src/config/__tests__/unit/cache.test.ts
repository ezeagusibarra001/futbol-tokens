import { TtlCache } from '../../cache';

describe('TtlCache', () => {
  it('returns undefined for a missing key', () => {
    const c = new TtlCache();
    expect(c.get('x')).toBeUndefined();
  });

  it('returns the stored value before expiration', () => {
    const c = new TtlCache(1000);
    c.set('k', 42);
    expect(c.get<number>('k')).toBe(42);
  });

  it('expires entries after the TTL elapses', () => {
    const c = new TtlCache(10);
    c.set('k', 'v');
    jest.useFakeTimers();
    try {
      jest.setSystemTime(Date.now() + 100);
      expect(c.get('k')).toBeUndefined();
    } finally {
      jest.useRealTimers();
    }
  });

  it('invalidatePrefix removes only matching keys', () => {
    const c = new TtlCache();
    c.set('players:list:a', 1);
    c.set('players:list:b', 2);
    c.set('players:byId:1', 3);
    const removed = c.invalidatePrefix('players:list:');
    expect(removed).toBe(2);
    expect(c.get('players:list:a')).toBeUndefined();
    expect(c.get('players:byId:1')).toBe(3);
  });

  it('wrap caches loader result and skips loader on second call', async () => {
    const c = new TtlCache(1000);
    const loader = jest.fn().mockResolvedValue('value');
    const a = await c.wrap('k', undefined, loader);
    const b = await c.wrap('k', undefined, loader);
    expect(a).toBe('value');
    expect(b).toBe('value');
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it('wrap re-fetches after expiration', async () => {
    const c = new TtlCache(10);
    const loader = jest.fn().mockResolvedValue('v');
    await c.wrap('k', undefined, loader);
    jest.useFakeTimers();
    try {
      jest.setSystemTime(Date.now() + 100);
      await c.wrap('k', undefined, loader);
    } finally {
      jest.useRealTimers();
    }
    expect(loader).toHaveBeenCalledTimes(2);
  });
});
