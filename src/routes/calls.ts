import { Hono, type Context } from 'hono';
import { and, eq, inArray, ne, sql } from 'drizzle-orm';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { createId } from '@paralleldrive/cuid2';
import { RtcRole, RtcTokenBuilder } from 'agora-token';
import { AppEnv } from '../types';
import { requireAuth } from '../middleware/auth';
import { notifyUser } from '../lib/notify';
import { callHistory, historyFilters } from '../lib/call-history';
import {
  callParticipants,
  calls,
  groupMembers,
  groups,
  user,
} from '../db/schema';

type Call = typeof calls.$inferSelect;
type CallStatus = Call['status'];
type NewParticipant = typeof callParticipants.$inferInsert;

const media = z.enum(['audio', 'video']).default('audio');

const TOKEN_TTL_SECONDS = 3600;

// Agora token for one user in one channel. The client must join with the same
// uid it was issued for: client.join(appId, channel, token, uid)
const makeToken = (env: CloudflareBindings, channel: string, uid: string) => {
  const token = RtcTokenBuilder.buildTokenWithUserAccount(
    env.AGORA_APP_ID,
    env.AGORA_APP_CERT,
    channel,
    uid,
    RtcRole.PUBLISHER,
    TOKEN_TTL_SECONDS,
    TOKEN_TTL_SECONDS,
  );
  // agora-token returns '' instead of throwing when the credentials are malformed
  if (!token) {
    throw new Error(
      'Agora token generation failed: AGORA_APP_ID and AGORA_APP_CERT must be 32-char hex',
    );
  }
  return token;
};

// What a client needs to join the Agora channel
const joinDetails = (c: Context<AppEnv>, call: Call, uid: string) => ({
  callId: call.id,
  type: call.type,
  media: call.media,
  appId: c.env.AGORA_APP_ID,
  channel: call.channel,
  uid,
  token: makeToken(c.env, call.channel, uid),
});

const isGroupMember = async (
  c: Context<AppEnv>,
  groupId: string,
  userId: string,
) => {
  const [row] = await c
    .get('db')
    .select({ userId: groupMembers.userId })
    .from(groupMembers)
    .where(
      and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, userId)),
    );
  return !!row;
};

const otherGroupMemberIds = async (
  c: Context<AppEnv>,
  groupId: string,
  exceptUserId: string,
) => {
  const rows = await c
    .get('db')
    .select({ userId: groupMembers.userId })
    .from(groupMembers)
    .where(
      and(
        eq(groupMembers.groupId, groupId),
        ne(groupMembers.userId, exceptUserId),
      ),
    );
  return rows.map((r) => r.userId);
};

// Moves a call to `to` only if it's currently in one of `from`. A single
// conditional UPDATE, so two racing requests can't both win.
const transition = async (
  c: Context<AppEnv>,
  id: string,
  from: CallStatus[],
  to: CallStatus,
) => {
  const [call] = await c
    .get('db')
    .update(calls)
    .set({ status: to, updatedAt: new Date().toISOString() })
    .where(and(eq(calls.id, id), inArray(calls.status, from)))
    .returning();
  return call;
};

// Inserts the call and a participant row for everyone on it in one batch, so
// there's never a call without its participants
const createCall = async (
  c: Context<AppEnv>,
  values: Omit<typeof calls.$inferInsert, 'id' | 'status'>,
  calleeIds: string[],
) => {
  const db = c.get('db');
  const id = createId();
  const participants: NewParticipant[] = [
    {
      callId: id,
      userId: values.callerId,
      role: 'caller',
      status: 'joined',
      joinedAt: new Date().toISOString(),
    },
    ...calleeIds.map((userId): NewParticipant => ({
      callId: id,
      userId,
      role: 'callee',
      status: 'ringing',
    })),
  ];
  const [[call]] = await db.batch([
    db
      .insert(calls)
      .values({ ...values, id, status: 'initiated' })
      .returning(),
    db.insert(callParticipants).values(participants),
  ]);
  return call!;
};

// Marks a callee as having joined. An upsert, since someone who joined the
// group after the call started has no row yet. Rejoining keeps the first joinedAt.
const markJoined = (c: Context<AppEnv>, callId: string, userId: string) =>
  c
    .get('db')
    .insert(callParticipants)
    .values({
      callId,
      userId,
      role: 'callee',
      status: 'joined',
      joinedAt: new Date().toISOString(),
    })
    .onConflictDoUpdate({
      target: [callParticipants.callId, callParticipants.userId],
      set: {
        status: 'joined',
        joinedAt: sql`coalesce(${callParticipants.joinedAt}, excluded.joined_at)`,
      },
    });

