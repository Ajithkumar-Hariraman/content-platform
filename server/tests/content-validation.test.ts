import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AppError } from '../src/errors/app-error.js';
import {
  parseContentId,
  parseContentSlug,
  parseContentQuery,
  parseCreateContent,
  parseUpdateContent,
} from '../src/validation/content.js';
import { input, id } from './content-fixtures.js';
const invalid = (error: unknown) =>
  error instanceof AppError && error.statusCode === 400;
test('content validation rejects bad slugs, IDs, lifecycle fields and empty updates', () => {
  for (const slug of ['UPPER', 'bad_slug', '-bad', 'bad--slug', ''])
    assert.throws(() => parseContentSlug(slug), invalid);
  assert.equal(parseContentId(id), id);
  assert.throws(() => parseContentId('invalid'), invalid);
  assert.throws(
    () => parseCreateContent({ ...input, status: 'PUBLISHED' }),
    invalid,
  );
  assert.throws(() => parseUpdateContent({ status: 'DRAFT' }), invalid);
  assert.throws(() => parseUpdateContent({}), invalid);
  assert.throws(() => parseCreateContent({ ...input, body: '  ' }), invalid);
  assert.deepEqual(parseCreateContent(input), input);
});
test('query validation limits pagination and sort; public queries cannot override visibility', () => {
  for (const value of [
    { status: 'ACTIVE' },
    { page: '0' },
    { page: '1.5' },
    { limit: '101' },
    { limit: ['1', '2'] },
    { sort: 'body' },
    { order: 'sideways' },
    { search: 'x'.repeat(201) },
  ])
    assert.throws(() => parseContentQuery(value), invalid);
  assert.throws(() => parseContentQuery({ status: 'DRAFT' }, true), invalid);
  assert.throws(() => parseContentQuery({ sort: 'createdAt' }, true), invalid);
  assert.equal(parseContentQuery({}, true).sort, 'publishedAt');
});
