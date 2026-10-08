import type { Pool } from 'pg';
import type { Category } from '../types/catalog.js';

interface CategoryRow {
  id: string;
  name: string;
  slug: string;
  created_at: Date;
  updated_at: Date;
}
const columns = 'id, name, slug, created_at, updated_at';
function mapCategory(row: CategoryRow): Category {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

export class CategoryRepository {
  constructor(private readonly pool: Pool) {}
  async findAll(): Promise<Category[]> {
    const result = await this.pool.query<CategoryRow>(
      `SELECT ${columns} FROM categories ORDER BY name ASC, id ASC`,
    );
    return result.rows.map(mapCategory);
  }
  async findById(id: string): Promise<Category | null> {
    const result = await this.pool.query<CategoryRow>(
      `SELECT ${columns} FROM categories WHERE id = $1`,
      [id],
    );
    return result.rows[0] ? mapCategory(result.rows[0]) : null;
  }
}
