import { createId } from '@paralleldrive/cuid2';
import { defineRelationsPart } from 'drizzle-orm';
import { index, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { user } from './auth.schema.js';

export const calls = sqliteTable('calls', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => createId()),
  // 'direct' calls have a callee; 'group' calls have a group and ring every member
  type: text('type', { enum: ['direct', 'group'] })
    .notNull()
    .default('direct'),
  // 'audio' calls are voice only; 'video' calls also publish the camera
  media: text('media', { enum: ['audio', 'video'] })
    .notNull()
    .default('audio'),
  channel: text('channel').notNull().unique(),
  callerId: text('caller_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  calleeId: text('callee_id').references(() => user.id, { onDelete: 'cascade' }),
  groupId: text('group_id').references(() => groups.id, { onDelete: 'cascade' }),
  status: text('status', { enum: ['initiated', 'accepted', 'rejected', 'ended'] }).notNull(),
  createdAt: text('created_at')
    .$defaultFn(() => new Date().toISOString())
    .notNull(),
  updatedAt: text('updated_at')
    .$defaultFn(() => new Date().toISOString())
    .notNull(),
});

// One row per person per call, so a user's history is a single indexed lookup.
// The caller starts 'joined'; callees start 'ringing' and end up 'joined',
// 'declined', or 'missed' if the call ends while they're still ringing.
export const callParticipants = sqliteTable(
  'call_participants',
  {
    callId: text('call_id')
      .notNull()
      .references(() => calls.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    role: text('role', { enum: ['caller', 'callee'] }).notNull(),
    status: text('status', { enum: ['ringing', 'joined', 'declined', 'missed'] }).notNull(),
    joinedAt: text('joined_at'),
    createdAt: text('created_at')
      .$defaultFn(() => new Date().toISOString())
      .notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.callId, table.userId] }),
    index('call_participants_user_id_created_at_idx').on(table.userId, table.createdAt),
  ],
);

export const groups = sqliteTable('groups', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => createId()),
  name: text('name').notNull().unique(),
  createdAt: text('created_at')
    .$defaultFn(() => new Date().toISOString())
    .notNull(),
});

export const groupMembers = sqliteTable(
  'group_members',
  {
    groupId: text('group_id')
      .notNull()
      .references(() => groups.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    joinedAt: text('joined_at')
      .$defaultFn(() => new Date().toISOString())
      .notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.groupId, table.userId] }),
    index('group_members_user_id_idx').on(table.userId),
  ],
);

export const mainPart = defineRelationsPart({ calls, callParticipants, groups, groupMembers });
export * from './auth.schema.js';
