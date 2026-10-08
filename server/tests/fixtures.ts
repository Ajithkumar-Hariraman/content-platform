import { ProductService } from '../src/services/product-service.js';
import { CategoryService } from '../src/services/category-service.js';
import type {
  Product,
  Category,
  CreateProductInput,
} from '../src/types/catalog.js';
import type { ProductRepository } from '../src/repositories/product-repository.js';
import type { CategoryRepository } from '../src/repositories/category-repository.js';

export const category: Category = {
  id: '11111111-1111-4111-8111-111111111111',
  name: 'Electronics',
  slug: 'electronics',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};
export const input: CreateProductInput = {
  name: 'Headphones',
  slug: 'headphones',
  price: '129.99',
  status: 'ACTIVE',
  categoryId: category.id,
};
export const product: Product = {
  ...input,
  id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  description: null,
  category: { id: category.id, name: category.name, slug: category.slug },
  createdAt: category.createdAt,
  updatedAt: category.updatedAt,
};
export function fixtures() {
  const products: Pick<
    ProductRepository,
    'findAll' | 'findById' | 'create' | 'update' | 'delete'
  > = {
    async findAll() {
      return { data: [product], total: 5 };
    },
    async findById() {
      return product;
    },
    async create() {
      return product;
    },
    async update() {
      return { ...product, name: 'Updated headphones' };
    },
    async delete() {
      return true;
    },
  };
  const categories: Pick<CategoryRepository, 'findAll' | 'findById'> = {
    async findAll() {
      return [category];
    },
    async findById() {
      return category;
    },
  };
  return {
    products,
    categories,
    catalog: {
      products: new ProductService(products, categories),
      categories: new CategoryService(categories),
    },
  };
}
