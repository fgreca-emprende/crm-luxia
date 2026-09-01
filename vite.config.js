import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    include: ['dompurify', '@supabase/supabase-js', 'react', 'react-dom']
  },
  build: {
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('react') || id.includes('react-dom')) {
              return 'vendor';
            }
            if (id.includes('@supabase')) {
              return 'supabase-vendor';
            }
            if (id.includes('bootstrap') || id.includes('recharts')) {
              return id.includes('recharts') ? 'charts' : 'ui';
            }
            if (id.includes('react-markdown')) {
              return 'markdown';
            }
            return 'modules';
          }
        }
      }
    }
  }
})
