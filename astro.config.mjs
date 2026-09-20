import { defineConfig } from 'astro/config';

export default defineConfig({
  server: {
    host: '0.0.0.0',
    port: 4321,
  },
  vite: {
    server: {
      proxy: {
        '/api': 'http://127.0.0.1:3000',
      },
    },
  },
});
