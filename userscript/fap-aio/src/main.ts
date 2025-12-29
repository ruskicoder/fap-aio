/**
 * FAP-AIO Userscript - Main Entry Point
 * 
 * This file serves as the entry point for the userscript.
 * Execution order:
 *   1. Inject fetch polyfill (CRITICAL - must be first)
 *   2. Wait for React from CDN
 *   3. Inject styles
 *   4. Initialize router
 */

/// <reference path="./types/tampermonkey.d.ts" />

import { createFetchPolyfill } from './polyfills/fetch.polyfill';
import { initRouter } from './router';
import { styleAdapter } from './adapters/style.adapter';

// Import all CSS files as raw strings
import userstyleCSS from '@/styles/userstyle.css?raw';
import tailwindCSS from '@/styles/tailwind.css?raw';
import gpaCSS from '@/contentScript/features/gpa/style.css?raw';
import moveoutCSS from '@/contentScript/features/moveout/style.css?raw';

// Duplicate initialization guard
declare global {
  interface Window {
    __FAP_AIO_LOADED__?: boolean;
  }
}

// Debug mode flag (checked from GM storage)
let debugMode = false;

/**
 * Wait for React and ReactDOM to load from CDN
 * These are loaded via @require directives in metadata
 */
async function waitForReact(timeout = 5000): Promise<boolean> {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    if (typeof React !== 'undefined' && typeof ReactDOM !== 'undefined') {
      if (debugMode) {
        console.log('[FAP-AIO] React and ReactDOM loaded successfully');
      }
      return true;
    }
    
    // Wait 50ms before checking again
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  
  console.error('[FAP-AIO] Timeout waiting for React to load from CDN');
  return false;
}

/**
 * Main initialization function
 */
async function init(): Promise<void> {
  try {
    if (debugMode) {
      console.log('[FAP-AIO] Userscript initialization started');
      console.log('[FAP-AIO] Version:', GM_info?.script?.version || '0.0.1');
    }
    
    // Wait for React to be available from CDN
    const reactReady = await waitForReact(5000);
    if (!reactReady) {
      console.warn('[FAP-AIO] React not available, some features may not work');
      // Continue anyway - non-React features might still work
    }
    
    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
      await new Promise(resolve => {
        document.addEventListener('DOMContentLoaded', resolve, { once: true });
      });
    }
    
    if (debugMode) {
      console.log('[FAP-AIO] DOM ready, initializing router');
    }
    
    // Initialize feature router (features will use polyfilled fetch and facade storage automatically)
    initRouter();
    
    console.log('[FAP-AIO] Userscript initialized successfully');
  } catch (error) {
    console.error('[FAP-AIO] Fatal error during initialization:', error);
    // Don't throw - allow userscript to continue even if initialization partially fails
  }
}

// IIFE wrapper for scope isolation
(function() {
  'use strict';
  
  // Prevent duplicate initialization
  if (window.__FAP_AIO_LOADED__) {
    console.warn('[FAP-AIO] Userscript already loaded, skipping initialization');
    return;
  }
  
  window.__FAP_AIO_LOADED__ = true;

  // CRITICAL: Inject ALL styles FIRST to prevent white flash
  // Global styles
  styleAdapter.inject(userstyleCSS, 'userstyle');
  styleAdapter.inject(tailwindCSS, 'tailwind');
  
  // Feature-specific styles
  styleAdapter.inject(gpaCSS, 'gpa');
  styleAdapter.inject(moveoutCSS, 'moveout');
  
  console.log('[FAP-AIO] All styles injected immediately');

  // CRITICAL: Inject fetch polyfill BEFORE any features load
  // This must happen first so all fetch() calls use GM_xmlhttpRequest
  globalThis.fetch = createFetchPolyfill();
  console.log('[FAP-AIO] Fetch polyfill injected (using GM_xmlhttpRequest)');

  // Check debug mode from GM storage
  try {
    const debugValue = typeof GM_getValue !== 'undefined' ? GM_getValue('fap-aio:debug', 'false') : localStorage.getItem('fap-aio:debug');
    debugMode = debugValue === 'true' || debugValue === true;
    if (debugMode) {
      console.log('[FAP-AIO] Debug mode enabled');
    }
  } catch (e) {
    console.error('[FAP-AIO] Failed to check debug mode:', e);
  }
  
  // Start initialization
  init().catch(error => {
    console.error('[FAP-AIO] Unhandled error in init():', error);
  });
})();
