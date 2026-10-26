import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '127.0.0.1', port: 5174, strictPort: true,
    proxy: { '/api/rooms': { target: 'http://127.0.0.1:3001', ws: true } },
    // Raw art/dictionaries can be locked while copied or edited on Windows.
    // Generated runtime files in src/public still receive normal HMR.
    watch: { ignored: ['**/zoombie1/**', '**/new_asset/**', '**/Dic/**', '**/Sound/**', '**/assets/**', '**/*.csv', '**/*.aseprite', '**/*.zip'] },
  },
  build: { chunkSizeWarningLimit: 1800 },
});
