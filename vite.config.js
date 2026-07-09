import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    open: false,
    host: '0.0.0.0',
    allowedHosts: 'all', // required for Replit preview proxy
    // dev server proxies API + websocket to the game server (npm start, port 5000)
    proxy: {
      '/api': 'http://localhost:5000',
      '/ws': { target: 'ws://localhost:5000', ws: true },
    },
  },
});
