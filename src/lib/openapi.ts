// OpenAPI spec served at /docs/openapi.json and rendered by Swagger UI at /docs.
// Hand-written: keep it in step with routes/calls.ts, routes/groups.ts and lib/call-history.ts.

const json = (schema: object) => ({ 'application/json': { schema } });
const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });
const error = (description: string) => ({ description, content: json(ref('Error')) });
const idParam = {
  name: 'id',
  in: 'path',
  required: true,
  schema: { type: 'string' },
};

const media = { type: 'string', enum: ['audio', 'video'], default: 'audio' };

export const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'Agora POC API',
    version: '1.0.0',
    description:
      'Sign in first (POST /api/auth/sign-in/email): the session cookie it sets authenticates every other endpoint.',
  },
  servers: [{ url: '/' }],
  security: [{ session: [] }],
  tags: [{ name: 'Auth' }, { name: 'Events' }, { name: 'Calls' }, { name: 'Groups' }],

  paths: {
    // ------------------------------------------------------------ auth (Better Auth)
    '/api/auth/sign-up/email': {
      post: {
        tags: ['Auth'],
        summary: 'Create an account and sign in',
        security: [],
        requestBody: {
          required: true,
          content: json({
            type: 'object',
            required: ['name', 'email', 'password'],
            properties: {
              name: { type: 'string' },
              email: { type: 'string', format: 'email' },
              password: { type: 'string', minLength: 8 },
            },
          }),
        },
        responses: {
          200: {
            description: 'Signed up; sets the session cookie',
            content: json({
              type: 'object',
              properties: { token: { type: 'string' }, user: ref('User') },
            }),
          },
          422: error('Email already in use, or invalid input'),
        },
      },
    },
    '/api/auth/sign-in/email': {
      post: {
        tags: ['Auth'],
        summary: 'Sign in',
        security: [],
        requestBody: {
          required: true,
          content: json({
            type: 'object',
            required: ['email', 'password'],
            properties: {
              email: { type: 'string', format: 'email' },
              password: { type: 'string' },
              rememberMe: { type: 'boolean', default: true },
            },
          }),
        },
        responses: {
          200: {
            description: 'Signed in; sets the session cookie',
            content: json({
              type: 'object',
              properties: { token: { type: 'string' }, user: ref('User') },
            }),
          },
          401: error('Wrong email or password'),
        },
      },
    },
    '/api/auth/get-session': {
      get: {
        tags: ['Auth'],
        summary: 'The current session',
        responses: {
          200: {
            description: 'The session and user, or null when signed out',
            content: json({
              type: 'object',
              nullable: true,
              properties: {
                session: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    userId: { type: 'string' },
                    expiresAt: { type: 'string', format: 'date-time' },
                  },
                },
                user: ref('User'),
              },
            }),
          },
        },
      },
    },
    '/api/auth/sign-out': {
      post: {
        tags: ['Auth'],
        summary: 'Sign out',
        responses: {
          200: {
            description: 'Signed out; clears the session cookie',
            content: json({ type: 'object', properties: { success: { type: 'boolean' } } }),
          },
        },
      },
    },

    // ------------------------------------------------------------ events
    '/api/events': {
      get: {
        tags: ['Events'],
        summary: 'Server-sent event stream for the signed-in user',
        description: [
          'Long-lived `text/event-stream`; Swagger UI waits for it to close, so use `curl -N` or EventSource instead.',
          '',
          '| event | data |',
          '|---|---|',
          '| `incoming-call` | `IncomingCall` |',
          '| `call-accepted` | `{ callId, by }` (by = user id) |',
          '| `call-rejected` | `{ callId }` |',
          '| `call-ended` | `{ callId }` |',
          '| `presence` | `{ userId, online }` |',
          '| `presence-sync` | `{ online: string[] }` (sent on connect) |',
        ].join('\n'),
        responses: {
          200: {
            description: 'Event stream',
            content: {
              'text/event-stream': {
                schema: { type: 'string' },
                example: 'event: call-ended\ndata: {"callId":"abc123"}\n\n',
              },
            },
          },
          401: error('Not signed in'),
        },
      },
    },

    // ------------------------------------------------------------ calls
    '/api/calls/direct': {
      post: {
        tags: ['Calls'],
        summary: 'Start a 1:1 call',
        description: 'Rings the callee (`incoming-call`) whether or not they are online.',
        requestBody: {
          required: true,
          content: json({
            type: 'object',
            required: ['callerId', 'calleeId'],
            properties: {
              callerId: { type: 'string', description: 'Must be the signed-in user' },
              calleeId: { type: 'string' },
              media,
            },
          }),
        },
        responses: {
          201: { description: "The caller's join details", content: json(ref('JoinDetails')) },
          400: error("Invalid body, or calling yourself"),
          403: error('callerId is not the signed-in user'),
          404: error('Callee not found'),
        },
      },
    },
    '/api/calls/group': {
      post: {
        tags: ['Calls'],
        summary: 'Start a group call',
        description: 'Rings every other member of the group.',
        requestBody: {
          required: true,
          content: json({
            type: 'object',
            required: ['callerId', 'groupId'],
            properties: {
              callerId: { type: 'string', description: 'Must be the signed-in user' },
              groupId: { type: 'string' },
              media,
            },
          }),
        },
        responses: {
          201: { description: "The caller's join details", content: json(ref('JoinDetails')) },
          400: error('Invalid body'),
          403: error('Not the signed-in user, or not a member of the group'),
          404: error('Group not found'),
          409: error('No one else in the group to call'),
        },
      },
    },
    '/api/calls/history': {
      get: {
        tags: ['Calls'],
        summary: "The signed-in user's calls, newest first",
        parameters: [
          {
            name: 'filter',
            in: 'query',
            schema: { type: 'string', enum: ['placed', 'answered', 'declined', 'missed'] },
          },
          {
            name: 'limit',
            in: 'query',
            schema: { type: 'integer', minimum: 1, maximum: 100, default: 50 },
          },
        ],
        responses: {
          200: {
            description: 'Call history',
            content: json({ type: 'array', items: ref('CallHistoryItem') }),
          },
        },
      },
    },
    '/api/calls/{id}': {
      get: {
        tags: ['Calls'],
        summary: 'Get a call',
        description: 'Only visible to the caller, the callee, or members of the group.',
        parameters: [idParam],
        responses: {
          200: { description: 'The call', content: json(ref('Call')) },
          404: error('Call not found'),
        },
      },
    },
    '/api/calls/{id}/accept': {
      post: {
        tags: ['Calls'],
        summary: 'Answer a call',
        description:
          'Direct calls: callee only, while ringing. Group calls: any member but the caller, while live.',
        parameters: [idParam],
        responses: {
          200: { description: "The answerer's join details", content: json(ref('JoinDetails')) },
          404: error('Call not found'),
          409: error('No longer ringing, or ended'),
        },
      },
    },
    '/api/calls/{id}/reject': {
      post: {
        tags: ['Calls'],
        summary: 'Decline a 1:1 call (callee only)',
        parameters: [idParam],
        responses: {
          204: { description: 'Declined' },
          404: error('Call not found'),
          409: error('No longer ringing'),
        },
      },
    },
    '/api/calls/{id}/end': {
      post: {
        tags: ['Calls'],
        summary: 'Hang up or cancel',
        description:
          'Either side can end a 1:1 call; only the caller can end a group call. Anyone still ringing is marked missed.',
        parameters: [idParam],
        responses: {
          204: { description: 'Ended' },
          404: error('Call not found'),
          409: error('Call is not active'),
        },
      },
    },

    // ------------------------------------------------------------ groups
    '/api/groups/{id}/join': {
      post: {
        tags: ['Groups'],
        summary: 'Join a group',
        description: 'Posted by the form on /groups. Joining twice is a no-op.',
        parameters: [idParam],
        responses: {
          302: { description: 'Redirects to /groups' },
          404: error('Group not found'),
        },
      },
    },
    '/api/groups/{id}/leave': {
      post: {
        tags: ['Groups'],
        summary: 'Leave a group',
        description: 'Posted by the form on /groups.',
        parameters: [idParam],
        responses: { 302: { description: 'Redirects to /groups' } },
      },
    },
  },

  components: {
    securitySchemes: {
      session: { type: 'apiKey', in: 'cookie', name: 'better-auth.session_token' },
    },
    schemas: {
      Error: {
        type: 'object',
        properties: { error: { type: 'string' } },
      },
      User: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          email: { type: 'string' },
        },
      },
      JoinDetails: {
        type: 'object',
        description: 'Join with client.join(appId, channel, token, uid). The token lasts an hour.',
        properties: {
          callId: { type: 'string' },
          type: { type: 'string', enum: ['direct', 'group'] },
          media: { type: 'string', enum: ['audio', 'video'] },
          appId: { type: 'string' },
          channel: { type: 'string' },
          uid: { type: 'string' },
          token: { type: 'string' },
        },
      },
      Call: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          type: { type: 'string', enum: ['direct', 'group'] },
          media: { type: 'string', enum: ['audio', 'video'] },
          channel: { type: 'string' },
          callerId: { type: 'string' },
          calleeId: { type: 'string', nullable: true },
          groupId: { type: 'string', nullable: true },
          status: { type: 'string', enum: ['initiated', 'accepted', 'rejected', 'ended'] },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
      CallHistoryItem: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          type: { type: 'string', enum: ['direct', 'group'] },
          media: { type: 'string', enum: ['audio', 'video'] },
          status: { type: 'string', enum: ['initiated', 'accepted', 'rejected', 'ended'] },
          createdAt: { type: 'string', format: 'date-time' },
          role: { type: 'string', enum: ['caller', 'callee'] },
          outcome: { type: 'string', enum: ['ringing', 'joined', 'declined', 'missed'] },
          joinedAt: { type: 'string', format: 'date-time', nullable: true },
          caller: ref('Party'),
          callee: { allOf: [ref('Party')], nullable: true, description: '1:1 calls only' },
          group: { allOf: [ref('Party')], nullable: true, description: 'Group calls only' },
        },
      },
      Party: {
        type: 'object',
        properties: { id: { type: 'string' }, name: { type: 'string' } },
      },
      IncomingCall: {
        type: 'object',
        properties: {
          callId: { type: 'string' },
          type: { type: 'string', enum: ['direct', 'group'] },
          media: { type: 'string', enum: ['audio', 'video'] },
          caller: ref('User'),
          group: { allOf: [ref('Party')], description: 'Group calls only' },
        },
      },
    },
  },
};
