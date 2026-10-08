import {
  CreateTableCommand,
  DescribeTableCommand,
  waitUntilTableExists,
  type KeySchemaElement,
  type AttributeDefinition,
  type GlobalSecondaryIndexDescription,
} from '@aws-sdk/client-dynamodb';
import { readEventConfig } from '../config/events.js';
import { createActivityDatabase } from './client.js';
const config = readEventConfig(process.env);
if (!config.endpoint || process.env.NODE_ENV !== 'development')
  throw new Error(
    'DynamoDB initialization requires a development DYNAMODB_ENDPOINT',
  );
const database = createActivityDatabase(config);
try {
  try {
    await database.client.send(
      new CreateTableCommand({
        TableName: config.table,
        BillingMode: 'PAY_PER_REQUEST',
        AttributeDefinitions: [
          { AttributeName: 'pk', AttributeType: 'S' },
          { AttributeName: 'sk', AttributeType: 'S' },
          { AttributeName: 'gsiPk', AttributeType: 'S' },
          { AttributeName: 'gsiSk', AttributeType: 'S' },
        ],
        KeySchema: [
          { AttributeName: 'pk', KeyType: 'HASH' },
          { AttributeName: 'sk', KeyType: 'RANGE' },
        ],
        GlobalSecondaryIndexes: [
          {
            IndexName: 'recent_activity',
            KeySchema: [
              { AttributeName: 'gsiPk', KeyType: 'HASH' },
              { AttributeName: 'gsiSk', KeyType: 'RANGE' },
            ],
            Projection: { ProjectionType: 'ALL' },
          },
        ],
      }),
    );
  } catch (error) {
    if (
      !error ||
      typeof error !== 'object' ||
      !('name' in error) ||
      error.name !== 'ResourceInUseException'
    )
      throw error;
  }
  await waitUntilTableExists(
    { client: database.client, maxWaitTime: 30, minDelay: 1, maxDelay: 3 },
    { TableName: config.table },
  );
  const { Table } = await database.client.send(
    new DescribeTableCommand({ TableName: config.table }),
  );
  if (
    !['pk', 'sk', 'gsiPk', 'gsiSk'].every((name) =>
      Table?.AttributeDefinitions?.some(
        (attribute: AttributeDefinition) =>
          attribute.AttributeName === name && attribute.AttributeType === 'S',
      ),
    ) ||
    Table?.KeySchema?.find((k: KeySchemaElement) => k.KeyType === 'HASH')
      ?.AttributeName !== 'pk' ||
    Table.KeySchema.find((k: KeySchemaElement) => k.KeyType === 'RANGE')
      ?.AttributeName !== 'sk' ||
    !Table.GlobalSecondaryIndexes?.some(
      (index: GlobalSecondaryIndexDescription) =>
        index.IndexName === 'recent_activity' &&
        index.KeySchema?.some(
          (k: KeySchemaElement) =>
            k.KeyType === 'HASH' && k.AttributeName === 'gsiPk',
        ) &&
        index.KeySchema?.some(
          (k: KeySchemaElement) =>
            k.KeyType === 'RANGE' && k.AttributeName === 'gsiSk',
        ) &&
        index.Projection?.ProjectionType === 'ALL',
    )
  )
    throw new Error(
      'Existing activity table does not match the required schema',
    );
  console.log(
    JSON.stringify({
      level: 'info',
      event: 'activity_table_initialized',
      table: config.table,
    }),
  );
} catch {
  console.error(
    'DynamoDB initialization failed. Check local service connectivity and table schema; run npm run dynamodb:up.',
  );
  process.exitCode = 1;
} finally {
  database.close();
}
