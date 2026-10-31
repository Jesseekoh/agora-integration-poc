import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';

export function createDb(connectionString: string) {
  const sql = neon(connectionString);

  return drizzle({
    client: sql,
    // schema,
  });
}

export type DB = ReturnType<typeof createDb>;
