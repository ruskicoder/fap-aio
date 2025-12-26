/**
 * DOM Parser Utilities
 * 
 * Native browser API utilities to replace Cheerio dependency.
 * Provides helper functions for HTML parsing and DOM manipulation.
 */

/**
 * Parse an HTML string into a Document object
 * @param htmlString - HTML content as string
 * @returns Parsed Document object
 */
export function parseHTML(htmlString: string): Document {
  const parser = new DOMParser();
  return parser.parseFromString(htmlString, 'text/html');
}

/**
 * Parse an HTML fragment and return the first element
 * @param htmlString - HTML fragment as string
 * @returns First Element in the parsed HTML, or null if parsing fails
 */
export function parseHTMLFragment(htmlString: string): Element | null {
  const doc = parseHTML(htmlString);
  return doc.body.firstElementChild;
}

/**
 * Safely extract text content from an element
 * @param element - DOM element or null
 * @returns Trimmed text content, or empty string if element is null
 */
export function getText(element: Element | null): string {
  if (!element) return '';
  return (element.textContent || '').trim();
}

/**
 * Safely get an attribute value from an element
 * @param element - DOM element or null
 * @param attr - Attribute name
 * @returns Attribute value, or empty string if not found
 */
export function getAttr(element: Element | null, attr: string): string {
  if (!element) return '';
  return element.getAttribute(attr) || '';
}

/**
 * Query for a single element
 * @param selector - CSS selector
 * @param context - Context element or document (defaults to document)
 * @returns Matching element or null
 */
export function query(
  selector: string,
  context: Element | Document = document
): Element | null {
  return context.querySelector(selector);
}

/**
 * Query for all matching elements
 * @param selector - CSS selector
 * @param context - Context element or document (defaults to document)
 * @returns Array of matching elements (not NodeList)
 */
export function queryAll(
  selector: string,
  context: Element | Document = document
): Element[] {
  return Array.from(context.querySelectorAll(selector));
}

/**
 * Helper to extract table cell text safely
 * @param row - Table row element
 * @param cellIndex - Index of the cell to extract
 * @returns Trimmed text content or empty string
 */
export function getTableCellText(row: Element, cellIndex: number): string {
  const cells = queryAll('td, th', row);
  return getText(cells[cellIndex]);
}

/**
 * Parse HTML table into array of row objects
 * @param table - Table element
 * @param headers - Array of header names to use as keys
 * @returns Array of objects with header keys mapped to cell values
 */
export function parseTable<T extends Record<string, string>>(
  table: Element | null,
  headers: string[]
): T[] {
  if (!table) return [];
  
  const rows = queryAll('tbody tr', table);
  return rows.map(row => {
    const cells = queryAll('td, th', row);
    const rowData: Record<string, string> = {};
    
    headers.forEach((header, index) => {
      rowData[header] = getText(cells[index]);
    });
    
    return rowData as T;
  });
}
