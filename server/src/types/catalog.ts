export type ProductStatus = 'DRAFT' | 'ACTIVE' | 'INACTIVE';

export interface Category {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
  updatedAt: string;
}

export interface Product {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  price: string;
  status: ProductStatus;
  categoryId: string;
  category: Pick<Category, 'id' | 'name' | 'slug'>;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProductInput {
  name: string;
  slug: string;
  description?: string | null;
  price: string;
  status: ProductStatus;
  categoryId: string;
}

export type UpdateProductInput = Partial<CreateProductInput>;

export interface ProductQuery {
  page: number;
  limit: number;
  search?: string;
  categoryId?: string;
  status?: ProductStatus;
  sort: 'createdAt' | 'name' | 'price';
  order: 'asc' | 'desc';
}

export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
