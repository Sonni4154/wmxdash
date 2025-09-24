/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['tests/**/*.spec.ts'],
    // Quiet down noisy logs during tests
    logHeapUsage: false,
    reporters: 'default',
  },
  resolve: {
    conditions: ['node', 'default'],
  },
});

