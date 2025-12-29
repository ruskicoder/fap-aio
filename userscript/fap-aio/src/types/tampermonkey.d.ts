/**
 * Tampermonkey/Greasemonkey API Type Declarations
 * Provides TypeScript types for userscript GM_* functions
 */

declare function GM_setValue(key: string, value: any): void;
declare function GM_getValue(key: string, defaultValue?: any): any;
declare function GM_deleteValue(key: string): void;
declare function GM_addStyle(css: string): HTMLStyleElement;

interface GMXMLHttpRequestResponse {
  responseText: string;
  responseHeaders: string;
  status: number;
  statusText: string;
  finalUrl: string;
}

interface GMXMLHttpRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD';
  url: string;
  headers?: Record<string, string>;
  data?: string | FormData;
  timeout?: number;
  onload?: (response: GMXMLHttpRequestResponse) => void;
  onerror?: (error: GMXMLHttpRequestResponse) => void;
  ontimeout?: () => void;
}

declare function GM_xmlhttpRequest(options: GMXMLHttpRequestOptions): void;

interface GMInfo {
  script: {
    name: string;
    namespace: string;
    version: string;
  };
  scriptHandler: string;
  version: string;
}

declare const GM_info: GMInfo;

/**
 * React and ReactDOM globals from CDN
 * These are loaded via @require directives in the userscript metadata
 */
declare namespace React {
  export type ReactNode = any;
  export type ReactElement = any;
  export interface ErrorInfo {
    componentStack: string;
  }
  export class Component<P = {}, S = {}> {
    constructor(props: P);
    props: P;
    state: S;
    setState(state: Partial<S>): void;
    render(): ReactNode;
    componentDidCatch?(error: Error, errorInfo: ErrorInfo): void;
    static getDerivedStateFromError?(error: Error): any;
  }
  export function createElement(type: any, props?: any, ...children: any[]): ReactElement;
}

declare namespace ReactDOM {
  export interface Root {
    render(element: React.ReactElement): void;
    unmount(): void;
  }
  export function createRoot(container: HTMLElement): Root;
}

declare const React: typeof React;
declare const ReactDOM: typeof ReactDOM;

