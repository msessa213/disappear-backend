Set-Content -Path frontend/vite.config.js -Value 'import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"

export default defineConfig({
  plugins: [react()],
})'