/**
 * DOM Parsing Helpers for MoveOut (self-contained)
 * Replaces cheerio usage from standalone fap-moveout with browser DOMParser
 */

export function parseHTML(html: string): Document {
  const parser = new DOMParser();
  return parser.parseFromString(html, 'text/html');
}

export function query<T extends Element = Element>(
  selector: string,
  parent: Document | Element = document
): T | null {
  return parent.querySelector<T>(selector);
}

export function queryAll<T extends Element = Element>(
  selector: string,
  parent: Document | Element = document
): T[] {
  return Array.from(parent.querySelectorAll<T>(selector));
}

export function getText(element: Element | null): string {
  return element?.textContent?.trim() || '';
}

export function getAttr(element: Element | null, attribute: string): string {
  return element?.getAttribute(attribute) || '';
}
