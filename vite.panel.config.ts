import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';

/** Baut das Dashboard als einzelne JS-Datei für HACS (dist/ha-info-dashboard.js). */
export default defineConfig({
  plugins: [preact()],
  publicDir: false,
  define: { 'process.env.NODE_ENV': '"production"' },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    lib: {
      entry: 'src/panel.tsx',
      formats: ['iife'],
      name: 'HaInfoDashboard',
      fileName: () => 'ha-info-dashboard.js',
    },
  },
});
