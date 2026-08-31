import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { defineConfig, type ServerOptions } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

const certFile = path.resolve(import.meta.dirname, '192.168.1.90+1.pem')
const keyFile = path.resolve(import.meta.dirname, '192.168.1.90+1-key.pem')

function getLanIPv4(): string | null {
  const interfaces = os.networkInterfaces()
  for (const entries of Object.values(interfaces)) {
    for (const entry of entries || []) {
      const family = String(entry.family)
      if ((family === 'IPv4' || family === '4') && !entry.internal) {
        return entry.address
      }
    }
  }
  return null
}

function loadHttpsConfig(): NonNullable<ServerOptions['https']> {
  if (!fs.existsSync(certFile) || !fs.existsSync(keyFile)) {
    throw new Error(
      [
        '[vite] HTTPS certificates not found.',
        `Expected: ${certFile}`,
        `          ${keyFile}`,
      ].join('\n'),
    )
  }

  return {
    cert: fs.readFileSync(certFile),
    key: fs.readFileSync(keyFile),
  }
}

const https = loadHttpsConfig()
const lanIP = getLanIPv4()
const apiProxy: ServerOptions['proxy'] = {
  '/api': {
    target: 'http://127.0.0.1:8001',
    changeOrigin: true,
  },
}

const lanListen: Pick<ServerOptions, 'host' | 'allowedHosts' | 'proxy' | 'https'> = {
  host: true,
  allowedHosts: true,
  proxy: apiProxy,
  https,
}

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: false,
      includeAssets: [
        'favicon.svg',
        'favicon-32x32.png',
        'apple-touch-icon.png',
        'pwa-192x192.png',
        'pwa-512x512.png',
        'pwa-512x512-maskable.png',
      ],
      manifest: {
        id: '/',
        name: 'Doctor Clinic',
        short_name: 'Doctor Clinic',
        description: 'Clinic management for doctors and reception staff.',
        theme_color: '#2563eb',
        background_color: '#f8fafc',
        display: 'standalone',
        orientation: 'portrait-primary',
        start_url: '/',
        scope: '/',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: 'pwa-512x512-maskable.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
        navigateFallback: 'index.html',
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/api/'),
            handler: 'NetworkOnly',
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  define: {
    __VITE_LAN_IP__: JSON.stringify(lanIP || ''),
    __VITE_HTTPS__: JSON.stringify(true),
  },
  server: {
    ...lanListen,
    port: 5173,
    strictPort: true,
  },
  preview: {
    ...lanListen,
    port: 4173,
    strictPort: true,
  },
})
