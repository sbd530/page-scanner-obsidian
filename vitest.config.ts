import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Only the parts with no `obsidian` import are tested here: the API exists inside Obsidian.
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
});
