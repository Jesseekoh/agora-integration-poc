import { createId } from '@paralleldrive/cuid2';
import { defineRelationsPart } from 'drizzle-orm';
import { sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const calls = sqliteTable('calls', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => createId()),
  channel: text('channel').notNull(),
  callerId: text('caller_id').notNull(),
  calleeId: text('callee_id').notNull(),
  status: text('status').notNull(),
  createdAt: text('created_at')
    .$defaultFn(() => new Date().toISOString())
    .notNull(),
  updatedAt: text('updated_at')
    .$defaultFn(() => new Date().toISOString())
    .notNull(),
});

export const mainPart = defineRelationsPart({ calls });
export * from './auth.schema.js';
