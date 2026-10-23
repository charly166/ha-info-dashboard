import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';

/** Baut das Dashboard als einzelne JS-Datei, die die Integration ausliefert. */
export default defineConfig({
  plugins: [preact()],
  publicDir: false,
  define: { 'process.env.NODE_ENV': '"production"' },
  build: {
    outDir: 'custom_components/ha_info_dashboard/static',
    emptyOutDir: true,
    lib: {
      entry: 'src/panel.tsx',
      formats: ['iife'],
      name: 'HaInfoDashboard',
      fileName: () => 'ha-info-dashboard.js',
    },
  },
});
