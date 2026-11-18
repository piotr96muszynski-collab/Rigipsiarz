import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// GitHub Pages serwuje aplikację pod /Rigipsiarz/ — base ustawiamy przez zmienną w CI.
const base = process.env.BASE_PATH ?? '/';

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['icon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Rigipsiarz – planer suchej zabudowy',
        short_name: 'Rigipsiarz',
        description: 'Planowanie ścian i sufitów g-k oraz wyliczanie materiałów. Działa offline.',
        lang: 'pl',
        theme_color: '#1f2a37',
        background_color: '#f4f5f7',
        display: 'standalone',
        orientation: 'any',
        start_url: '.',
        scope: '.',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
      },
    }),
  ],
  // three.js (~600 kB) ładuje się osobno, tylko w widoku 3D, i trafia do pamięci offline
  build: { chunkSizeWarningLimit: 700 },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
