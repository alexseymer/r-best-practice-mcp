export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

export class CacheService {
  private cache = new Map<string, CacheEntry<any>>();
  private readonly defaultTTL = 60000; // 60 seconds

  set<T>(key: string, data: T, ttl: number = this.defaultTTL): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl,
    });
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key) as CacheEntry<T> | undefined;
    if (!entry) return null;

    const age = Date.now() - entry.timestamp;
    if (age > entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;

    const age = Date.now() - entry.timestamp;
    if (age > entry.ttl) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  clear(): void {
    this.cache.clear();
  }

  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  size(): number {
    return this.cache.size;
  }

  memoize<T extends (...args: any[]) => any>(fn: T, ttl?: number): T {
    return ((...args: any[]) => {
      const key = `${fn.name}:${JSON.stringify(args)}`;

      if (this.has(key)) {
        return this.get(key);
      }

      const result = fn(...args);
      this.set(key, result, ttl);
      return result;
    }) as T;
  }

  memoizeAsync<T extends (...args: any[]) => Promise<any>>(fn: T, ttl?: number): T {
    return (async (...args: any[]) => {
      const key = `${fn.name}:${JSON.stringify(args)}`;

      if (this.has(key)) {
        return this.get(key);
      }

      const result = await fn(...args);
      this.set(key, result, ttl);
      return result;
    }) as T;
  }
}

export const globalCache = new CacheService();