export const callsRouter = new Hono<AppEnv>();

callsRouter.use('*', requireAuth);

// SSE stream of call events for the signed-in user:
// incoming-call, call-accepted, call-rejected, call-ended
callsRouter.get('/events', async (c) => {
  const ns = c.env.USER_NOTIFIER;
  const userId = c.get('user')!.id;
  // Overwrites anything the client sent, so the header can be trusted
  const request = new Request(c.req.raw);
  request.headers.set('x-user-id', userId);
  const res = await ns.get(ns.idFromName(userId)).fetch(request);
  const out = new Response(res.body, res);
  out.headers.set('cache-control', 'no-cache, no-transform');
  out.headers.set('x-accel-buffering', 'no');
  // out.headers.set('content-type', 'text/event-stream; charset=utf-8');
  return out;
});

// Start a 1:1 call. Returns the caller's join details and rings the callee.
callsRouter.post(
  '/calls/direct',
  zValidator(
    'json',
    z.object({
      callerId: z.string().min(1),
      calleeId: z.string().min(1),
      media,
    }),
  ),
  async (c) => {
    const me = c.get('user')!;
    const { callerId, calleeId, media } = c.req.valid('json');

    if (callerId !== me.id)
      return c.json({ error: 'You can only place calls as yourself' }, 403);
    if (calleeId === me.id)
      return c.json({ error: "You can't call yourself" }, 400);

    const db = c.get('db');
    const [callee] = await db
      .select({ id: user.id })
      .from(user)
      .where(eq(user.id, calleeId));
    if (!callee) return c.json({ error: 'Callee not found' }, 404);

    const call = await createCall(
      c,
      {
        type: 'direct',
        media,
        channel: `direct_${createId()}`,
        callerId,
        calleeId,
      },
      [calleeId],
    );

    // Build the token before ringing anyone, so a token failure doesn't ring the callee
    const details = joinDetails(c, call, me.id);
    // Placed whether or not the callee is online, so unanswered calls are still recorded
    await notifyUser(c.env, calleeId, 'incoming-call', {
      callId: call.id,
      type: 'direct',
      media,
      caller: { id: me.id, name: me.name, email: me.email },
    });

    return c.json(details, 201);
  },
);

// Start a group call. Returns the caller's join details and rings every other member.
callsRouter.post(
  '/calls/group',
  zValidator(
    'json',
    z.object({
      callerId: z.string().min(1),
      groupId: z.string().min(1),
      media,
    }),
  ),
  async (c) => {
    const me = c.get('user')!;
    const { callerId, groupId, media } = c.req.valid('json');

    if (callerId !== me.id)
      return c.json({ error: 'You can only place calls as yourself' }, 403);

    const db = c.get('db');
    const [group] = await db
      .select({ id: groups.id, name: groups.name })
      .from(groups)
      .where(eq(groups.id, groupId));
    if (!group) return c.json({ error: 'Group not found' }, 404);
    if (!(await isGroupMember(c, groupId, me.id))) {
      return c.json(
        { error: 'You must be a member of this group to call it' },
        403,
      );
    }

    const memberIds = await otherGroupMemberIds(c, groupId, me.id);
    if (memberIds.length === 0) {
      return c.json(
        { error: 'There is no one else in this group to call' },
        409,
      );
    }

    const call = await createCall(
      c,
      {
        type: 'group',
        media,
        channel: `group_${groupId}_${createId()}`,
        callerId,
        groupId,
      },
      memberIds,
    );

    const details = joinDetails(c, call, me.id);
    const payload = {
      callId: call.id,
      type: 'group',
      media,
      caller: { id: me.id, name: me.name, email: me.email },
      group,
    };
    await Promise.all(
      memberIds.map((id) => notifyUser(c.env, id, 'incoming-call', payload)),
    );

    return c.json(details, 201);
  },
);

// The signed-in user's calls, newest first (see lib/call-history.ts).
// Registered before /calls/:id so 'history' isn't taken as an id.
callsRouter.get(
  '/calls/history',
  zValidator(
    'query',
    z.object({
      filter: z.enum(historyFilters).optional(),
      limit: z.coerce.number().int().min(1).max(100).default(50),
    }),
  ),
  async (c) => {
    const { filter, limit } = c.req.valid('query');
    const rows = await callHistory(c.get('db'), c.get('user')!.id, {
      filter,
      limit,
    });
    return c.json(rows);
  },
);

