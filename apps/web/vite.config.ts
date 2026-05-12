import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { TanStackRouterVite } from '@tanstack/router-plugin/vite'
import { resolve } from 'path'

export default defineConfig(({ mode }) => ({
  plugins: [
    // Skip TanStackRouterVite during tests — it tries to generate route files
    // which conflicts with jsdom and our mocked router
    ...(mode !== 'test' ? [TanStackRouterVite()] : []),
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
}))
