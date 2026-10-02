import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: '/budget00/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: [
        'favicon-32.png',
        'icons/apple-touch-icon.png',
        'icons/icon-192.png',
        'icons/icon-512.png',
        'icons/icon-maskable-512.png',
      ],
      manifest: {
        name: 'DailyCap',
        short_name: 'DailyCap',
        description: 'Kişisel ve Multinet bütçeni günlük hakla takip et.',
        lang: 'tr',
        start_url: '/budget00/',
        scope: '/budget00/',
        display: 'standalone',
        orientation: 'portrait-primary',
        background_color: '#f6f7f5',
        theme_color: '#176b52',
        icons: [
          {
            src: 'icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: 'icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: 'icons/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        cleanupOutdatedCaches: true,
        clientsClaim: false,
        skipWaiting: false,
        navigateFallback: '/budget00/index.html',
        navigateFallbackDenylist: [/^\/budget00\/deneme(?:\/|$)/],
        globIgnores: ['deneme/**', 'ocr/**'],
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webmanifest}'],
        runtimeCaching: [{
          urlPattern: ({ url, sameOrigin }) => sameOrigin && url.pathname.startsWith('/budget00/ocr/v1/'),
          handler: 'CacheFirst',
          options: {
            cacheName: 'dailycap-receipt-ocr-v1',
            cacheableResponse: { statuses: [200] },
            expiration: { maxEntries: 24, maxAgeSeconds: 31536000, purgeOnQuotaError: true },
          },
        }],
      },
    }),
  ],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
