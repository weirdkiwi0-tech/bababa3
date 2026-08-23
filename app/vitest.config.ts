import { defineConfig, mergeConfig } from 'vitest/config'
import viteConfig from './vite.config.ts'

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: 'jsdom',
      setupFiles: ['./src/test/setupTests.ts'],
      include: [
        'src/**/*.unit.test.{ts,tsx}',
        'src/**/*.integration.test.{ts,tsx}',
      ],
      coverage: {
        provider: 'v8',
        reporter: ['text', 'html'],
      },
    },
  }),
)
