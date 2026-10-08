import type { Pool } from 'pg';
import type { CacheDomain } from './keys.js';
export class PostgresCacheVersions {
  constructor(private readonly pool: Pick<Pool, 'query'>) {}
  async current(domain: CacheDomain): Promise<string> {
    const result = await this.pool.query<{ generation: string }>(
      'SELECT generation::text FROM public_cache_versions WHERE domain = $1',
      [domain],
    );
    const generation = result.rows[0]?.generation;
    if (!generation || !/^\d+$/.test(generation))
      throw new Error('Cache generation unavailable');
    return generation;
  }
}
