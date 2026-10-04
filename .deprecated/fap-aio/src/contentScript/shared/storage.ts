const PREFIX = 'fap-aio:';

export interface StorageItem<T> {
  value: T;
  expiry?: number;
}

export const storage = {
  set: <T>(key: string, value: T, ttlInMinutes?: number) => {
    const item: StorageItem<T> = { value };
    if (ttlInMinutes) {
      item.expiry = Date.now() + ttlInMinutes * 60 * 1000;
    }
    localStorage.setItem(PREFIX + key, JSON.stringify(item));
  },

  get: <T>(key: string): T | null => {
    const itemStr = localStorage.getItem(PREFIX + key);
    if (!itemStr) return null;

    try {
      const item: StorageItem<T> = JSON.parse(itemStr);
      if (item.expiry && Date.now() > item.expiry) {
        localStorage.removeItem(PREFIX + key);
        return null;
      }
      return item.value;
    } catch (e) {
      console.error('Error parsing storage item', e);
      return null;
    }
  },

  // Raw methods for direct localStorage access (for backward compatibility)
  getRaw: (key: string): string | null => {
    return localStorage.getItem(key);
  },

  setRaw: (key: string, value: string): void => {
    localStorage.setItem(key, value);
  },

  remove: (key: string) => {
    localStorage.removeItem(PREFIX + key);
  },

  removeRaw: (key: string) => {
    localStorage.removeItem(key);
  },

  clear: () => {
    Object.keys(localStorage).forEach((key) => {
      if (key.startsWith(PREFIX)) {
        localStorage.removeItem(key);
      }
    });
  },
  
  isExpired: (key: string): boolean => {
      const itemStr = localStorage.getItem(PREFIX + key);
      if (!itemStr) return true;
      try {
          const item: StorageItem<any> = JSON.parse(itemStr);
          if (item.expiry && Date.now() > item.expiry) {
              return true;
          }
          return false;
      } catch {
          return true;
      }
  },

  // Helper to set expiry timestamp
  setExpiry: (key: string, durationMs: number): void => {
    localStorage.setItem(key, (Date.now() + durationMs).toString());
  },

  // Helper to get expiry timestamp
  getExpiry: (key: string): number | null => {
    const value = localStorage.getItem(key);
    return value ? Number(value) : null;
  }
};
