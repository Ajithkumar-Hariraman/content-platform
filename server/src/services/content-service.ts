import type { PublicCache } from '../cache/public-cache.js';
import { contentListIdentity } from '../cache/keys.js';
import { AppError } from '../errors/app-error.js';
import { PersistenceError } from '../repositories/persistence-error.js';
import type { ContentRepository } from '../repositories/content-repository.js';
import type {
  Content,
  ContentQuery,
  CreateContentInput,
  UpdateContentInput,
} from '../types/content.js';
import type { PaginatedResult } from '../types/catalog.js';
type Repository = Pick<
  ContentRepository,
  | 'findAdminList'
  | 'findPublicList'
  | 'findById'
  | 'findPublishedBySlug'
  | 'create'
  | 'update'
  | 'publish'
  | 'archive'
  | 'delete'
>;
export class ContentService {
  constructor(
    private readonly repository: Repository,
    private readonly cache?: PublicCache,
  ) {}
  private require(content: Content | null): Content {
    if (!content)
      throw new AppError(404, 'CONTENT_NOT_FOUND', 'Content not found');
    return content;
  }
  private async write(operation: () => Promise<Content | null>) {
    try {
      return this.require(await operation());
    } catch (error) {
      if (error instanceof PersistenceError && error.kind === 'duplicate-slug')
        throw new AppError(
          409,
          'DUPLICATE_SLUG',
          'Content slug already exists',
        );
      throw error;
    }
  }
  async list(
    query: ContentQuery,
    publicOnly = false,
  ): Promise<PaginatedResult<Content>> {
    if (publicOnly && this.cache)
      return this.cache.read(
        'CONTENT',
        'list',
        contentListIdentity(query),
        () => this.uncachedList(query, true),
      );
    return this.uncachedList(query, publicOnly);
  }
  private async uncachedList(
    query: ContentQuery,
    publicOnly: boolean,
  ): Promise<PaginatedResult<Content>> {
    const result = await (publicOnly
      ? this.repository.findPublicList(query)
      : this.repository.findAdminList(query));
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
  async findById(id: string) {
    return this.require(await this.repository.findById(id));
  }
  async findPublishedBySlug(slug: string) {
    const load = async () =>
      this.require(await this.repository.findPublishedBySlug(slug));
    return this.cache ? this.cache.read('CONTENT', 'slug', slug, load) : load();
  }
  create(input: CreateContentInput) {
    return this.write(() => this.repository.create(input));
  }
  update(id: string, input: UpdateContentInput) {
    return this.write(() => this.repository.update(id, input));
  }
  async publish(id: string) {
    const content = await this.findById(id);
    if (content.status === 'ARCHIVED')
      throw new AppError(
        409,
        'INVALID_TRANSITION',
        'Archived content cannot be published',
      );
    const published = await this.repository.publish(id);
    if (!published) {
      await this.findById(id);
      throw new AppError(
        409,
        'INVALID_TRANSITION',
        'Content is no longer publishable',
      );
    }
    return published;
  }
  async archive(id: string) {
    await this.findById(id);
    return this.require(await this.repository.archive(id));
  }
  async delete(id: string) {
    if (!(await this.repository.delete(id))) this.require(null);
  }
}
