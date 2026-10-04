/**
 * Style Adapter for FAP-AIO Userscript
 * Abstracts GM_addStyle with fallback to createElement
 */

/// <reference path="../types/tampermonkey.d.ts" />

class StyleAdapter {
  private readonly useGM: boolean;
  private injectedStyles: Set<string> = new Set();

  constructor() {
    this.useGM = typeof GM_addStyle !== 'undefined';
    
    if (!this.useGM) {
      console.warn('[FAP-AIO Style] GM_addStyle not available, using style elements');
    } else {
      console.info('[FAP-AIO Style] Using GM_addStyle');
    }
  }

  /**
   * Inject CSS into page
   * @param css - CSS string to inject
   * @param id - Optional ID to prevent duplicate injection
   */
  inject(css: string, id?: string): void {
    // Prevent duplicate injection
    if (id && this.injectedStyles.has(id)) {
      console.info(`[FAP-AIO Style] Style '${id}' already injected, skipping`);
      return;
    }

    try {
      console.log(`[FAP-AIO Style] Injecting style${id ? ` '${id}'` : ''} (${css.length} bytes)`);
      
      if (this.useGM) {
        GM_addStyle(css);
        console.log(`[FAP-AIO Style] Successfully injected via GM_addStyle${id ? ` '${id}'` : ''}`);
      } else {
        // Fallback: create <style> element
        const style = document.createElement('style');
        if (id) {
          style.id = `fap-aio-style-${id}`;
        }
        style.textContent = css;
        document.head.appendChild(style);
        console.log(`[FAP-AIO Style] Successfully injected via <style> element${id ? ` '${id}'` : ''}`);
      }

      if (id) {
        this.injectedStyles.add(id);
      }
    } catch (e) {
      console.error(`[FAP-AIO Style] Error injecting CSS${id ? ` '${id}'` : ''}:`, e);
    }
  }

  /**
   * Remove injected style (only works with fallback method)
   * @param id - ID of style to remove
   */
  remove(id: string): void {
    if (!this.useGM && id) {
      try {
        const style = document.getElementById(`fap-aio-style-${id}`);
        if (style) {
          style.remove();
        }
      } catch (e) {
        console.error('[FAP-AIO Style] Error removing style:', e);
      }
    }
    
    this.injectedStyles.delete(id);
  }
}

// Export singleton instance
export const styleAdapter = new StyleAdapter();
