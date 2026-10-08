import { z } from 'zod';
import { AppError } from '../errors/app-error.js';
import type {
  CreateContentInput,
  UpdateContentInput,
  ContentQuery,
} from '../types/content.js';
const slug = z
  .string()
  .max(200)
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/);
const fields = z.strictObject({
  title: z.string().trim().min(1).max(200),
  slug,
  summary: z.string().max(5000).nullable().optional(),
  body: z.string().trim().min(1).max(50000),
});
const integer = (max: number, fallback: string) =>
  z
    .string()
    .regex(/^[1-9]\d*$/)
    .default(fallback)
    .transform(Number)
    .pipe(z.number().int().min(1).max(max));
const query = z.strictObject({
  page: integer(1000000, '1'),
  limit: integer(100, '10'),
  search: z.string().trim().max(200).optional(),
  status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']).optional(),
  sort: z.enum(['createdAt', 'publishedAt', 'title']).default('createdAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
});
function parse<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success)
    throw new AppError(400, 'VALIDATION_ERROR', 'Invalid content request');
  return result.data;
}
export const parseContentId = (input: unknown) => parse(z.uuid(), input);
export const parseContentSlug = (input: unknown) => parse(slug, input);
export function parseCreateContent(input: unknown): CreateContentInput {
  const { summary, ...data } = parse(fields, input);
  return { ...data, ...(summary !== undefined ? { summary } : {}) };
}
export function parseUpdateContent(input: unknown): UpdateContentInput {
  const data = parse(
    fields.partial().refine((v) => Object.keys(v).length > 0),
    input,
  );
  return Object.fromEntries(
    Object.entries(data).filter(([, v]) => v !== undefined),
  );
}
export function parseContentQuery(
  input: unknown,
  publicOnly = false,
): ContentQuery {
  const schema = publicOnly
    ? query.omit({ status: true }).extend({
        sort: z.enum(['publishedAt', 'title']).default('publishedAt'),
      })
    : query;
  const { search, ...data } = parse(schema, input);
  return { ...data, ...(search ? { search } : {}) };
}
