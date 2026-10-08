import { z } from 'zod';
import { AppError } from '../errors/app-error.js';
import type {
  CreateProductInput,
  UpdateProductInput,
  ProductQuery,
} from '../types/catalog.js';

const uuid = z.uuid();
const status = z.enum(['DRAFT', 'ACTIVE', 'INACTIVE']);
const price = z
  .string()
  .regex(
    /^(0|[1-9]\d{0,9})(\.\d{1,2})?$/,
    'Price must be a nonnegative decimal string with at most two decimal places',
  );
const productFields = z.strictObject({
  name: z.string().trim().min(1).max(200),
  slug: z
    .string()
    .min(1)
    .max(200)
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
  description: z.string().max(5000).nullable().optional(),
  price,
  status,
  categoryId: uuid,
});
const updateFields = productFields
  .partial()
  .refine(
    (value) => Object.keys(value).length > 0,
    'At least one update field is required',
  );
const integer = (maximum: number, defaultValue: string) =>
  z
    .string()
    .regex(/^[1-9]\d*$/)
    .default(defaultValue)
    .transform(Number)
    .pipe(z.number().int().min(1).max(maximum));
const queryFields = z.strictObject({
  page: integer(1000000, '1'),
  limit: integer(100, '10'),
  search: z.string().trim().max(200).optional(),
  categoryId: uuid.optional(),
  status: status.optional(),
  sort: z.enum(['createdAt', 'name', 'price']).default('createdAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
});

function parse<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) {
    const message = result.error.issues
      .map((issue) => `${issue.path.join('.') || 'request'}: ${issue.message}`)
      .join('; ');
    throw new AppError(400, 'VALIDATION_ERROR', message);
  }
  return result.data;
}

export function parseProductId(input: unknown): string {
  return parse(uuid, input);
}
export function parseCreateProduct(input: unknown): CreateProductInput {
  const { description, ...required } = parse(productFields, input);
  return { ...required, ...(description !== undefined ? { description } : {}) };
}
export function parseUpdateProduct(input: unknown): UpdateProductInput {
  const data = parse(updateFields, input);
  const result: UpdateProductInput = {};
  if (data.name !== undefined) result.name = data.name;
  if (data.slug !== undefined) result.slug = data.slug;
  if (data.description !== undefined) result.description = data.description;
  if (data.price !== undefined) result.price = data.price;
  if (data.status !== undefined) result.status = data.status;
  if (data.categoryId !== undefined) result.categoryId = data.categoryId;
  if (!Object.keys(result).length)
    throw new AppError(
      400,
      'VALIDATION_ERROR',
      'At least one update field is required',
    );
  return result;
}
export function parseProductQuery(input: unknown): ProductQuery {
  const { search, categoryId, status, ...required } = parse(queryFields, input);
  return {
    ...required,
    ...(search ? { search } : {}),
    ...(categoryId !== undefined ? { categoryId } : {}),
    ...(status !== undefined ? { status } : {}),
  };
}
