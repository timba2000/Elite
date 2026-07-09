import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    open: false,
    // dev server proxies API + websocket to the game server (npm start, port 5000)
    proxy: {
      '/api': 'http://localhost:5000',
      '/ws': { target: 'ws://localhost:5000', ws: true },
    },
  },
});
