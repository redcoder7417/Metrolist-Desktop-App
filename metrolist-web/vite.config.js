import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './',
  server: {
    proxy: {
      '/api/stream': {
        target: 'http://localhost:8091',
        changeOrigin: true,
        ws: false,
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq) => {
            proxyReq.removeHeader('accept-encoding');
          });
        },
      },
      '/api': {
        target: 'http://localhost:8091',
        changeOrigin: true,
        timeout: 60000,
        proxyTimeout: 60000,
      },
    },
  },
})

