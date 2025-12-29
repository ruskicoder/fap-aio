/**
 * Global Type Declarations for FAP-AIO Userscript
 */

/// <reference types="vite/client" />

// React global declarations (loaded from CDN)
declare const React: typeof import('react');
declare const ReactDOM: typeof import('react-dom');

// CSS module declarations for Vite
declare module '*.css' {
  const css: string;
  export default css;
}

// CSS raw imports (for style injection)
declare module '*.css?raw' {
  const css: string;
  export default css;
}
