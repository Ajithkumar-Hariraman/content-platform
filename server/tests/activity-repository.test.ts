import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  PutCommand,
  QueryCommand,
  type DynamoDBDocumentClient,
} from '@aws-sdk/lib-dynamodb';
import { ActivityRepository } from '../src/repositories/activity-repository.js';
import { activityEvent } from '../src/events/activity-event.js';
import { id } from './content-fixtures.js';
test('duplicate delivery uses one logical DynamoDB identity and treats conditional conflicts as success', async () => {
  const items = new Map<string, unknown>();
  let attempts = 0;
  const client = {
    async send(command: PutCommand) {
      attempts++;
      assert.match(
        command.input.ConditionExpression ?? '',
        /attribute_not_exists/,
      );
      const item = command.input.Item!;
      const key = `${item.pk}|${item.sk}`;
      if (items.has(key)) {
        const error = new Error('Exists');
        error.name = 'ConditionalCheckFailedException';
        throw error;
      }
      items.set(key, item);
      return {};
    },
  } as unknown as DynamoDBDocumentClient;
  const repository = new ActivityRepository(client, 'activity_events');
  const event = activityEvent('CONTENT_CREATED', 'CONTENT', id);
  await repository.put(event);
  await repository.put(event);
  assert.equal(items.size, 1);
  assert.equal(attempts, 2);
});
test('activity query uses entity key or recent GSI, maps events, and carries scoped pagination cursor', async () => {
  const event = activityEvent('PRODUCT_CREATED', 'PRODUCT', id);
  const key = {
    pk: `ENTITY#PRODUCT#${id}`,
    sk: `${event.occurredAt}#${event.id}`,
    gsiPk: 'RECENT',
    gsiSk: `${event.occurredAt}#${event.id}`,
  };
  const commands: QueryCommand[] = [];
  const client = {
    async send(command: QueryCommand) {
      commands.push(command);
      return {
        Items: [{ ...key, ...event }],
        LastEvaluatedKey: command.input.IndexName
          ? key
          : { pk: key.pk, sk: key.sk },
      };
    },
  } as unknown as DynamoDBDocumentClient;
  const repository = new ActivityRepository(client, 'activity_events');
  const global = await repository.findRecent({ limit: 20 });
  assert.deepEqual(global.data, [event]);
  assert.equal(commands[0]?.input.IndexName, 'recent_activity');
  assert.equal(commands[0]?.input.ScanIndexForward, false);
  await repository.findRecent({ limit: 20, cursor: global.nextCursor! });
  assert.deepEqual(commands[1]?.input.ExclusiveStartKey, key);
  await repository.findRecent({
    limit: 10,
    entityType: 'PRODUCT',
    entityId: id,
  });
  assert.equal(commands[2]?.input.IndexName, undefined);
  assert.equal(commands[2]?.input.ConsistentRead, true);
  assert.deepEqual(commands[2]?.input.ExpressionAttributeValues, {
    ':partition': `ENTITY#PRODUCT#${id}`,
  });
});
test('unavailable DynamoDB is a delivery failure rather than successful acknowledgement', async () => {
  const failure = new Error('Unavailable');
  const client = {
    async send() {
      throw failure;
    },
  } as unknown as DynamoDBDocumentClient;
  await assert.rejects(
    new ActivityRepository(client, 'activity_events').put(
      activityEvent('CONTENT_CREATED', 'CONTENT', id),
    ),
    (error) => error === failure,
  );
});
