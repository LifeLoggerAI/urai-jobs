import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    root: 'functions',
    globals: true,
    setupFiles: ['tests/setup.ts'], // Relative to the root
    environment: 'node',
  },
});
