import { z } from 'zod';
export const IdSchema = z.uuid();
export const TimestampSchema = z.iso.datetime({ offset: true });
export const NonEmptyTextSchema = z.string().refine((v) => v.trim().length > 0, 'Must not be blank');
export const entityShape = { id: IdSchema, created_at: TimestampSchema, updated_at: TimestampSchema };
export function uniqueIds(items: readonly { id: string }[]): boolean {
  return new Set(items.map((item) => item.id)).size === items.length;
}
