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
    // Use Terser for better obfuscation (requires: npm install terser -D)
    minify: 'terser',
    terserOptions: {
      compress: {
        // Remove console.log in production (keep errors/warnings)
        drop_console: false,
        pure_funcs: ['console.log', 'console.debug'],
        // Dead code elimination
        dead_code: true,
        // Remove unreachable code
        unused: true
      },
      mangle: {
        // Mangle variable/function names for obfuscation
        toplevel: true,
        // Preserve class names for Phaser compatibility
        keep_classnames: true,
        // Mangle properties (careful - may break some libraries)
        properties: {
          // Only mangle properties starting with underscore (private by convention)
          regex: /^_/
        }
      },
      format: {
        // Remove comments in production
        comments: false
      }
    },
    // Split chunks for better caching
    rollupOptions: {
      output: {
        // Obfuscate chunk names
        chunkFileNames: 'assets/[hash].js',
        entryFileNames: 'assets/[hash].js',
        assetFileNames: 'assets/[hash].[ext]'
      }
    }
  }
});
