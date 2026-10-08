import { createHash } from 'node:crypto';
import { productListQuery } from '../repositories/product-repository.js';
import {
  contentListQuery,
  contentColumns,
} from '../repositories/content-repository.js';
const rawCategoryHash = createHash('md5')
  .update('cloudops-perf-category-1')
  .digest('hex');
const categoryHash = `${rawCategoryHash.slice(0, 12)}4${rawCategoryHash.slice(13, 16)}8${rawCategoryHash.slice(17)}`;
const categoryId = `${categoryHash.slice(0, 8)}-${categoryHash.slice(8, 12)}-${categoryHash.slice(12, 16)}-${categoryHash.slice(16, 20)}-${categoryHash.slice(20)}`;
const productQuery = {
  page: 1,
  limit: 20,
  sort: 'createdAt',
  order: 'desc',
} as const;
export const performanceQueries = {
  'product-list': productListQuery(productQuery),
  'product-search': productListQuery({
    ...productQuery,
    search: 'Performance',
  }),
  'product-category': productListQuery({
    ...productQuery,
    categoryId,
    status: 'ACTIVE',
  }),
  'public-content-list': contentListQuery(
    { page: 1, limit: 20, sort: 'publishedAt', order: 'desc' },
    true,
  ),
  'content-slug': {
    text: `SELECT ${contentColumns} FROM contents WHERE slug=$1 AND status='PUBLISHED'`,
    values: ['perf-content-1'],
  },
};
