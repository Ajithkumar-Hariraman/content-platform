import type { PublicCache } from '../cache/public-cache.js';
import { productListIdentity } from '../cache/keys.js';
import { AppError } from '../errors/app-error.js';
import { PersistenceError } from '../repositories/persistence-error.js';
import type { ProductRepository } from '../repositories/product-repository.js';
import type { CategoryRepository } from '../repositories/category-repository.js';
import type {
  CreateProductInput,
  UpdateProductInput,
  ProductQuery,
  PaginatedResult,
  Product,
} from '../types/catalog.js';

function translateWriteError(error: unknown): never {
  if (error instanceof PersistenceError) {
    if (error.kind === 'duplicate-slug')
      throw new AppError(
        409,
        'DUPLICATE_SLUG',
        'A product with this slug already exists',
      );
    throw new AppError(
      400,
      'INVALID_CATEGORY',
      'The selected category does not exist',
    );
  }
  throw error;
}

export class ProductService {
  constructor(
    private readonly products: Pick<
      ProductRepository,
      'findAll' | 'findById' | 'create' | 'update' | 'delete'
    >,
    private readonly categories: Pick<CategoryRepository, 'findById'>,
    private readonly cache?: PublicCache,
  ) {}
  async findAll(query: ProductQuery): Promise<PaginatedResult<Product>> {
    const result = await this.products.findAll(query);
    return {
      data: result.data,
      pagination: {
        page: query.page,
        limit: query.limit,
        total: result.total,
        totalPages: Math.ceil(result.total / query.limit),
      },
    };
  }
  async findById(id: string): Promise<Product> {
    const product = await this.products.findById(id);
    if (!product)
      throw new AppError(404, 'PRODUCT_NOT_FOUND', 'Product not found');
    return product;
  }
  publicList(query: ProductQuery) {
    return this.cache
      ? this.cache.read('PRODUCT', 'list', productListIdentity(query), () =>
          this.findAll(query),
        )
      : this.findAll(query);
  }
  publicDetail(id: string) {
    return this.cache
      ? this.cache.read('PRODUCT', 'id', id.toLowerCase(), () =>
          this.findById(id),
        )
      : this.findById(id);
  }
  private async requireCategory(id: string): Promise<void> {
    if (!(await this.categories.findById(id)))
      throw new AppError(
        400,
        'INVALID_CATEGORY',
        'The selected category does not exist',
      );
  }
  async create(input: CreateProductInput): Promise<Product> {
    await this.requireCategory(input.categoryId);
    try {
      return await this.products.create(input);
    } catch (error) {
      translateWriteError(error);
    }
  }
  async update(id: string, input: UpdateProductInput): Promise<Product> {
    await this.findById(id);
    if (input.categoryId !== undefined)
      await this.requireCategory(input.categoryId);
    try {
      const product = await this.products.update(id, input);
      if (!product)
        throw new AppError(404, 'PRODUCT_NOT_FOUND', 'Product not found');
      return product;
    } catch (error) {
      translateWriteError(error);
    }
  }
  async delete(id: string): Promise<void> {
    if (!(await this.products.delete(id)))
      throw new AppError(404, 'PRODUCT_NOT_FOUND', 'Product not found');
  }
}
