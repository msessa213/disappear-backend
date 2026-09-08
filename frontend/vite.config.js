import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const buildTimestamp = Date.now();

// https://vitejs.dev/config/
export default defineConfig({
  define: {
    'import.meta.env.VITE_APP_BUILD_TIMESTAMP': JSON.stringify(buildTimestamp),
    'import.meta.env.VITE_APP_BUILD_TIME': JSON.stringify(new Date().toISOString()),
    __APP_BUILD_TIMESTAMP__: buildTimestamp,
  },
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 3000,
    watch: {
      ignored: ['**/android/**', '**/ios/**', '**/dist/**', '**/.git/**'],
    },
  },
  build: {
    emptyOutDir: true,
    rollupOptions: {
      output: {
        entryFileNames: `assets/[name]-[hash]-${buildTimestamp}.js`,
        chunkFileNames: `assets/[name]-[hash]-${buildTimestamp}.js`,
        assetFileNames: `assets/[name]-[hash]-${buildTimestamp}[extname]`
      }
    }
  }
})