import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  server: {
    host: 'localhost',
    port: 3000,
    strictPort: false, // Allow automatic port selection if the specified port is busy
    hmr: {
      port: 24679, // Use a different port for WebSocket to avoid conflicts
    },
  },
});
