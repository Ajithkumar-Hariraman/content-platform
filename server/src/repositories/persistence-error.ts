export class PersistenceError extends Error {
  constructor(public readonly kind: 'duplicate-slug' | 'missing-category') {
    super(kind);
    this.name = 'PersistenceError';
  }
}

export function rethrowDatabaseError(error: unknown): never {
  if (
    error &&
    typeof error === 'object' &&
    'code' in error &&
    'constraint' in error
  ) {
    if (
      error.code === '23505' &&
      (error.constraint === 'products_slug_key' ||
        error.constraint === 'contents_slug_key')
    )
      throw new PersistenceError('duplicate-slug');
    if (
      error.code === '23503' &&
      error.constraint === 'products_category_id_fkey'
    )
      throw new PersistenceError('missing-category');
  }
  throw error;
}
