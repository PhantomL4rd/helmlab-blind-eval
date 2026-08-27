import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vite';
import { blindEvalApiPlugin } from './scripts/dev-server-plugin.mjs';

// Dev-only tool: no `build` script is wired up on purpose. This never gets deployed —
// see README.md.
export default defineConfig({
  plugins: [svelte(), blindEvalApiPlugin()],
  build: {
    rollupOptions: {
      input: {
        main: 'index.html',
        analysis: 'analysis.html',
      },
    },
  },
});
