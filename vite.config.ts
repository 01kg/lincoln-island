import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const runtimeProcess = (globalThis as typeof globalThis & {
  process?: { env?: Record<string, string | undefined> };
}).process;
const buildId = runtimeProcess?.env?.VITE_BUILD_ID ?? 'source-local';

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'lincoln-build-id',
      transformIndexHtml(html) {
        return html.replace(
          '</head>',
          `  <meta name="lincoln-build-id" content="${buildId}" />\n</head>`,
        );
      },
    },
  ],
  // Vite replaces this at transform/build time; the browser never invokes Git.
  define: {
    __LINCOLN_BUILD_ID__: JSON.stringify(buildId),
  },
  // Docker mounts the source tree read-only; keep Vite's optimizer cache outside it.
  cacheDir: runtimeProcess?.env?.VITE_CACHE_DIR ?? '.vite-cache',
  server: {
    // Development HTML and modules must always be revalidated. This does not
    // prescribe a cache policy for a future production host.
    headers: {
      'Cache-Control': 'no-store, max-age=0',
    },
    watch: {
      usePolling: true,
      interval: 300,
    },
  },
  build: {
    outDir: runtimeProcess?.env?.VITE_OUT_DIR ?? 'dist',
  },
});
