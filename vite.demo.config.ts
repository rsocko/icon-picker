import { resolve } from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  root: resolve(import.meta.dirname, 'demo'),
  base: '/icon-picker/',
  plugins: [react()],
  build: {
    outDir: resolve(import.meta.dirname, 'demo-dist'),
    emptyOutDir: true,
  },
});
