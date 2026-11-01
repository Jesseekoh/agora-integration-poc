import { Hono } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import { auth } from './lib/auth';
import { logger } from 'hono/logger';
import { cors } from 'hono/cors';
import { sessionMiddleware } from './middleware/session';
import { AppEnv } from './types';
import { requireAuth } from './middleware/auth';
import { api } from './routes/api';
import { views } from './routes/views';
import { swaggerUI } from '@hono/swagger-ui';
import { openApiSpec } from './lib/openapi';

const app = new Hono<AppEnv>();

app.use('*', logger());
app.use(cors({ origin: 'http://localhost:5173', credentials: true }));
app.use('*', async (c, next) => {
  const authInstance = auth(c.env);
  c.set('auth', authInstance);
  c.set('db', drizzle(c.env.agora_integration_poc_db));
  await next();
});
app.use('*', sessionMiddleware);

app.get('/docs', swaggerUI({ url: '/docs/openapi.json', withCredentials: true }));
app.get('/docs/openapi.json', (c) => c.json(openApiSpec));

app.route('/', api);
app.route('/', views);
export default app;

// Durable Object classes must be exported from the Worker's entry module
export { UserNotifier } from './durable-objects/user-notifier';
export { Presence } from './durable-objects/presence';
