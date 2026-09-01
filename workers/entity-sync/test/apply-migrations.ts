import { applyD1Migrations, env } from 'cloudflare:test';

// Each test worker gets an isolated D1; bring the schema up before any test runs.
await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
