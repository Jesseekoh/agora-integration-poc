import { createMiddleware } from 'hono/factory';
import { auth } from '../lib/auth.js';
import { AppEnv } from '../types.js';

export const sessionMiddleware = createMiddleware<AppEnv>(async (c, next) => {
  const authInstance = c.get('auth');
  const session = await authInstance.api.getSession({
    headers: c.req.raw.headers,
  });

  c.set('session', session?.session ?? null);
  c.set('user', session?.user ?? null);

  await next();
});