// Only people on the call can see it
callsRouter.get('/calls/:id', async (c) => {
  const me = c.get('user')!;
  const [call] = await c
    .get('db')
    .select()
    .from(calls)
    .where(eq(calls.id, c.req.param('id')));
  if (!call) return c.json({ error: 'Call not found' }, 404);

  const allowed =
    call.callerId === me.id ||
    call.calleeId === me.id ||
    (call.groupId !== null && (await isGroupMember(c, call.groupId, me.id)));
  if (!allowed) return c.json({ error: 'Call not found' }, 404);

  return c.json(call);
});

// Answer a call. Returns the answerer's join details.
callsRouter.post('/calls/:id/accept', async (c) => {
  const me = c.get('user')!;
  const id = c.req.param('id');
  const [existing] = await c
    .get('db')
    .select()
    .from(calls)
    .where(eq(calls.id, id));
  if (!existing) return c.json({ error: 'Call not found' }, 404);

  if (existing.type === 'direct') {
    if (existing.calleeId !== me.id)
      return c.json({ error: 'Call not found' }, 404);
    const call = await transition(c, id, ['initiated'], 'accepted');
    if (!call) return c.json({ error: 'Call is no longer ringing' }, 409);

    // The callee's own streams hear it too, so their other tabs stop ringing
    await Promise.all([
      markJoined(c, call.id, me.id),
      ...[call.callerId, me.id].map((uid) =>
        notifyUser(c.env, uid, 'call-accepted', { callId: call.id, by: me.id }),
      ),
    ]);
    return c.json(joinDetails(c, call, me.id));
  }

  // Group calls: any member can join while the call is live
  if (
    existing.callerId === me.id ||
    !(await isGroupMember(c, existing.groupId!, me.id))
  ) {
    return c.json({ error: 'Call not found' }, 404);
  }
  const call = await transition(c, id, ['initiated', 'accepted'], 'accepted');
  if (!call) return c.json({ error: 'Call has ended' }, 409);

  await Promise.all([
    markJoined(c, call.id, me.id),
    notifyUser(c.env, call.callerId, 'call-accepted', {
      callId: call.id,
      by: me.id,
    }),
  ]);
  return c.json(joinDetails(c, call, me.id));
});

// Decline a direct call. For group calls, declining is just not joining.
callsRouter.post('/calls/:id/reject', async (c) => {
  const me = c.get('user')!;
  const id = c.req.param('id');
  const [existing] = await c
    .get('db')
    .select()
    .from(calls)
    .where(eq(calls.id, id));
  if (!existing || existing.calleeId !== me.id)
    return c.json({ error: 'Call not found' }, 404);

  const call = await transition(c, id, ['initiated'], 'rejected');
  if (!call) return c.json({ error: 'Call is no longer ringing' }, 409);

  await Promise.all([
    c
      .get('db')
      .update(callParticipants)
      .set({ status: 'declined' })
      .where(
        and(
          eq(callParticipants.callId, call.id),
          eq(callParticipants.userId, me.id),
        ),
      ),
    ...[call.callerId, me.id].map((uid) =>
      notifyUser(c.env, uid, 'call-rejected', { callId: call.id }),
    ),
  ]);
  return c.body(null, 204);
});

// Hang up or cancel. Either side can end a direct call; only the caller can end a group call.
callsRouter.post('/calls/:id/end', async (c) => {
  const me = c.get('user')!;
  const id = c.req.param('id');
  const [existing] = await c
    .get('db')
    .select()
    .from(calls)
    .where(eq(calls.id, id));
  const isParty =
    existing && (existing.callerId === me.id || existing.calleeId === me.id);
  if (!isParty) return c.json({ error: 'Call not found' }, 404);

  const call = await transition(c, id, ['initiated', 'accepted'], 'ended');
  if (!call) return c.json({ error: 'Call is not active' }, 409);

  // Anyone still ringing when the call ends missed it
  await c
    .get('db')
    .update(callParticipants)
    .set({ status: 'missed' })
    .where(
      and(
        eq(callParticipants.callId, call.id),
        eq(callParticipants.status, 'ringing'),
      ),
    );

  const notifyIds =
    call.type === 'direct'
      ? [call.callerId === me.id ? call.calleeId! : call.callerId]
      : await otherGroupMemberIds(c, call.groupId!, me.id);
  await Promise.all(
    notifyIds.map((uid) =>
      notifyUser(c.env, uid, 'call-ended', { callId: call.id }),
    ),
  );
  return c.body(null, 204);
});
