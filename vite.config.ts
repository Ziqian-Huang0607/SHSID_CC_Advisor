import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    vueDevTools(),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    },
  },

  // --- ADD THIS 'server' BLOCK ---
  server: {
    // This allows your computer to be accessible from the network.
    // It's required for tunneling services like ngrok.
    host: true,

    // This ensures Hot Module Replacement (HMR) works correctly through the tunnel.
    hmr: {
      host: 'localhost',
    },
    
    // This setting can help in certain environments (like WSL or Docker)
    // where file change detection might not work properly.
    watch: {
      usePolling: true,
    },

    // This is the most important part: it tells Vite to allow
    // requests from any ngrok subdomain. The '.' at the start is a wildcard.
    allowedHosts: ['.ngrok-free.app'],
  },
  // --- END OF NEW BLOCK ---
})