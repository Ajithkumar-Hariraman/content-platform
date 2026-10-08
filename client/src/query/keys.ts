import type { ActivityQuery, ContentQuery, ProductQuery } from '../types.js';
function productFilters(query: ProductQuery) {
  return {
    page: query.page,
    limit: query.limit,
    sort: query.sort ?? 'createdAt',
    order: query.order ?? 'desc',
    search: query.search?.trim() ?? '',
    categoryId: query.categoryId?.toLowerCase() ?? '',
    status: query.status ?? '',
  };
}
function contentFilters(query: ContentQuery, admin: boolean) {
  return {
    page: query.page,
    limit: query.limit,
    sort: query.sort,
    order: query.order,
    search: query.search?.trim() ?? '',
    status: admin ? (query.status ?? '') : '',
  };
}
export const queryKeys = {
  products: (filters: ProductQuery) =>
    ['products', 'list', productFilters(filters)] as const,
  product: (id: string) => ['products', 'detail', id.toLowerCase()] as const,
  categories: () => ['categories'] as const,
  content: (filters: ContentQuery, userId?: string) =>
    userId
      ? (['admin', userId, 'content', contentFilters(filters, true)] as const)
      : (['content', 'list', contentFilters(filters, false)] as const),
  contentDetail: (slug: string) => ['content', 'detail', slug] as const,
  activity: (userId: string, filters: ActivityQuery) =>
    [
      'admin',
      userId,
      'activity',
      {
        limit: filters.limit,
        entityType: filters.entityType ?? '',
        entityId: filters.entityId?.toLowerCase() ?? '',
        cursor: filters.cursor ?? '',
      },
    ] as const,
  users: (userId: string, page: number) =>
    ['admin', userId, 'users', { page, limit: 20 }] as const,
};
export function matchesDomain(
  key: readonly unknown[],
  domain: 'products' | 'content' | 'users',
) {
  return (
    key[0] === domain ||
    (key[0] === 'admin' && (key[2] === domain || key[2] === 'activity'))
  );
}
