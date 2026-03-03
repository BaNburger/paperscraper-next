import { defineConfig } from 'vite';
import tsconfigPaths from 'vite-tsconfig-paths';
import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import viteReact from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (
            id.includes('/node_modules/@trpc/') ||
            id.includes('/node_modules/zod/') ||
            id.includes('/packages/shared/src/')
          ) {
            return 'api-client';
          }
          if (
            id.includes('/node_modules/@blocknote/') ||
            id.includes('/node_modules/prosemirror-') ||
            id.includes('/node_modules/y-prosemirror/')
          ) {
            return 'editor';
          }
          if (
            id.includes('/node_modules/react/') ||
            id.includes('/node_modules/react-dom/') ||
            id.includes('/node_modules/@tanstack/react-query/') ||
            id.includes('/node_modules/@tanstack/react-router/')
          ) {
            return 'framework';
          }
          return undefined;
        },
      },
    },
  },
  plugins: [
    tsconfigPaths({ projects: ['./tsconfig.json'] }),
    tanstackStart(),
    tailwindcss(),
    viteReact(),
  ],
});
