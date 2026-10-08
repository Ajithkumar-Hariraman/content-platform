import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { readEventConfig } from '../src/config/events.js';
import { activityEvent } from '../src/events/activity-event.js';
test(
  'DynamoDB Local stores one event across duplicate delivery and reads entity activity',
  { skip: !process.env.TEST_DYNAMODB_ENDPOINT },
  async () => {
    const [
      { DeleteCommand },
      { createActivityDatabase },
      { ActivityRepository },
    ] = await Promise.all([
      import('@aws-sdk/lib-dynamodb'),
      import('../src/dynamodb/client.js'),
      import('../src/repositories/activity-repository.js'),
    ]);
    const config = readEventConfig({
      ...process.env,
      NODE_ENV: 'test',
      DYNAMODB_ENDPOINT: process.env.TEST_DYNAMODB_ENDPOINT,
      DYNAMODB_ACTIVITY_TABLE:
        process.env.TEST_DYNAMODB_ACTIVITY_TABLE ?? 'activity_events_test',
    });
    const database = createActivityDatabase(config);
    const repository = new ActivityRepository(
      database.documentClient,
      config.table,
    );
    const event = activityEvent('CONTENT_CREATED', 'CONTENT', randomUUID());
    try {
      await repository.put(event);
      await repository.put(event);
      const result = await repository.findRecent({
        limit: 10,
        entityType: event.entityType,
        entityId: event.entityId,
      });
      assert.deepEqual(result.data, [event]);
    } finally {
      try {
        await database.documentClient.send(
          new DeleteCommand({
            TableName: config.table,
            Key: {
              pk: `ENTITY#${event.entityType}#${event.entityId}`,
              sk: `${event.occurredAt}#${event.id}`,
            },
          }),
        );
      } finally {
        database.close();
      }
    }
  },
);
