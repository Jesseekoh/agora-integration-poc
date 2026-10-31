import { Hono } from 'hono';
import { and, eq } from 'drizzle-orm';
import { AppEnv } from '../types';
import { requireAuth } from '../middleware/auth';
import { groupMembers, groups } from '../db/schema';

export const groupsRouter = new Hono<AppEnv>();

groupsRouter.use('*', requireAuth);

// Posted to by the forms on /groups, so both redirect back there
groupsRouter.post('/:id/join', async (c) => {
  const db = c.get('db');
  const groupId = c.req.param('id');

  const [group] = await db.select({ id: groups.id }).from(groups).where(eq(groups.id, groupId));
  if (!group) return c.json({ error: 'Group not found' }, 404);

  await db
    .insert(groupMembers)
    .values({ groupId, userId: c.get('user')!.id })
    .onConflictDoNothing();
  return c.redirect('/groups');
});

groupsRouter.post('/:id/leave', async (c) => {
  await c
    .get('db')
    .delete(groupMembers)
    .where(
      and(eq(groupMembers.groupId, c.req.param('id')), eq(groupMembers.userId, c.get('user')!.id)),
    );
  return c.redirect('/groups');
});
