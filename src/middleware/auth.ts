import { createMiddleware } from 'hono/factory';
import { AppEnv } from '../types';

// For API routes: respond with 401 JSON
export const requireAuth = createMiddleware<AppEnv>(async (c, next) => {
  const user = c.get('user');
  if (!user) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  await next();
});

// For pages: send the visitor to /login, then back here after signing in
export const requireAuthPage = createMiddleware<AppEnv>(async (c, next) => {
  if (!c.get('user')) {
    return c.redirect(`/login?next=${encodeURIComponent(c.req.path)}`);
  }
  await next();
});

// For /login and /signup: signed-in users have no reason to be there
export const redirectIfAuthed = createMiddleware<AppEnv>(async (c, next) => {
  if (c.get('user')) {
    return c.redirect('/');
  }
  await next();
});
