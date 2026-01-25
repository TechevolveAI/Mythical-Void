import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 8080,
    open: true
  },
  preview: {
    port: 8080,
    open: true
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    // Use esbuild for minification (Vite's default)
    // Terser's aggressive optimization was causing issues with Phaser's Color class
    minify: 'esbuild',
    // Split chunks for better caching
    rollupOptions: {
      output: {
        chunkFileNames: 'assets/[hash].js',
        entryFileNames: 'assets/[hash].js',
        assetFileNames: 'assets/[hash].[ext]'
      }
    }
  }
});
