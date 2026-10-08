import { DescribeTableCommand } from '@aws-sdk/client-dynamodb';
import { readEventConfig } from '../config/events.js';
import { createActivityDatabase } from './client.js';
import { ActivityRepository } from '../repositories/activity-repository.js';
const config = readEventConfig(process.env);
const database = createActivityDatabase(config);
try {
  const result = await database.client.send(
    new DescribeTableCommand({ TableName: config.table }),
  );
  const page = await new ActivityRepository(
    database.documentClient,
    config.table,
  ).findRecent({ limit: 1 });
  console.log(
    JSON.stringify({
      event: 'dynamodb_check_completed',
      table: config.table,
      status: result.Table?.TableStatus,
      activitySampleCount: page.data.length,
    }),
  );
} catch {
  console.error(
    'DynamoDB unavailable or activity table not initialized. Run npm run dynamodb:up and npm run dynamodb:init.',
  );
  process.exitCode = 1;
} finally {
  database.close();
}
