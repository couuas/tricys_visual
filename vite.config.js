import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  server: {
    host: '0.0.0.0',
    open: true,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/assets': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/static': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/goview': {
        target: 'http://127.0.0.1:3020',
        changeOrigin: true,
      },
      '/hdf5': {
        target: 'http://127.0.0.1:8050',
        changeOrigin: true,
        ws: true,
      },
    },
  },
})
