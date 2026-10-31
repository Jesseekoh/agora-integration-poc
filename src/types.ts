import type { DrizzleD1Database } from 'drizzle-orm/d1';
import type { auth } from './lib/auth.js';

export type Auth = ReturnType<typeof auth>;
export type AuthSession = Auth['$Infer']['Session'];

export type AppEnv = {
  Bindings: CloudflareBindings;
  Variables: {
    auth: Auth;
    db: DrizzleD1Database;
    session: AuthSession['session'] | null;
    user: AuthSession['user'] | null;
  };
};
