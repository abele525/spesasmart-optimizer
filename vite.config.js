import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/icon.svg'],
      manifest: {
        name: 'SpesaSmart Optimizer',
        short_name: 'SpesaSmart',
        description: 'Ottimizza la tua spesa: percorso, costo carburante e prezzi migliori',
        theme_color: '#059669',
        background_color: '#ffffff',
        display: 'standalone',
        start_url: '/',
        orientation: 'portrait',
        categories: ['shopping', 'utilities'],
        icons: [
          {
            src: '/icons/icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,ico,woff2}'],
        runtimeCaching: [
          {
            // Google Maps tiles e API — network first, fallback cache
            urlPattern: /^https:\/\/maps\.googleapis\.com\/.*/i,
            handler: 'NetworkFirst',
            options: { cacheName: 'google-maps', expiration: { maxEntries: 50, maxAgeSeconds: 3600 } },
          },
          {
            // Open Food Facts — stale while revalidate
            urlPattern: /^https:\/\/world\.openfoodfacts\.org\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'openfoodfacts', expiration: { maxEntries: 200, maxAgeSeconds: 86400 } },
          },
        ],
      },
    }),
  ],
  server: {
    port: 3000,
    open: true,
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react':    ['react', 'react-dom', 'react-router-dom'],
          'vendor-firebase': ['firebase/app', 'firebase/auth', 'firebase/firestore', 'firebase/functions'],
          'vendor-maps':     ['@react-google-maps/api'],
          'vendor-ui':       ['lucide-react', 'react-hot-toast'],
          'vendor-zxing':    ['@zxing/browser'],
        },
      },
    },
  },
});
