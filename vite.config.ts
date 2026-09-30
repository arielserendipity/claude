import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// ANTHROPIC_API_KEY는 server.ts에서만 쓰므로 브라우저 번들에 넣지 않는다.
export default defineConfig({
  server: {
    port: 3000,
    host: '0.0.0.0',
  },
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
});
