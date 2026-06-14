import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import * as schema from './schema';

/**
 * Drizzle client over Neon's serverless HTTP driver.
 *
 * Importing this module requires `DATABASE_URL` to be set; it is only imported by
 * server-side data code (Phase D+ project routes/queries), which runs on demand —
 * never during static prerender — so a missing value surfaces as a clear runtime
 * error rather than a build failure.
 */
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error(
    'DATABASE_URL is not set. Add your Neon connection string to .env.local to use the database.'
  );
}

export const db = drizzle(neon(connectionString), { schema });
