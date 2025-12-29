/**
 * Storage Adapter for FAP-AIO Userscript
 * Abstracts GM_setValue/GM_getValue with automatic key prefixing and localStorage fallback
 */

/// <reference path="../types/tampermonkey.d.ts" />

type StorageValue = string | number | boolean | object | null;

interface StorageAdapter {
  get<T = StorageValue>(key: string): T | null;
  set<T = StorageValue>(key: string, value: T): void;
  remove(key: string): void;
  clear(): void;
  isExpired(key: string): boolean;
}

class GMStorageAdapter implements StorageAdapter {
  private readonly prefix = 'fap-aio:';
  private readonly useGM: boolean;

  constructor() {
    // Check if GM_setValue is available
    this.useGM = typeof GM_setValue !== 'undefined';
    
    if (!this.useGM) {
      console.warn('[FAP-AIO Storage] GM storage not available, falling back to localStorage');
    } else {
      console.info('[FAP-AIO Storage] Using GM storage');
    }
  }

  /**
   * Get value from storage
   * @param key - Simple key name (prefix added automatically)
   */
  get<T>(key: string): T | null {
    const fullKey = this.prefix + key;
    
    try {
      let item: string | null;
      
      if (this.useGM) {
        item = GM_getValue(fullKey, null);
      } else {
        item = localStorage.getItem(fullKey);
      }
      
      if (!item) {
        return null;
      }
      
      return JSON.parse(item) as T;
    } catch (e) {
      console.error('[FAP-AIO Storage] Error getting key:', key, e);
      return null;
    }
  }

  /**
   * Set value in storage
   * @param key - Simple key name (prefix added automatically)
   * @param value - Value to store (will be JSON serialized)
   */
  set<T>(key: string, value: T): void {
    const fullKey = this.prefix + key;
    
    try {
      const serialized = JSON.stringify(value);
      
      if (this.useGM) {
        GM_setValue(fullKey, serialized);
      } else {
        localStorage.setItem(fullKey, serialized);
      }
    } catch (e) {
      console.error('[FAP-AIO Storage] Error setting key:', key, e);
    }
  }

  /**
   * Remove value from storage
   * @param key - Simple key name (prefix added automatically)
   */
  remove(key: string): void {
    const fullKey = this.prefix + key;
    
    try {
      if (this.useGM) {
        GM_deleteValue(fullKey);
      } else {
        localStorage.removeItem(fullKey);
      }
    } catch (e) {
      console.error('[FAP-AIO Storage] Error removing key:', key, e);
    }
  }

  /**
   * Clear all keys with our prefix
   */
  clear(): void {
    try {
      if (this.useGM) {
        // GM doesn't have listValues in older versions, so we track known keys
        const knownKeys = [
          'examSchedule',
          'weeklySchedule',
          'semesterSyncState',
          'selectedSemester',
          'pendingSemesterSync',
          'gpaConfig',
          'moveoutCache',
        ];
        
        knownKeys.forEach(key => this.remove(key));
      } else {
        // localStorage: iterate and remove all keys with our prefix
        Object.keys(localStorage).forEach(key => {
          if (key.startsWith(this.prefix)) {
            localStorage.removeItem(key);
          }
        });
      }
    } catch (e) {
      console.error('[FAP-AIO Storage] Error clearing storage:', e);
    }
  }

  /**
   * Check if a stored value has expired
   * @param key - Simple key name (prefix added automatically)
   */
  isExpired(key: string): boolean {
    try {
      const data = this.get<{ timestamp: number; expiry?: number }>(key);
      
      if (!data || !data.timestamp || !data.expiry) {
        return false;
      }
      
      return Date.now() - data.timestamp > data.expiry;
    } catch (e) {
      console.error('[FAP-AIO Storage] Error checking expiration for key:', key, e);
      return false;
    }
  }
}

// Export singleton instance
export const storage = new GMStorageAdapter();
