import { withOutbox } from '../database/outbox-transaction.js';
import { activityEvent } from '../events/activity-event.js';
import type { Pool } from 'pg';
import type {
  CreateProductInput,
  UpdateProductInput,
  Product,
  ProductQuery,
} from '../types/catalog.js';
import { rethrowDatabaseError } from './persistence-error.js';

interface ProductRow {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  price: string;
  status: Product['status'];
  category_id: string;
  category_name: string;
  category_slug: string;
  created_at: Date | string;
  updated_at: Date | string;
}
const columns = `p.id, p.name, p.slug, p.description, p.price::text AS price, p.status,
  p.category_id, p.created_at, p.updated_at, c.name AS category_name, c.slug AS category_slug`;
const returnedColumns =
  'id, name, slug, description, price, status, category_id, created_at, updated_at';
const sortColumns = {
  createdAt: 'created_at',
  name: 'name',
  price: 'price_value',
} as const;
function mapProduct(row: ProductRow): Product {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    price: row.price,
    status: row.status,
    categoryId: row.category_id,
    category: {
      id: row.category_id,
      name: row.category_name,
      slug: row.category_slug,
    },
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

export function productListQuery(query: ProductQuery) {
  const values: unknown[] = [];
  const predicates: string[] = [];
  if (query.search) {
    values.push(`%${query.search.replace(/[\\%_]/g, '\\$&')}%`);
    predicates.push(
      `(p.name ILIKE $${values.length} OR p.description ILIKE $${values.length})`,
    );
  }
  if (query.categoryId) {
    values.push(query.categoryId);
    predicates.push(`p.category_id = $${values.length}`);
  }
  if (query.status) {
    values.push(query.status);
    predicates.push(`p.status = $${values.length}`);
  }
  const where = predicates.length ? `WHERE ${predicates.join(' AND ')}` : '';
  values.push(query.limit, (query.page - 1) * query.limit);
  const sort = sortColumns[query.sort];
  const order = query.order === 'asc' ? 'ASC' : 'DESC';
  return {
    text: `
      WITH filtered AS (
        SELECT ${columns}, p.price AS price_value
        FROM products p JOIN categories c ON c.id = p.category_id
        ${where}
      ), page AS (
        SELECT id, name, slug, description, price, status, category_id,
          created_at, updated_at, category_name, category_slug, ${sort} AS sort_value
        FROM filtered
        ORDER BY ${sort} ${order}, id ASC
        LIMIT $${values.length - 1} OFFSET $${values.length}
      )
      SELECT (SELECT count(*)::text FROM filtered) AS total,
        COALESCE((SELECT jsonb_agg(to_jsonb(page) - 'sort_value' ORDER BY sort_value ${order}, id ASC) FROM page), '[]'::jsonb) AS items
    `,
    values,
  };
}

export class ProductRepository {
  constructor(private readonly pool: Pool) {}
  async findAll(
    query: ProductQuery,
  ): Promise<{ data: Product[]; total: number }> {
    const statement = productListQuery(query);
    const result = await this.pool.query<{
      total: string;
      items: ProductRow[];
    }>(statement.text, statement.values);
    const row = result.rows[0];
    if (!row) throw new Error('Product list query returned no result');
    return { data: row.items.map(mapProduct), total: Number(row.total) };
  }

  async findById(id: string): Promise<Product | null> {
    const result = await this.pool.query<ProductRow>(
      `SELECT ${columns} FROM products p JOIN categories c ON c.id = p.category_id WHERE p.id = $1`,
      [id],
    );
    return result.rows[0] ? mapProduct(result.rows[0]) : null;
  }

  async create(input: CreateProductInput): Promise<Product> {
    try {
      return await withOutbox(this.pool, async (client) => {
        const result = await client.query<ProductRow>(
          `
        WITH inserted AS (
          INSERT INTO products (name, slug, description, price, status, category_id)
          VALUES ($1, $2, $3, $4, $5, $6) RETURNING ${returnedColumns}
        )
        SELECT ${columns} FROM inserted p JOIN categories c ON c.id = p.category_id
      `,
          [
            input.name,
            input.slug,
            input.description ?? null,
            input.price,
            input.status,
            input.categoryId,
          ],
        );
        if (!result.rows[0])
          throw new Error('Product insert returned no result');
        const product = mapProduct(result.rows[0]);
        return {
          result: product,
          event: activityEvent('PRODUCT_CREATED', 'PRODUCT', product.id, {
            slug: product.slug,
            status: product.status,
          }),
        };
      });
    } catch (error) {
      rethrowDatabaseError(error);
    }
  }

  async update(id: string, input: UpdateProductInput): Promise<Product | null> {
    const values: unknown[] = [id];
    const assignments: string[] = [];
    const fields = {
      name: 'name',
      slug: 'slug',
      description: 'description',
      price: 'price',
      status: 'status',
      categoryId: 'category_id',
    } as const;
    for (const key of Object.keys(fields) as (keyof typeof fields)[]) {
      if (input[key] !== undefined) {
        values.push(input[key]);
        assignments.push(`${fields[key]} = $${values.length}`);
      }
    }
    if (!assignments.length)
      throw new Error('Product update requires at least one field');
    try {
      return await withOutbox(this.pool, async (client) => {
        const result = await client.query<ProductRow>(
          `
        WITH updated AS (
          UPDATE products SET ${assignments.join(', ')}, updated_at = clock_timestamp()
          WHERE id = $1 RETURNING ${returnedColumns}
        )
        SELECT ${columns} FROM updated p JOIN categories c ON c.id = p.category_id
      `,
          values,
        );
        const product = result.rows[0] ? mapProduct(result.rows[0]) : null;
        return {
          result: product,
          event: product
            ? activityEvent('PRODUCT_UPDATED', 'PRODUCT', product.id, {
                changedFields: Object.keys(input),
                status: product.status,
              })
            : null,
        };
      });
    } catch (error) {
      rethrowDatabaseError(error);
    }
  }

  async delete(id: string): Promise<boolean> {
    return withOutbox(this.pool, async (client) => {
      const result = await client.query<{ id: string }>(
        'DELETE FROM products WHERE id = $1 RETURNING id',
        [id],
      );
      const deleted = result.rows.length > 0;
      return {
        result: deleted,
        event: deleted ? activityEvent('PRODUCT_DELETED', 'PRODUCT', id) : null,
      };
    });
  }
}
