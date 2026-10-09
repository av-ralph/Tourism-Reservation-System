import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3001',
        configure(proxy) {
          proxy.on('error', (_error, _request, response) => {
            if ('writeHead' in response && !response.headersSent && !response.writableEnded) {
              response.writeHead(502, { 'Content-Type': 'application/json' })
              response.end(JSON.stringify({ message: 'The reservation service is temporarily unavailable. Please try again shortly.' }))
            }
          })
        },
      },
    },
  },
})
