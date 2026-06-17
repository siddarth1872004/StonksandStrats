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
          // three.js + react-three live in their OWN chunk so they stay lazy
          // (only the dynamically-imported Board3D pulls them in). Must come
          // before the generic `react` rule, since @react-three matches it.
          if (id.includes('three') || id.includes('@react-three')) return 'three3d'
          if (id.includes('@supabase')) return 'supabase'
          if (id.includes('react')) return 'react-vendor'
          return 'vendor'
        },
      },
    },
  },
})
