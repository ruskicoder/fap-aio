/**
 * Fetch API Polyfill for FAP-AIO Userscript
 * 
 * Replaces global fetch() with GM_xmlhttpRequest wrapper
 * Returns Response-compatible objects matching native fetch API
 * 
 * Injected in main.ts BEFORE any features load:
 *   globalThis.fetch = createFetchPolyfill();
 * 
 * Features use fetch() normally, internally uses GM_xmlhttpRequest for CORS bypass
 */

import { http } from '../adapters/http.adapter';

/**
 * Create fetch polyfill function that matches native fetch signature
 * 
 * @returns Polyfilled fetch function using GM_xmlhttpRequest
 */
export function createFetchPolyfill(): typeof fetch {
  return async function polyfillFetch(
    input: RequestInfo | URL,
    init?: RequestInit
  ): Promise<Response> {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    const method = (init?.method?.toUpperCase() || 'GET') as 'GET' | 'POST' | 'PUT' | 'DELETE';
    
    try {
      const result = await http.request({
        method,
        url,
        headers: init?.headers as Record<string, string> | undefined,
        data: init?.body
      });

      // Create Response-compatible object
      const responseHeaders = new Headers(result.headers || {});
      
      const response: Response = {
        ok: result.status >= 200 && result.status < 300,
        status: result.status,
        statusText: result.statusText || '',
        headers: responseHeaders,
        url,
        type: 'basic',
        redirected: false,
        body: null,
        bodyUsed: false,
        
        // Response body methods
        async json() {
          try {
            return JSON.parse(result.data);
          } catch (e) {
            throw new Error(`Failed to parse JSON: ${e}`);
          }
        },
        
        async text() {
          return result.data;
        },
        
        async blob() {
          return new Blob([result.data]);
        },
        
        async arrayBuffer() {
          return new TextEncoder().encode(result.data).buffer;
        },
        
        async formData() {
          throw new Error('formData() not supported in fetch polyfill');
        },
        
        async bytes() {
          return new TextEncoder().encode(result.data);
        },
        
        clone() {
          // Return the same response object (simplified implementation)
          return this;
        }
      } as Response;

      return response;
      
    } catch (error) {
      console.error('[FAP-AIO Fetch Polyfill] Request failed:', error);
      
      // Create error response
      return {
        ok: false,
        status: 0,
        statusText: 'Network Error',
        headers: new Headers(),
        url,
        type: 'basic',
        redirected: false,
        body: null,
        bodyUsed: false,
        
        async json() { throw new Error('Network request failed'); },
        async text() { throw new Error('Network request failed'); },
        async blob() { throw new Error('Network request failed'); },
        async arrayBuffer() { throw new Error('Network request failed'); },
        async formData() { throw new Error('formData() not supported'); },
        async bytes() { throw new Error('Network request failed'); },
        
        clone() { return this; }
      } as Response;
    }
  };
}

console.log('[FAP-AIO] Fetch polyfill module loaded');
