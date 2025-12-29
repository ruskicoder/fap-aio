/**
 * HTTP Adapter for FAP-AIO Userscript
 * Abstracts GM_xmlhttpRequest with auto-detection and fetch fallback
 */

/// <reference path="../types/tampermonkey.d.ts" />

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  headers?: Record<string, string>;
  data?: any; // Changed from body to data, accepts any type
  timeout?: number;
}

interface Response<T = any> {
  data: T;
  status: number;
  statusText: string;
  headers: Record<string, string>;
}

class HTTPAdapter {
  private readonly useGM: boolean;

  constructor() {
    this.useGM = typeof GM_xmlhttpRequest !== 'undefined';
    
    if (!this.useGM) {
      console.warn('[FAP-AIO HTTP] GM_xmlhttpRequest not available, using fetch (CORS limited)');
    } else {
      console.info('[FAP-AIO HTTP] Using GM_xmlhttpRequest');
    }
  }

  /**
   * Prepare request data and auto-detect Content-Type
   * Handles FormData, URLSearchParams, objects, and strings
   */
  private prepareRequestData(data: any, headers: Record<string, string>): { data: string; headers: Record<string, string> } {
    const preparedHeaders = { ...headers };

    if (!data) {
      return { data: '', headers: preparedHeaders };
    }

    // Auto-detect FormData (browser FormData object)
    if (typeof FormData !== 'undefined' && data instanceof FormData) {
      // Let browser handle FormData serialization
      // Note: GM_xmlhttpRequest may not support FormData directly, convert to URLSearchParams
      const params = new URLSearchParams();
      for (const [key, value] of data.entries()) {
        params.append(key, value as string);
      }
      if (!preparedHeaders['content-type']) {
        preparedHeaders['content-type'] = 'application/x-www-form-urlencoded';
      }
      return { data: params.toString(), headers: preparedHeaders };
    }

    // Auto-detect URLSearchParams
    if (typeof URLSearchParams !== 'undefined' && data instanceof URLSearchParams) {
      if (!preparedHeaders['content-type']) {
        preparedHeaders['content-type'] = 'application/x-www-form-urlencoded';
      }
      return { data: data.toString(), headers: preparedHeaders };
    }

    // Auto-detect plain objects (serialize to JSON or form-urlencoded)
    if (typeof data === 'object' && data !== null) {
      // Default to JSON for objects
      if (!preparedHeaders['content-type']) {
        preparedHeaders['content-type'] = 'application/json';
      }
      
      if (preparedHeaders['content-type'].includes('application/json')) {
        return { data: JSON.stringify(data), headers: preparedHeaders };
      } else if (preparedHeaders['content-type'].includes('application/x-www-form-urlencoded')) {
        // Convert object to URLSearchParams
        const params = new URLSearchParams();
        Object.entries(data).forEach(([key, value]) => {
          params.append(key, String(value));
        });
        return { data: params.toString(), headers: preparedHeaders };
      }
    }

    // Already a string, use as-is
    return { data: String(data), headers: preparedHeaders };
  }

  /**
   * Make HTTP request with auto-detection of response type
   */
  async request<T = any>(options: { method?: 'GET' | 'POST' | 'PUT' | 'DELETE'; url: string; headers?: Record<string, string>; data?: any; timeout?: number }): Promise<Response<T>> {
    if (this.useGM) {
      return this.gmRequest<T>(options);
    } else {
      return this.fetchRequest<T>(options);
    }
  }

  /**
   * GM_xmlhttpRequest implementation with auto-detection
   */
  private gmRequest<T>(options: { method?: 'GET' | 'POST' | 'PUT' | 'DELETE'; url: string; headers?: Record<string, string>; data?: any; timeout?: number }): Promise<Response<T>> {
    return new Promise((resolve, reject) => {
      // Prepare data with auto-detected Content-Type
      const { data, headers } = this.prepareRequestData(options.data, options.headers || {});

      GM_xmlhttpRequest({
        method: options.method || 'GET',
        url: options.url,
        headers,
        data,
        timeout: options.timeout || 30000,
        onload: (response) => {
          try {
            // Auto-detect response type from Content-Type header
            const contentType = this.parseHeaders(response.responseHeaders)['content-type'] || '';
            let responseData: any;
            
            if (contentType.includes('application/json')) {
              // Parse JSON
              responseData = JSON.parse(response.responseText);
            } else if (response.responseText.trim().startsWith('{') || response.responseText.trim().startsWith('[')) {
              // Looks like JSON but wrong Content-Type, try parsing
              try {
                responseData = JSON.parse(response.responseText);
              } catch {
                responseData = response.responseText;
              }
            } else {
              // Return as text/HTML
              responseData = response.responseText;
            }
            
            resolve({
              data: responseData as T,
              status: response.status,
              statusText: response.statusText,
              headers: this.parseHeaders(response.responseHeaders),
            });
          } catch (e) {
            console.error('[FAP-AIO HTTP] Failed to parse response:', e);
            reject(new Error(`Failed to parse response: ${(e as Error).message}`));
          }
        },
        onerror: (error) => {
          console.error('[FAP-AIO HTTP] Request failed:', error);
          reject(new Error(`Request failed: ${error.statusText || 'Unknown error'}`));
        },
        ontimeout: () => {
          console.error('[FAP-AIO HTTP] Request timeout');
          reject(new Error('Request timeout'));
        },
      });
    });
  }

  /**
   * Fetch fallback implementation
   */
  private async fetchRequest<T>(options: { method?: 'GET' | 'POST' | 'PUT' | 'DELETE'; url: string; headers?: Record<string, string>; data?: any; timeout?: number }): Promise<Response<T>> {
    try {
      // Prepare data with auto-detected Content-Type
      const { data: preparedData, headers } = this.prepareRequestData(options.data, options.headers || {});

      const response = await fetch(options.url, {
        method: options.method || 'GET',
        headers,
        body: preparedData || undefined,
      });

      // Auto-detect response type from Content-Type header
      const contentType = response.headers.get('content-type') || '';
      let data: any;
      
      if (contentType.includes('application/json')) {
        data = await response.json();
      } else {
        data = await response.text();
      }

      return {
        data: data as T,
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
      };
    } catch (e) {
      console.error('[FAP-AIO HTTP] Fetch request failed:', e);
      throw new Error(`Fetch request failed: ${(e as Error).message}`);
    }
  }

  /**
   * Parse GM response headers into object
   */
  private parseHeaders(headersString: string): Record<string, string> {
    const headers: Record<string, string> = {};
    
    headersString.split('\r\n').forEach(line => {
      const separatorIndex = line.indexOf(': ');
      if (separatorIndex > 0) {
        const key = line.substring(0, separatorIndex);
        const value = line.substring(separatorIndex + 2);
        if (key && value) {
          headers[key.toLowerCase()] = value;
        }
      }
    });
    
    return headers;
  }

  /**
   * GET request convenience method
   */
  async get<T = any>(url: string, options?: RequestOptions): Promise<Response<T>> {
    return this.request<T>({ url, ...options, method: 'GET' });
  }

  /**
   * POST request convenience method
   */
  async post<T = any>(url: string, body: string | FormData, options?: RequestOptions): Promise<Response<T>> {
    return this.request<T>({ url, ...options, method: 'POST', data: body });
  }
}

// Export singleton instance
export const http = new HTTPAdapter();
