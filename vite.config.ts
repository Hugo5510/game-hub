import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

/** Content hash of the Głębia data: changes the URL whenever the questions change, so no cached copy is reused. */
const depthVersion = createHash('sha256').update(readFileSync(new URL('./public/data/depth.json', import.meta.url))).digest('hex').slice(0, 10);

export default defineConfig({
  base: './',
  define: { __DEPTH_VERSION__: JSON.stringify(depthVersion) },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png'],
      manifest: {
        name: 'Game Hub — zagadki dnia',
        short_name: 'Game Hub',
        description: 'Siedem codziennych zagadek: Słówko, Globus, Kontur, Głębia, Epoka, Flagi, Kronika.',
        lang: 'pl',
        theme_color: '#1d1c1a',
        background_color: '#f3f0e8',
        display: 'standalone',
        start_url: './',
        scope: './',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.includes('/data/'),
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'gamehub-data', expiration: { maxEntries: 80 } },
          },
        ],
      },
    }),
  ],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
