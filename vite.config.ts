import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const runtimeProcess = (globalThis as typeof globalThis & {
  process?: { env?: Record<string, string | undefined> };
}).process;

export default defineConfig({
  plugins: [react()],
  // Docker mounts the source tree read-only; keep Vite's optimizer cache outside it.
  cacheDir: runtimeProcess?.env?.VITE_CACHE_DIR ?? '.vite-cache',
  build: {
    outDir: runtimeProcess?.env?.VITE_OUT_DIR ?? 'dist',
  },
});
