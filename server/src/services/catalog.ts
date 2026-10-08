import type { PublicCache } from '../cache/public-cache.js';
import type { Pool } from 'pg';
import { ProductRepository } from '../repositories/product-repository.js';
import { CategoryRepository } from '../repositories/category-repository.js';
import { ProductService } from './product-service.js';
import { CategoryService } from './category-service.js';

export interface CatalogServices {
  products: ProductService;
  categories: CategoryService;
}
export function createCatalog(
  pool: Pool,
  cache?: PublicCache,
): CatalogServices {
  const categories = new CategoryRepository(pool);
  return {
    products: new ProductService(
      new ProductRepository(pool),
      categories,
      cache,
    ),
    categories: new CategoryService(categories),
  };
}
