import type { D1Migration } from '@cloudflare/vitest-pool-workers';

// Test-only bindings, supplied via `miniflare.bindings` in vitest.config.ts.
declare global {
  namespace Cloudflare {
    interface Env {
      TEST_MIGRATIONS: D1Migration[];
    }
  }
}

export {};
