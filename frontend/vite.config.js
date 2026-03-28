import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0', // Required for Docker to map the port to your browser
    port: 3000,      // Matches the port in your docker-compose.yml
    watch: {
      usePolling: true, // Ensures changes save instantly inside Docker
    },
  },
})