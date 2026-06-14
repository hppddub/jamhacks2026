import { config as loadEnv } from 'dotenv';
import { defineConfig } from 'drizzle-kit';

// drizzle-kit runs outside Next, so load .env.local manually for DATABASE_URL.
loadEnv({ path: '.env.local' });

export default defineConfig({
  schema: './lib/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    // `db:generate` does not need a connection; `db:migrate`/`db:studio` do.
    url: process.env.DATABASE_URL ?? '',
  },
});
