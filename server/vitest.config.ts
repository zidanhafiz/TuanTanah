import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
    // `@tuan-tanah/shared` ships raw .ts (no build step); inline it so Vitest
    // transforms the source instead of trying to run it as external Node code.
    server: { deps: { inline: ['@tuan-tanah/shared'] } },
  },
})
