import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': '/src',
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['**/*.test.ts', '**/*.test.tsx'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['utils/**/*.ts', 'types.ts'],
      exclude: ['**/*.test.ts', '**/*.test.tsx', 'node_modules'],
    },
    setupFiles: ['./vitest.setup.ts'],
  },
});