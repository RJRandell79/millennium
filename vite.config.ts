import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

// `npm run build:single` produces one self-contained index.html (used for the hosted playable build).
export default defineConfig(({ mode }) => ({
  plugins: mode === 'single' ? [react(), viteSingleFile()] : [react()],
  base: './',
  build: { outDir: mode === 'single' ? 'dist-single' : 'dist' },
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // Balance experiments are slow and print reports rather than assert: run with `npm run experiment`.
    exclude: process.env.EXPERIMENT ? [] : ['tests/**/*.experiment.test.ts'],
  },
}));
