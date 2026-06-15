import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        // Split large, stable vendor code out of the main app chunk so the
        // initial download is smaller and better cached across deploys.
        manualChunks(id) {
          if (!id.includes('node_modules')) return
          if (id.includes('@supabase')) return 'supabase'
          if (id.includes('react')) return 'react-vendor'
          return 'vendor'
        },
      },
    },
  },
})
