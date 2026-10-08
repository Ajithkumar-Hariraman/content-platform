import { cacheKey, type CacheDomain } from './keys.js';
import { metrics, type Metrics } from '../metrics/registry.js';
export interface CacheStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSeconds: number): Promise<void>;
}
export interface CacheVersions {
  current(domain: CacheDomain): Promise<string>;
}
export class PublicCache {
  private lastErrorLog = 0;
  constructor(
    private readonly store: CacheStore,
    private readonly versions: CacheVersions,
    private readonly ttlSeconds = 60,
    private readonly instrumentation: Metrics = metrics,
  ) {}
  private failure(operation: string) {
    this.instrumentation.increment('cache_error_total');
    if (Date.now() - this.lastErrorLog > 10000) {
      this.lastErrorLog = Date.now();
      console.warn(
        JSON.stringify({ level: 'warn', event: 'cache_failure', operation }),
      );
    }
  }
  async read<T>(
    domain: CacheDomain,
    kind: 'list' | 'id' | 'slug',
    identity: string,
    load: () => Promise<T>,
  ): Promise<T> {
    let version: string;
    try {
      version = await this.versions.current(domain);
    } catch {
      this.failure('version');
      return load();
    }
    const key = cacheKey(domain, version, kind, identity);
    const start = performance.now();
    try {
      const value = await this.store.get(key);
      if (value !== null) {
        const parsed: unknown = JSON.parse(value);
        if (!parsed || typeof parsed !== 'object')
          throw new Error('Invalid cache value');
        this.instrumentation.increment('cache_hit_total');
        return parsed as T;
      }
    } catch {
      this.failure('get');
    } finally {
      this.instrumentation.observe(
        'cache_get_duration_ms',
        performance.now() - start,
      );
    }
    this.instrumentation.increment('cache_miss_total');
    const result = await load();
    const writeStart = performance.now();
    try {
      if ((await this.versions.current(domain)) === version)
        await this.store.set(key, JSON.stringify(result), this.ttlSeconds);
    } catch {
      this.failure('set');
    } finally {
      this.instrumentation.observe(
        'cache_set_duration_ms',
        performance.now() - writeStart,
      );
    }
    return result;
  }
}
