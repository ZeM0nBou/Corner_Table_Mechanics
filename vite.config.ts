import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const src = (dir: string): string => fileURLToPath(new URL(`./src/${dir}`, import.meta.url));

// https://vite.dev/config/
export default defineConfig({
  // Site publié sur https://<utilisateur>.github.io/Corner_Table_Mechanics/
  base: '/Corner_Table_Mechanics/',
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@core': src('core'),
      '@materials': src('materials'),
      '@ui': src('ui'),
      '@share': src('share'),
    },
  },
});
