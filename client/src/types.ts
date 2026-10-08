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
  sort?: 'createdAt' | 'name' | 'price';
  order?: 'asc' | 'desc';
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

export type ContentStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
export interface Content {
  id: string;
  title: string;
  slug: string;
  summary: string | null;
  body: string;
  status: ContentStatus;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}
export interface CreateContentInput {
  title: string;
  slug: string;
  summary?: string | null;
  body: string;
}
export type UpdateContentInput = Partial<CreateContentInput>;
export interface ContentQuery {
  page: number;
  limit: number;
  search?: string;
  status?: ContentStatus;
  sort: 'createdAt' | 'publishedAt' | 'title';
  order: 'asc' | 'desc';
}

export type ActivityEntityType = 'PRODUCT' | 'CONTENT';
export type ActivityEventType =
  | 'PRODUCT_CREATED'
  | 'PRODUCT_UPDATED'
  | 'PRODUCT_DELETED'
  | 'CONTENT_CREATED'
  | 'CONTENT_UPDATED'
  | 'CONTENT_PUBLISHED'
  | 'CONTENT_ARCHIVED'
  | 'CONTENT_DELETED';
export interface ActivityEvent {
  id: string;
  eventType: ActivityEventType;
  entityType: ActivityEntityType;
  entityId: string;
  occurredAt: string;
  actor: { kind: 'SYSTEM' | 'ADMIN_PORTAL' } | { kind: 'USER'; id: string };
  data: {
    slug?: string;
    changedFields?: string[];
    status?: ProductStatus | ContentStatus;
  };
}
export interface ActivityPage {
  data: ActivityEvent[];
  nextCursor: string | null;
}
export interface ActivityQuery {
  limit: number;
  entityType?: ActivityEntityType;
  entityId?: string;
  cursor?: string;
}

export type Role = 'ADMIN' | 'EDITOR' | 'VIEWER';
export type Permission =
  | 'PRODUCT_READ'
  | 'PRODUCT_WRITE'
  | 'PRODUCT_DELETE'
  | 'CONTENT_READ'
  | 'CONTENT_WRITE'
  | 'CONTENT_PUBLISH'
  | 'CONTENT_DELETE'
  | 'ACTIVITY_READ'
  | 'USER_READ'
  | 'USER_WRITE';
export interface AuthUser {
  id: string;
  email: string;
  role: Role;
  status: 'ACTIVE' | 'DISABLED';
  createdAt: string;
  updatedAt: string;
}
export interface AuthSession {
  user: AuthUser;
  permissions: Permission[];
  csrfToken: string;
}
