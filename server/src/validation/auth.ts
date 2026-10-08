import { z } from 'zod';
import { AppError } from '../errors/app-error.js';
export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email().max(254));
export const passwordSchema = z
  .string()
  .min(12)
  .max(128)
  .refine((value) => Buffer.byteLength(value, 'utf8') <= 256);
const loginSchema = z.strictObject({
  email: emailSchema,
  password: z
    .string()
    .min(1)
    .max(128)
    .refine((value) => Buffer.byteLength(value, 'utf8') <= 256),
});
export function parseAuth<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success)
    throw new AppError(
      400,
      'VALIDATION_ERROR',
      'Invalid authentication or user request',
    );
  return result.data;
}
export const parseLogin = (input: unknown) => parseAuth(loginSchema, input);
export const parsePasswordChange = (input: unknown) =>
  parseAuth(
    z.strictObject({
      currentPassword: loginSchema.shape.password,
      newPassword: passwordSchema,
    }),
    input,
  );
export const parseCreateUser = (input: unknown) =>
  parseAuth(
    z.strictObject({
      email: emailSchema,
      password: passwordSchema,
      role: z.enum(['ADMIN', 'EDITOR', 'VIEWER']),
    }),
    input,
  );
export const parseRole = (input: unknown) =>
  parseAuth(
    z.strictObject({ role: z.enum(['ADMIN', 'EDITOR', 'VIEWER']) }),
    input,
  );
export const parseStatus = (input: unknown) =>
  parseAuth(z.strictObject({ status: z.enum(['ACTIVE', 'DISABLED']) }), input);
export const parseUserId = (input: unknown) => parseAuth(z.uuid(), input);
export const parseUserQuery = (input: unknown) =>
  parseAuth(
    z.strictObject({
      page: z
        .string()
        .regex(/^[1-9]\d*$/)
        .default('1')
        .transform(Number)
        .pipe(z.number().int().max(1000000)),
      limit: z
        .string()
        .regex(/^[1-9]\d*$/)
        .default('20')
        .transform(Number)
        .pipe(z.number().int().max(100)),
    }),
    input,
  );
