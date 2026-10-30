/**
 * Better Auth CLI configuration file
 *
 * Docs: https://www.better-auth.com/docs/concepts/cli
 */
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/d1';
import { drizzleAdapter } from '@better-auth/drizzle-adapter/relations-v2';
import { betterAuth } from 'better-auth';
// import { betterAuthOptions } from './src/lib/better-auth/options';
import * as schema from '../db/schema';

export const auth = (env: CloudflareBindings) => {
  return betterAuth({
    baseURL: env.ORIGIN,
    secret: env.BETTER_AUTH_SECRET,
    database: drizzleAdapter(drizzle(env.agora_integration_poc_db), {
      provider: 'sqlite',
      schema,
    }),
    emailAndPassword: { enabled: true },
    advanced: {
      // disableOriginCheck: env.
    },
  });
};
