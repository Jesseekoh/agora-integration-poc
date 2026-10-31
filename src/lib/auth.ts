/**
 * Better Auth CLI configuration file
 *
 * Docs: https://www.better-auth.com/docs/concepts/cli
 */
import { drizzle } from 'drizzle-orm/d1';
import { drizzleAdapter } from '@better-auth/drizzle-adapter/relations-v2';
import { betterAuth } from 'better-auth';
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
      // This is just for local development, so that I can use bruno or postman to send requests to the API.
      disableOriginCheck: true,
    },
  });
};
