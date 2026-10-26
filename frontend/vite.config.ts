import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Su Windows il watch nativo può dare EBUSY: in sviluppo usiamo il polling.
    watch: {
      usePolling: true,
      interval: 500,
      ignored: ['**/node_modules/**', '**/.git/**', '**/.omc/**', '**/*.tmpdir/**']
    },
    proxy: {
      '/api': 'http://localhost:8080'
    }
  },
  preview: {
    port: 5173,
    host: '127.0.0.1',
    proxy: {
      '/api': 'http://localhost:8080'
    }
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    include: ['src/**/*.{test,spec}.{ts,tsx}']
  }
});
