import type {
  Content,
  ContentQuery,
  CreateContentInput,
} from '../src/types/content.js';
import { ContentService } from '../src/services/content-service.js';
import type { ContentRepository } from '../src/repositories/content-repository.js';
export const id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1';
export const input: CreateContentInput = {
  title: 'API Reliability',
  slug: 'api-reliability',
  body: 'Dependable services',
  summary: null,
};
export const query: ContentQuery = {
  page: 1,
  limit: 10,
  sort: 'publishedAt',
  order: 'desc',
};
export function contentFixture() {
  let current: Content | null = null;
  const repository: ConstructorParameters<typeof ContentService>[0] = {
    async create(data) {
      current = {
        ...data,
        summary: data.summary ?? null,
        id,
        status: 'DRAFT',
        publishedAt: null,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      };
      return current;
    },
    async findById() {
      return current;
    },
    async findPublishedBySlug(slug) {
      return current?.status === 'PUBLISHED' && current.slug === slug
        ? current
        : null;
    },
    async findAdminList() {
      return { data: current ? [current] : [], total: current ? 1 : 0 };
    },
    async findPublicList() {
      const data = current?.status === 'PUBLISHED' ? [current] : [];
      return { data, total: data.length };
    },
    async update(_id, patch) {
      if (!current) return null;
      current = { ...current, ...patch };
      return current;
    },
    async publish() {
      if (!current || current.status === 'ARCHIVED') return null;
      if (current.status === 'DRAFT')
        current = {
          ...current,
          status: 'PUBLISHED',
          publishedAt: '2026-01-02T00:00:00.000Z',
        };
      return current;
    },
    async archive() {
      if (!current) return null;
      current = { ...current, status: 'ARCHIVED' };
      return current;
    },
    async delete() {
      const existed = current !== null;
      current = null;
      return existed;
    },
  } satisfies Pick<
    ContentRepository,
    | 'create'
    | 'findById'
    | 'findPublishedBySlug'
    | 'findAdminList'
    | 'findPublicList'
    | 'update'
    | 'publish'
    | 'archive'
    | 'delete'
  >;
  return { repository, service: new ContentService(repository) };
}
