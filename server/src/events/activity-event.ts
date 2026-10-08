import { actorContext } from '../auth/actor-context.js';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
const actorSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.enum(['SYSTEM', 'ADMIN_PORTAL']) }),
  z.strictObject({ kind: z.literal('USER'), id: z.string().min(1).max(200) }),
]);
const common = {
  id: z.uuid().transform((value) => value.toLowerCase()),
  entityId: z.uuid().transform((value) => value.toLowerCase()),
  occurredAt: z.iso.datetime({ precision: 3 }),
  actor: actorSchema,
  data: z.strictObject({
    slug: z.string().max(200).optional(),
    changedFields: z.array(z.string().max(40)).max(10).optional(),
    status: z
      .enum(['DRAFT', 'ACTIVE', 'INACTIVE', 'PUBLISHED', 'ARCHIVED'])
      .optional(),
  }),
};
export const activityEventSchema = z.discriminatedUnion('entityType', [
  z.strictObject({
    ...common,
    entityType: z.literal('PRODUCT'),
    eventType: z.enum([
      'PRODUCT_CREATED',
      'PRODUCT_UPDATED',
      'PRODUCT_DELETED',
    ]),
  }),
  z.strictObject({
    ...common,
    entityType: z.literal('CONTENT'),
    eventType: z.enum([
      'CONTENT_CREATED',
      'CONTENT_UPDATED',
      'CONTENT_PUBLISHED',
      'CONTENT_ARCHIVED',
      'CONTENT_DELETED',
    ]),
  }),
]);
export type ActivityEvent = z.infer<typeof activityEventSchema>;
export type EventType = ActivityEvent['eventType'];
export type EntityType = ActivityEvent['entityType'];
export function activityEvent(
  eventType: EventType,
  entityType: EntityType,
  entityId: string,
  data: ActivityEvent['data'] = {},
): ActivityEvent {
  return activityEventSchema.parse({
    id: randomUUID(),
    eventType,
    entityType,
    entityId,
    occurredAt: new Date().toISOString(),
    actor: actorContext.getStore() ?? { kind: 'SYSTEM' },
    data,
  });
}
