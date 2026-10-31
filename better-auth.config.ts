/**
 * Better Auth CLI configuration file
 *
 * Docs: https://www.better-auth.com/docs/concepts/cli
 */
// This file is used to configure the Better Auth CLI for generating authentication schemas and other related files. It specifies the database connection, schema definitions, and other settings required for the CLI to function correctly.
import { drizzle } from 'drizzle-orm/d1';
import { drizzleAdapter } from '@better-auth/drizzle-adapter/relations-v2';
import { betterAuth } from 'better-auth';

const { DATABASE_URL, ORIGIN, BETTER_AUTH_SECRET } = process.env;

const db = drizzle({});

export const auth: ReturnType<typeof betterAuth> = betterAuth({
  baseURL: ORIGIN,
  secret: BETTER_AUTH_SECRET,
  database: drizzleAdapter(db, {
    provider: 'sqlite',
    schema: {},
  }),
  emailAndPassword: { enabled: true },
});
