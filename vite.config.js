import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: './',
  optimizeDeps: {
    include: ['qrcode'],
  },
  build: {
    commonjsOptions: {
      include: [/qrcode/, /node_modules/],
    },
  },
})
