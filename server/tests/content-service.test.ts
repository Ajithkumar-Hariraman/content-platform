import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AppError } from '../src/errors/app-error.js';
import { PersistenceError } from '../src/repositories/persistence-error.js';
import { contentFixture, id, input, query } from './content-fixtures.js';
const status = (code: number) => (error: unknown) =>
  error instanceof AppError && error.statusCode === code;
test('create and update maintain draft state and allow clearing summary', async () => {
  const { service } = contentFixture();
  assert.equal((await service.create(input)).status, 'DRAFT');
  const updated = await service.update(id, { title: 'Updated', summary: null });
  assert.equal(updated.title, 'Updated');
  assert.equal(updated.summary, null);
  assert.equal(updated.publishedAt, null);
});
test('publish is idempotent; archive removes public visibility and cannot be republished', async () => {
  const { service } = contentFixture();
  await service.create(input);
  assert.deepEqual((await service.list(query, true)).data, []);
  await assert.rejects(service.findPublishedBySlug(input.slug), status(404));
  const published = await service.publish(id);
  assert.equal(published.status, 'PUBLISHED');
  assert.ok(published.publishedAt);
  assert.deepEqual(await service.publish(id), published);
  assert.equal((await service.list(query, true)).data.length, 1);
  assert.equal((await service.findPublishedBySlug(input.slug)).id, id);
  assert.equal((await service.archive(id)).status, 'ARCHIVED');
  assert.deepEqual((await service.list(query, true)).data, []);
  await assert.rejects(service.findPublishedBySlug(input.slug), status(404));
  await assert.rejects(service.publish(id), status(409));
  await service.update(id, { title: 'Archived edit' });
  await assert.rejects(service.publish(id), status(409));
});
test('missing content produces 404 for every item operation', async () => {
  const { service } = contentFixture();
  for (const operation of [
    () => service.findById(id),
    () => service.update(id, { title: 'New' }),
    () => service.publish(id),
    () => service.archive(id),
    () => service.delete(id),
  ])
    await assert.rejects(operation(), status(404));
});
test('slug conflicts are translated and unexpected persistence failures propagate', async () => {
  const { repository, service } = contentFixture();
  repository.create = async () => {
    throw new PersistenceError('duplicate-slug');
  };
  await assert.rejects(service.create(input), status(409));
  const failure = new Error('connection reset');
  repository.create = async () => {
    throw failure;
  };
  await assert.rejects(service.create(input), (error) => error === failure);
});
test('concurrent archive or deletion during publish cannot publish archived content', async () => {
  const { repository, service } = contentFixture();
  await service.create(input);
  repository.publish = async () => {
    await repository.archive(id);
    return null;
  };
  await assert.rejects(service.publish(id), status(409));
  repository.publish = async () => {
    await repository.delete(id);
    return null;
  };
  await service.delete(id);
  await service.create(input);
  await assert.rejects(service.publish(id), status(404));
});
