import { and, desc, eq } from 'drizzle-orm';
import { alias } from 'drizzle-orm/sqlite-core';
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import { callParticipants, calls, groups, user } from '../db/schema';

export const historyFilters = ['placed', 'answered', 'declined', 'missed'] as const;
export type HistoryFilter = (typeof historyFilters)[number];

const caller = alias(user, 'caller');
const callee = alias(user, 'callee');

// A user's calls, newest first. `role` and `outcome` say what happened to them:
// placed (caller), answered (callee + joined), declined or missed.
export const callHistory = (
  db: DrizzleD1Database,
  userId: string,
  { filter, limit = 50 }: { filter?: HistoryFilter; limit?: number } = {},
) => {
  const p = callParticipants;
  const filters = {
    placed: eq(p.role, 'caller'),
    answered: and(eq(p.role, 'callee'), eq(p.status, 'joined')),
    declined: eq(p.status, 'declined'),
    missed: eq(p.status, 'missed'),
  };

  return db
    .select({
      id: calls.id,
      type: calls.type,
      media: calls.media,
      status: calls.status,
      createdAt: calls.createdAt,
      role: p.role,
      outcome: p.status,
      joinedAt: p.joinedAt,
      caller: { id: caller.id, name: caller.name },
      callee: { id: callee.id, name: callee.name },
      group: { id: groups.id, name: groups.name },
    })
    .from(p)
    .innerJoin(calls, eq(calls.id, p.callId))
    .innerJoin(caller, eq(caller.id, calls.callerId))
    .leftJoin(callee, eq(callee.id, calls.calleeId))
    .leftJoin(groups, eq(groups.id, calls.groupId))
    .where(and(eq(p.userId, userId), filter && filters[filter]))
    .orderBy(desc(p.createdAt))
    .limit(limit);
};

export type CallHistoryRow = Awaited<ReturnType<typeof callHistory>>[number];
