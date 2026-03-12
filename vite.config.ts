import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    open: true,
  },
  optimizeDeps: {
    include: ['zustand', 'kiwi.js', 'react-draggable']
  }
})
