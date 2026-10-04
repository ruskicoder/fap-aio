/**
 * DOM Parsing Utilities
 * Simple DOM parsing helpers for working with HTML strings
 */

/**
 * Parse HTML string into a Document fragment
 */
export function parseHTML(html: string): Document {
  const parser = new DOMParser();
  return parser.parseFromString(html, 'text/html');
}

/**
 * Query a single element from a document or element
 */
export function query<T extends Element = Element>(
  selector: string,
  parent: Document | Element = document
): T | null {
  return parent.querySelector<T>(selector);
}

/**
 * Query all elements from a document or element
 */
export function queryAll<T extends Element = Element>(
  selector: string,
  parent: Document | Element = document
): T[] {
  return Array.from(parent.querySelectorAll<T>(selector));
}

/**
 * Get text content from an element
 */
export function getText(element: Element | null): string {
  return element?.textContent?.trim() || '';
}

/**
 * Get attribute value from an element
 */
export function getAttr(element: Element | null, attribute: string): string {
  return element?.getAttribute(attribute) || '';
}
