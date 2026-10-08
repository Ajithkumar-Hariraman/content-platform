import { withOutbox } from '../database/outbox-transaction.js';
import { activityEvent } from '../events/activity-event.js';
import type { Pool, PoolClient } from 'pg';
import type {
  Content,
  ContentQuery,
  CreateContentInput,
  UpdateContentInput,
} from '../types/content.js';
import { rethrowDatabaseError } from './persistence-error.js';
interface Row {
  id: string;
  title: string;
  slug: string;
  summary: string | null;
  body: string;
  status: Content['status'];
  published_at: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
}
export const contentColumns =
  'id, title, slug, summary, body, status, published_at, created_at, updated_at';
const sorts = {
  createdAt: 'created_at',
  publishedAt: 'published_at',
  title: 'title',
} as const;
function map(row: Row): Content {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    summary: row.summary,
    body: row.body,
    status: row.status,
    publishedAt: row.published_at
      ? new Date(row.published_at).toISOString()
      : null,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}
export function contentListQuery(query: ContentQuery, publicOnly: boolean) {
  const values: unknown[] = [];
  const where: string[] = [];
  if (publicOnly) where.push("status = 'PUBLISHED'");
  else if (query.status) {
    values.push(query.status);
    where.push(`status = $${values.length}`);
  }
  if (query.search) {
    values.push(`%${query.search.replace(/[\\%_]/g, '\\$&')}%`);
    where.push(
      `(title ILIKE $${values.length} OR summary ILIKE $${values.length})`,
    );
  }
  values.push(query.limit, (query.page - 1) * query.limit);
  const sort = sorts[query.sort];
  const order = query.order === 'asc' ? 'ASC' : 'DESC';
  return {
    text: `WITH filtered AS (SELECT ${contentColumns} FROM contents ${where.length ? 'WHERE ' + where.join(' AND ') : ''}), page AS (SELECT ${contentColumns}, ${sort} AS sort_value FROM filtered ORDER BY ${sort} ${order} NULLS LAST, id ASC LIMIT $${values.length - 1} OFFSET $${values.length}) SELECT (SELECT count(*)::text FROM filtered) AS total, COALESCE((SELECT jsonb_agg(to_jsonb(page) - 'sort_value' ORDER BY sort_value ${order} NULLS LAST, id ASC) FROM page), '[]'::jsonb) AS items`,
    values,
  };
}

export class ContentRepository {
  constructor(private readonly pool: Pool) {}
  private async list(
    query: ContentQuery,
    publicOnly: boolean,
  ): Promise<{ data: Content[]; total: number }> {
    const statement = contentListQuery(query, publicOnly);
    const result = await this.pool.query<{ total: string; items: Row[] }>(
      statement.text,
      statement.values,
    );
    const row = result.rows[0];
    if (!row) throw new Error('Content list returned no result');
    return { data: row.items.map(map), total: Number(row.total) };
  }
  findAdminList(query: ContentQuery) {
    return this.list(query, false);
  }
  findPublicList(query: ContentQuery) {
    return this.list(query, true);
  }
  private async one(
    sql: string,
    values: unknown[],
    connection: Pick<PoolClient, 'query'> = this.pool,
  ): Promise<Content | null> {
    const result = await connection.query<Row>(sql, values);
    return result.rows[0] ? map(result.rows[0]) : null;
  }
  findById(id: string) {
    return this.one(`SELECT ${contentColumns} FROM contents WHERE id=$1`, [id]);
  }
  findPublishedBySlug(slug: string) {
    return this.one(
      `SELECT ${contentColumns} FROM contents WHERE slug=$1 AND status='PUBLISHED'`,
      [slug],
    );
  }
  async create(input: CreateContentInput): Promise<Content> {
    try {
      return await withOutbox(this.pool, async (client) => {
        const content = await this.one(
          `INSERT INTO contents (title,slug,summary,body) VALUES ($1,$2,$3,$4) RETURNING ${contentColumns}`,
          [input.title, input.slug, input.summary ?? null, input.body],
          client,
        );
        if (!content) throw new Error('Content insert returned no result');
        return {
          result: content,
          event: activityEvent('CONTENT_CREATED', 'CONTENT', content.id, {
            slug: content.slug,
            status: content.status,
          }),
        };
      });
    } catch (error) {
      rethrowDatabaseError(error);
    }
  }
  async update(id: string, input: UpdateContentInput) {
    const values: unknown[] = [id];
    const assignments: string[] = [];
    for (const key of ['title', 'slug', 'summary', 'body'] as const)
      if (input[key] !== undefined) {
        values.push(input[key]);
        assignments.push(`${key}=$${values.length}`);
      }
    if (!assignments.length) throw new Error('Content update requires a field');
    try {
      return await withOutbox(this.pool, async (client) => {
        const content = await this.one(
          `UPDATE contents SET ${assignments.join(',')}, updated_at=clock_timestamp() WHERE id=$1 RETURNING ${contentColumns}`,
          values,
          client,
        );
        return {
          result: content,
          event: content
            ? activityEvent('CONTENT_UPDATED', 'CONTENT', content.id, {
                changedFields: Object.keys(input),
                status: content.status,
              })
            : null,
        };
      });
    } catch (error) {
      rethrowDatabaseError(error);
    }
  }
  publish(id: string) {
    return withOutbox(this.pool, async (client) => {
      const before = await this.one(
        `SELECT ${contentColumns} FROM contents WHERE id=$1 FOR UPDATE`,
        [id],
        client,
      );
      if (!before || before.status === 'ARCHIVED')
        return { result: null, event: null };
      if (before.status === 'PUBLISHED') return { result: before, event: null };
      const content = await this.one(
        `UPDATE contents SET status='PUBLISHED',published_at=COALESCE(published_at,clock_timestamp()),updated_at=clock_timestamp() WHERE id=$1 AND status IN ('DRAFT','PUBLISHED') RETURNING ${contentColumns}`,
        [id],
        client,
      );
      return {
        result: content,
        event: content
          ? activityEvent('CONTENT_PUBLISHED', 'CONTENT', id, {
              status: content.status,
            })
          : null,
      };
    });
  }
  archive(id: string) {
    return withOutbox(this.pool, async (client) => {
      const before = await this.one(
        `SELECT ${contentColumns} FROM contents WHERE id=$1 FOR UPDATE`,
        [id],
        client,
      );
      if (!before) return { result: null, event: null };
      if (before.status === 'ARCHIVED') return { result: before, event: null };
      const content = await this.one(
        `UPDATE contents SET status='ARCHIVED',updated_at=clock_timestamp() WHERE id=$1 RETURNING ${contentColumns}`,
        [id],
        client,
      );
      return {
        result: content,
        event: content
          ? activityEvent('CONTENT_ARCHIVED', 'CONTENT', id, {
              status: content.status,
            })
          : null,
      };
    });
  }
  async delete(id: string) {
    return withOutbox(this.pool, async (client) => {
      const result = await client.query(
        'DELETE FROM contents WHERE id=$1 RETURNING id',
        [id],
      );
      const deleted = result.rows.length > 0;
      return {
        result: deleted,
        event: deleted ? activityEvent('CONTENT_DELETED', 'CONTENT', id) : null,
      };
    });
  }
}
