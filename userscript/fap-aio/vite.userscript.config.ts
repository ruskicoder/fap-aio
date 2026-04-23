/**
 * Vite Configuration for FAP-AIO Userscript Build
 * 
 * This configuration:
 * - Bundles all TypeScript/React code into a single .user.js file
 * - Injects userscript metadata block at the top
 * - Transforms CSS imports into inline JavaScript strings
 * - Externalizes React/ReactDOM (loaded via CDN)
 * - Uses IIFE format for scope isolation
 */

import { defineConfig, Plugin } from 'vite';
import type { NormalizedOutputOptions, OutputBundle } from 'rollup';
import path from 'path';
import fs from 'fs';
import { generateMetadataBlock, UserscriptMetadata } from './scripts/generate-metadata';

/**
 * Custom Vite Plugin: Userscript Metadata Injection
 * Prepends the metadata block to the compiled output
 */
function userscriptMetadataPlugin(): Plugin {
  return {
    name: 'userscript-metadata',
    enforce: 'post',
    generateBundle(_options: NormalizedOutputOptions, bundle: OutputBundle) {
      // Read version from package.json
      const packageJson = JSON.parse(
        fs.readFileSync(path.resolve(__dirname, 'package.json'), 'utf-8')
      );

      // Read favicon from image.txt (base64-encoded)
      let faviconData = '';
      try {
        faviconData = fs.readFileSync(path.resolve(__dirname, 'image.txt'), 'utf-8').trim();
      } catch (e) {
        console.warn('[Vite] image.txt not found, metadata will not include @icon');
      }

      // Define metadata configuration
      const metadata: UserscriptMetadata = {
        name: 'FAP-AIO Userscript',
        namespace: 'https://github.com/ruskicoder/fap-aio',
        version: packageJson.version,
        description: packageJson.description,
        author: 'ruskicoder',
        match: [
          'https://fap.fpt.edu.vn/*',
          'http://fap.fpt.edu.vn/*'
        ],
        grant: [
          'GM_setValue',
          'GM_getValue',
          'GM_deleteValue',
          'GM_addStyle',
          'GM_xmlhttpRequest',
          'GM_info'
        ],
        require: [
          'https://unpkg.com/react@18/umd/react.production.min.js',
          'https://unpkg.com/react-dom@18/umd/react-dom.production.min.js'
        ],
        connect: [
          'fap.fpt.edu.vn',
          'raw.githubusercontent.com'
        ],
        runAt: 'document-start',
        updateURL: 'https://raw.githubusercontent.com/ruskicoder/fap-aio/master/userscript/fap-aio/dist/fap-aio.user.js',
        downloadURL: 'https://raw.githubusercontent.com/ruskicoder/fap-aio/master/userscript/fap-aio/dist/fap-aio.user.js',
        homepageURL: 'https://github.com/ruskicoder/fap-aio',
        icon: faviconData || undefined
      };

      // Generate metadata block
      const metadataBlock = generateMetadataBlock(metadata);

      // Find the main output chunk
      for (const fileName in bundle) {
        const chunk = bundle[fileName];
        if (chunk.type === 'chunk' && chunk.isEntry) {
          // Prepend metadata block to the code
          chunk.code = metadataBlock + '\n\n' + chunk.code;
          console.log('[Vite] Metadata block injected into', fileName);
        }
      }
    }
  };
}

/**
 * Custom Vite Plugin: CSS to JavaScript String Transformation
 * Converts CSS imports into inline JavaScript string exports
 */
function cssToStringPlugin(): Plugin {
  return {
    name: 'css-to-string',
    enforce: 'pre',
    transform(code: string, id: string) {
      // Only process CSS files
      if (!id.endsWith('.css')) {
        return null;
      }

      console.log('[Vite] Transforming CSS to string:', id);

      // Escape backticks and backslashes for template literal
      const escapedCSS = code
        .replace(/\\/g, '\\\\')
        .replace(/`/g, '\\`')
        .replace(/\$/g, '\\$');

      // Return JavaScript module with CSS as template literal
      return {
        code: `export default \`${escapedCSS}\`;`,
        map: null
      };
    }
  };
}

/**
 * Vite Configuration
 */
export default defineConfig({
  // Define global constants (replace process.env references)
  define: {
    'process.env.NODE_ENV': JSON.stringify('production')
  },

  // Path resolution
  resolve: {
    alias: {
      // CRITICAL: Build-time module substitution for platform abstraction
      // Redirect extension's shared storage to userscript facade
      '@/contentScript/shared/storage': path.resolve(__dirname, './src/facades/storage.facade.ts'),
      
      // Redirect scheduler's local storage to userscript facade
      '@/contentScript/features/scheduler/storage': path.resolve(__dirname, './src/facades/storage.facade.ts'),
      
      // Extension features point to actual extension source (unchanged)
      '@/contentScript/features': path.resolve(__dirname, '../../fap-aio/src/contentScript/features'),
      
      // Extension shared modules (non-storage) point to extension source
      '@/contentScript/shared': path.resolve(__dirname, '../../fap-aio/src/contentScript/shared'),
      
      // Extension styles directory for CSS imports
      '@/styles': path.resolve(__dirname, '../../fap-aio/src/styles'),
      
      // Other extension imports work normally
      '@': path.resolve(__dirname, '../../fap-aio/src'),
      
      // Userscript-specific imports
      '@userscript': path.resolve(__dirname, './src'),
    }
  },

  // Build configuration
  build: {
    // Output to dist/ directory
    outDir: 'dist',
    emptyOutDir: true,

    // Library mode for userscript
    lib: {
      entry: path.resolve(__dirname, 'src/main.ts'),
      name: 'FAP_AIO', // Global variable name (not used in IIFE)
      fileName: () => 'fap-aio.user.js',
      formats: ['iife']
    },

    // Rollup options
    rollupOptions: {
      // Externalize React and ReactDOM (loaded via @require CDN)
      external: ['react', 'react-dom', 'react-dom/client'],
      output: {
        // Map externals to global variables loaded by @require
        globals: {
          react: 'React',
          'react-dom': 'ReactDOM',
          'react-dom/client': 'ReactDOM'
        },
        // Don't use 'use strict' (handled by IIFE in main.ts)
        strict: false,
        // Compact output
        compact: false,
        // No banner/footer (metadata added via plugin)
        banner: '',
        footer: '',
        // Inline all assets (no separate CSS file)
        assetFileNames: () => {
          return 'should-not-be-created.[ext]';
        }
      }
    },

    // No minification for readability
    minify: false,

    // No source maps
    sourcemap: false,

    // Target modern browsers (ES2020)
    target: 'es2020',

    // Warn on large chunks (userscript should be single file)
    chunkSizeWarningLimit: 1000
  },

  // Custom plugins
  plugins: [
    cssToStringPlugin(),
    userscriptMetadataPlugin()
  ],

  // Disable CSS code splitting - inline all CSS
  css: {
    modules: false,
    postcss: undefined
  },

  // Log level
  logLevel: 'info'
});
