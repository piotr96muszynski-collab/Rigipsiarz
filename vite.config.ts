import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { execSync } from 'node:child_process';

// GitHub Pages serwuje aplikację pod /Rigipsiarz/ — base ustawiamy przez zmienną w CI.
const base = process.env.BASE_PATH ?? '/';

// Numer wersji: liczba commitów (każde scalenie do main = nowe wydanie), skrót commita i jego data.
// Wydanie (deploy z main) ustawia APP_RELEASE=1; inne buildy są oznaczane jako „-dev”.
function git(cmd: string): string {
  try {
    return execSync(`git ${cmd}`, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  } catch {
    return '';
  }
}
const build = {
  build: Number(git('rev-list --count HEAD')) || 0,
  commit: git('rev-parse --short=7 HEAD'),
  date: git('log -1 --format=%cs'),
  dev: process.env.APP_RELEASE !== '1',
};

export default defineConfig({
  base,
  define: {
    __APP_BUILD__: JSON.stringify(build.build),
    __APP_COMMIT__: JSON.stringify(build.commit),
    __APP_DATE__: JSON.stringify(build.date),
    __APP_DEV__: JSON.stringify(build.dev),
  },
  plugins: [
    react(),
    // version.json obok aplikacji – komunikat o aktualizacji czyta z niego numer nowej wersji
    {
      name: 'app-version-json',
      generateBundle() {
        this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify(build) });
      },
    },
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
