import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/postcss';
import { fileURLToPath } from 'node:url';
export default defineConfig({
  root: fileURLToPath(new URL('./static-client', import.meta.url)),
  base: '/ml-research-navigator/',
  publicDir: fileURLToPath(new URL('./public', import.meta.url)),
  resolve: {
    alias: { '@': fileURLToPath(new URL('.', import.meta.url)) },
    dedupe: ['react', 'react-dom'],
  },
  css: { postcss: { plugins: [tailwindcss()] } },
  plugins: [react()],
  build: { outDir: '../pages-dist', emptyOutDir: true, target: 'es2022' },
});
