/**
 * Storage Facade for FAP-AIO Userscript
 * 
 * Matches the extension's shared storage interface exactly while using GM APIs internally.
 * This facade is injected via Vite build-time alias when extension features import storage.
 * 
 * Build-time substitution:
 *   Extension import: import { storage } from '@/contentScript/shared/storage'
 *   Vite redirects to: userscript/fap-aio/src/facades/storage.facade.ts
 * 
 * Interface compatibility:
 *   - set<T>(key, value, ttlInMinutes?) - Wraps value in StorageItem<T>
 *   - get<T>(key) - Unwraps StorageItem<T> and checks expiry
 *   - getRaw/setRaw - Bypass wrapper for backward compatibility
 *   - All other methods match extension exactly
 */

import { storage as gmAdapter } from '../adapters/storage.adapter';

/**
 * Storage item wrapper matching extension format
 */
export interface StorageItem<T> {
  value: T;
  expiry?: number;
}

/**
 * Storage facade matching extension's shared/storage.ts interface
 */
export const storage = {
  /**
   * Set value in storage with optional TTL
   * Wraps value in StorageItem<T> format matching extension
   * 
   * @param key - Storage key (prefix added automatically by adapter)
   * @param value - Value to store
   * @param ttlInMinutes - Optional TTL in minutes
   */
  set: <T>(key: string, value: T, ttlInMinutes?: number): void => {
    const item: StorageItem<T> = { value };
    
    if (ttlInMinutes) {
      item.expiry = Date.now() + ttlInMinutes * 60 * 1000;
    }
    
    gmAdapter.set(key, item);
  },

  /**
   * Get value from storage with expiry checking
   * Unwraps StorageItem<T> and returns value
   * 
   * @param key - Storage key
   * @returns Unwrapped value or null if expired/not found
   */
  get: <T>(key: string): T | null => {
    const item = gmAdapter.get<StorageItem<T>>(key);
    
    if (!item) {
      return null;
    }
    
    // Check expiry (same logic as extension)
    if (item.expiry && Date.now() > item.expiry) {
      gmAdapter.remove(key);
      return null;
    }
    
    return item.value;
  },

  /**
   * Get raw value WITHOUT StorageItem wrapper
   * Used for backward compatibility (e.g., MoveOut caching)
   * 
   * @param key - Storage key
   * @returns Raw string value or null
   */
  getRaw: (key: string): string | null => {
    return gmAdapter.get<string>(key);
  },

  /**
   * Set raw value WITHOUT StorageItem wrapper
   * Used for backward compatibility (e.g., MoveOut caching)
   * 
   * @param key - Storage key
   * @param value - Raw string value
   */
  setRaw: (key: string, value: string): void => {
    gmAdapter.set(key, value);
  },

  /**
   * Remove value from storage
   * 
   * @param key - Storage key
   */
  remove: (key: string): void => {
    gmAdapter.remove(key);
  },

  /**
   * Remove raw value (alias for remove)
   * 
   * @param key - Storage key
   */
  removeRaw: (key: string): void => {
    gmAdapter.remove(key);
  },

  /**
   * Clear all storage keys with fap-aio prefix
   */
  clear: (): void => {
    gmAdapter.clear();
  },

  /**
   * Check if a stored value has expired
   * 
   * @param key - Storage key
   * @returns true if expired or not found
   */
  isExpired: (key: string): boolean => {
    const item = gmAdapter.get<StorageItem<any>>(key);
    
    if (!item) {
      return true;
    }
    
    return item.expiry ? Date.now() > item.expiry : false;
  },

  /**
   * Set expiry timestamp for a key
   * Stores the expiry as a raw timestamp value
   * 
   * @param key - Storage key
   * @param durationMs - Duration in milliseconds
   */
  setExpiry: (key: string, durationMs: number): void => {
    gmAdapter.set(key, (Date.now() + durationMs).toString());
  },

  /**
   * Get expiry timestamp for a key
   * 
   * @param key - Storage key
   * @returns Expiry timestamp or null
   */
  getExpiry: (key: string): number | null => {
    const value = gmAdapter.get<string>(key);
    return value ? Number(value) : null;
  }
};

console.log('[FAP-AIO] Storage facade loaded (GM-backed)');
