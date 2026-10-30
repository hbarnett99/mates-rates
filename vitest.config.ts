import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// Run tests in a device time zone far from Melbourne, so any date logic that
// leans on the device clock instead of Australia/Melbourne fails loudly.
process.env.TZ = 'America/Los_Angeles';

export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('.', import.meta.url)) },
  },
  test: {
    include: ['**/*.test.ts'],
    exclude: ['node_modules/**', '.next/**'],
  },
});
