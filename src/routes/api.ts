import { Hono } from 'hono';
import { AppEnv } from '../types';
import { cors } from 'hono/cors';
import { callsRouter } from './calls';
import { groupsRouter } from './groups';

export const api = new Hono<AppEnv>().basePath('/api');

api.use(
  cors({
    credentials: true,
  }),
);
api.on(['GET', 'POST'], '/auth/*', (c) => {
  return c.get('auth').handler(c.req.raw);
});

api.route('/', callsRouter);
api.route('/groups', groupsRouter);
