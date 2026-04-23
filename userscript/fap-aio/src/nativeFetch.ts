/**
 * Native Fetch Preservation Module
 * 
 * Captures the original browser fetch() before the polyfill replaces it.
 * MoveOut module needs native fetch for same-origin FAP requests because:
 * - GM_xmlhttpRequest doesn't properly handle cookies/credentials
 * - FormData serialization differs from native fetch
 * - Redirect handling (response.redirected) isn't supported by polyfill
 */

export const nativeFetch: typeof fetch = globalThis.fetch.bind(globalThis);
