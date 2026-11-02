import { fileURLToPath } from 'node:url'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@inventory-data': fileURLToPath(new URL('./tests/fixtures/data-package', import.meta.url)),
    },
  },
  test: {
    environment: 'jsdom',
    // Node 26 has a `localStorage` of its own, which hides jsdom's from the
    // tests: without a storage file it is undefined.
    execArgv: ['--no-experimental-webstorage'],
  },
})
