import { z } from 'zod';
import { AppError } from '../errors/app-error.js';
import type { EntityType } from '../events/activity-event.js';
const keySchema = z.strictObject({
  pk: z
    .string()
    .regex(/^ENTITY#(PRODUCT|CONTENT)#[0-9a-f-]{36}$/)
    .refine((value) => z.uuid().safeParse(value.split('#')[2]).success),
  sk: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z#[0-9a-f-]{36}$/)
    .refine((value) => {
      const [time, id] = value.split('#');
      return (
        z.iso.datetime({ precision: 3 }).safeParse(time).success &&
        z.uuid().safeParse(id).success
      );
    }),
  gsiPk: z.literal('RECENT').optional(),
  gsiSk: z.string().max(100).optional(),
});
export type ActivityKey = z.infer<typeof keySchema>;
export interface ActivityQuery {
  limit: number;
  entityType?: EntityType;
  entityId?: string;
  cursor?: string;
}
const schema = z
  .strictObject({
    limit: z
      .string()
      .regex(/^[1-9]\d*$/)
      .default('20')
      .transform(Number)
      .pipe(z.number().int().max(100)),
    entityType: z.enum(['PRODUCT', 'CONTENT']).optional(),
    entityId: z
      .uuid()
      .transform((value) => value.toLowerCase())
      .optional(),
    cursor: z
      .string()
      .min(1)
      .max(2048)
      .regex(/^[A-Za-z0-9_-]+$/)
      .optional(),
  })
  .refine((q) => Boolean(q.entityType) === Boolean(q.entityId));
export function decodeActivityCursor(
  cursor: string,
  entityType?: EntityType,
  entityId?: string,
): ActivityKey {
  try {
    const key = keySchema.parse(
      JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')),
    );
    if (entityType && entityId) {
      if (
        key.pk !== `ENTITY#${entityType}#${entityId}` ||
        key.gsiPk ||
        key.gsiSk
      )
        throw new Error('Invalid entity cursor');
    } else if (key.gsiPk !== 'RECENT' || key.gsiSk !== key.sk)
      throw new Error('Invalid global cursor');
    return key;
  } catch {
    throw new AppError(400, 'VALIDATION_ERROR', 'Invalid activity cursor');
  }
}
export function parseActivityQuery(input: unknown): ActivityQuery {
  const result = schema.safeParse(input);
  if (!result.success)
    throw new AppError(400, 'VALIDATION_ERROR', 'Invalid activity query');
  const { limit, entityType, entityId, cursor } = result.data;
  if (cursor) decodeActivityCursor(cursor, entityType, entityId);
  return {
    limit,
    ...(entityType ? { entityType } : {}),
    ...(entityId ? { entityId } : {}),
    ...(cursor ? { cursor } : {}),
  };
}
