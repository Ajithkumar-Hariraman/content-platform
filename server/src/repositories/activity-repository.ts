import {
  PutCommand,
  QueryCommand,
  type DynamoDBDocumentClient,
} from '@aws-sdk/lib-dynamodb';
import {
  activityEventSchema,
  type ActivityEvent,
} from '../events/activity-event.js';
import {
  decodeActivityCursor,
  type ActivityQuery,
} from '../validation/activity.js';
export interface ActivityPage {
  data: ActivityEvent[];
  nextCursor: string | null;
}
export class ActivityRepository {
  constructor(
    private readonly client: Pick<DynamoDBDocumentClient, 'send'>,
    private readonly table: string,
  ) {}
  async put(event: ActivityEvent, signal?: AbortSignal): Promise<void> {
    const validated = activityEventSchema.parse(event);
    const key = `${validated.occurredAt}#${validated.id}`;
    try {
      await this.client.send(
        new PutCommand({
          TableName: this.table,
          Item: {
            pk: `ENTITY#${validated.entityType}#${validated.entityId}`,
            sk: key,
            gsiPk: 'RECENT',
            gsiSk: key,
            ...validated,
          },
          ConditionExpression:
            'attribute_not_exists(pk) AND attribute_not_exists(sk)',
        }),
        signal ? { abortSignal: signal } : {},
      );
    } catch (error) {
      if (
        error &&
        typeof error === 'object' &&
        'name' in error &&
        error.name === 'ConditionalCheckFailedException'
      )
        return;
      throw error;
    }
  }
  async findRecent(
    query: ActivityQuery,
    signal?: AbortSignal,
  ): Promise<ActivityPage> {
    const entity = query.entityType && query.entityId;
    const response = await this.client.send(
      new QueryCommand({
        TableName: this.table,
        ...(entity ? {} : { IndexName: 'recent_activity' }),
        KeyConditionExpression: '#partition = :partition',
        ExpressionAttributeNames: { '#partition': entity ? 'pk' : 'gsiPk' },
        ExpressionAttributeValues: {
          ':partition': entity
            ? `ENTITY#${query.entityType}#${query.entityId}`
            : 'RECENT',
        },
        ScanIndexForward: false,
        Limit: query.limit,
        ...(entity ? { ConsistentRead: true } : {}),
        ...(query.cursor
          ? {
              ExclusiveStartKey: decodeActivityCursor(
                query.cursor,
                query.entityType,
                query.entityId,
              ),
            }
          : {}),
      }),
      signal ? { abortSignal: signal } : {},
    );
    const data = (response.Items ?? []).map((item: Record<string, unknown>) => {
      const { id, eventType, entityType, entityId, occurredAt, actor, data } =
        item;
      return activityEventSchema.parse({
        id,
        eventType,
        entityType,
        entityId,
        occurredAt,
        actor,
        data,
      });
    });
    return {
      data,
      nextCursor: response.LastEvaluatedKey
        ? Buffer.from(JSON.stringify(response.LastEvaluatedKey)).toString(
            'base64url',
          )
        : null,
    };
  }
}
