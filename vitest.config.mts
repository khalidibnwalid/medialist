import react from '@vitejs/plugin-react'
import { resolve } from 'path'
import tsconfigPaths from 'vite-tsconfig-paths'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    projects: [
      {
        extends: true,
        test: {
          include: ['__tests__/client/**/*.test.{ts,js,tsx,jsx}'],
          name: 'client',
          environment: 'jsdom',
        }
      },
      {
        extends: true,
        test: {
          include: ['./__tests__/(api|server)/**/*.test.{ts,js}'],
          name: 'node',
          environment: 'node',
        }
      }
    ],
    alias: {
      '@': resolve(__dirname + '/src'),
      '@tests': resolve(__dirname + '/__tests__'),
    },
  },
})