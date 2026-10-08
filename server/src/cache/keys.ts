import { createHash } from 'node:crypto';
import type { ProductQuery } from '../types/catalog.js';
import type { ContentQuery } from '../types/content.js';
export type CacheDomain = 'PRODUCT' | 'CONTENT';
export function cacheKey(
  domain: CacheDomain,
  version: string,
  kind: 'list' | 'id' | 'slug',
  identity: string,
) {
  return `cloudops:v1:${domain.toLowerCase()}:${version}:${kind}:${createHash('sha256').update(identity).digest('hex')}`;
}
export function productListIdentity(query: ProductQuery) {
  return JSON.stringify([
    query.page,
    query.limit,
    query.sort,
    query.order,
    query.search?.trim() ?? '',
    query.categoryId?.toLowerCase() ?? '',
    query.status ?? '',
  ]);
}
export function contentListIdentity(query: ContentQuery) {
  return JSON.stringify([
    query.page,
    query.limit,
    query.sort,
    query.order,
    query.search?.trim() ?? '',
  ]);
}
