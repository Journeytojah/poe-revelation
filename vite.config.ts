import { purgeCss } from 'vite-plugin-tailwind-purgecss';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  plugins: [sveltekit(), purgeCss()],
  build: {
    target: 'esnext',
  },
  worker: {
    format: 'es'
  },
  // development only
  optimizeDeps: {
    exclude: ['pathofexile-dat', 'ooz-wasm']
  },
  // development only
  server: {
    fs: {
      allow: ['..']
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
});