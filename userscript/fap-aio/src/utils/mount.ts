/**
 * Shared React Mounting Utility for FAP-AIO Userscript
 * Centralizes ReactDOM.createRoot logic with error boundary support
 * 
 * Note: React and ReactDOM are loaded as globals from CDN via @require directives
 */

/// <reference path="../types/tampermonkey.d.ts" />

/**
 * Error Boundary Component
 */
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[FAP-AIO] React Error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return React.createElement(
        'div',
        {
          style: {
            padding: '20px',
            margin: '10px',
            background: '#ff4444',
            color: '#fff',
            borderRadius: '4px',
            fontFamily: 'Arial, sans-serif',
          },
        },
        `FAP-AIO: Feature failed to load. ${this.state.error?.message || 'Unknown error'}. Check console for details.`
      );
    }

    return this.props.children;
  }
}

interface MountOptions {
  withErrorBoundary?: boolean;
}

/**
 * Mount React component to container element
 * @param component - React component to mount
 * @param container - DOM element or selector string
 * @param options - Mounting options
 * @returns ReactDOM root instance for cleanup
 */
export function mountReactComponent(
  component: React.ReactElement,
  container: Element | string,
  options: MountOptions = { withErrorBoundary: true }
): ReactDOM.Root | null {
  try {
    // Resolve container
    let containerElement: Element | null;
    
    if (typeof container === 'string') {
      containerElement = document.querySelector(container);
      if (!containerElement) {
        console.error(`[FAP-AIO Mount] Container not found: ${container}`);
        return null;
      }
    } else {
      containerElement = container;
    }

    // Wrap with error boundary if enabled
    const wrappedComponent = options.withErrorBoundary
      ? React.createElement(ErrorBoundary, {}, component)
      : component;

    // Create root and render
    const root = ReactDOM.createRoot(containerElement as HTMLElement);
    root.render(wrappedComponent);

    return root;
  } catch (e) {
    console.error('[FAP-AIO Mount] Failed to mount component:', e);
    return null;
  }
}

/**
 * Unmount React component
 * @param root - ReactDOM root instance from mountReactComponent
 */
export function unmountReactComponent(root: ReactDOM.Root | null): void {
  if (root) {
    try {
      root.unmount();
    } catch (e) {
      console.error('[FAP-AIO Mount] Failed to unmount component:', e);
    }
  }
}
