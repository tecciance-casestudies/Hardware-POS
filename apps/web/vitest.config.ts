import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

/**
 * Vitest for the web workspace. Node environment is enough — the dashboard chart
 * logic under test is pure (data transforms + formatters), with no DOM needed.
 * The `@/` alias mirrors tsconfig `paths` so specs import exactly like app code.
 */
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
  },
});
