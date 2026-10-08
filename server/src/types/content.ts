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
