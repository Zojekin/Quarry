import type { Context } from 'hono';
import { z } from 'zod';
import { AppError, ErrorCode, IdSchema } from '@quarry/shared';
import type { QuarryServerEnv } from '../app.js';

export function invalid(message: string): never { throw new AppError(ErrorCode.ValidationError, message); }
export function found<T>(value: T | undefined): T {
  if (value === undefined) throw new AppError(ErrorCode.NotFound, 'Not found');
  return value;
}
export function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) throw new AppError(ErrorCode.ValidationError, 'Invalid input', result.error.issues);
  return result.data;
}
export async function body(context: Context<QuarryServerEnv>): Promise<Record<string, unknown>> {
  let value: unknown;
  try { value = await context.req.json(); } catch { return invalid('Invalid JSON body'); }
  return parse(z.record(z.string(), z.unknown()), value);
}
export const nameSchema = z.string().trim().min(1);
export const idsSchema = z.array(IdSchema).refine(ids => new Set(ids).size === ids.length, 'Duplicate IDs');
export function filterIds(value: string | undefined): string[] {
  return value ? parse(idsSchema, value.split(',')) : [];
}
