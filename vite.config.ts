import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'

function loadConfig() {
  try {
    return JSON.parse(fs.readFileSync(path.resolve(__dirname, 'config.json'), 'utf-8'))
  } catch {
    return {}
  }
}

const config = loadConfig()
const vitePort = config?.vite?.port ?? 5173
const serverPort = config?.server?.port ?? 3001

export default defineConfig({
  plugins: [react()],
  server: {
    port: vitePort,
    proxy: {
      '/api': {
        target: `http://localhost:${serverPort}`,
        changeOrigin: true
      }
    }
  }
})
