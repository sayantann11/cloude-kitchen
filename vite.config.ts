import preact from '@preact/preset-vite';
import type { Connect, Plugin } from 'vite';
import { defineConfig } from 'vitest/config';

/** /admin and /admin/* serve admin.html (same as firebase.json rewrites) in dev and preview. */
const adminPage = (): Plugin => {
  const rewrite: Connect.NextHandleFunction = (req, _res, next) => {
    const u = req.url ?? '';
    if (/^\/admin(\/[^.]*)?(\?.*)?$/.test(u)) req.url = '/admin.html';
    next();
  };
  return {
    name: 'admin-page',
    configureServer(s) { s.middlewares.use(rewrite); },
    configurePreviewServer(s) { s.middlewares.use(rewrite); },
  };
};

export default defineConfig({
  plugins: [preact(), adminPage()],
  build: {
    target: 'es2020',
    cssCodeSplit: true,
    sourcemap: false,
    chunkSizeWarningLimit: 600, // firebase SDK (lazy, cached)
    rollupOptions: {
      input: { main: 'index.html', admin: 'admin.html' },
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/firebase') || id.includes('node_modules/@firebase')) return 'firebase';
          if (id.includes('node_modules/leaflet')) return 'leaflet';
        },
      },
    },
  },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
