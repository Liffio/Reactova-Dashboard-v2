import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = {
  children: ReactNode;
  /** Shown in the console log line to identify which boundary caught the error. */
  label?: string;
};

type State = {
  error: Error | null;
};

/**
 * Local (page-level) error boundary — distinct from the router's global
 * `errorComponent` (src/routes/__root.tsx), which shows a generic "This page
 * didn't load" with no detail. This one shows the actual error message and
 * stack so a crash is debuggable from the screen itself rather than requiring
 * console/log access, and lets one page's crash recover with a retry instead
 * of nuking the whole app shell.
 */
export class PageErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(
      `[PageErrorBoundary${this.props.label ? `:${this.props.label}` : ""}]`,
      error,
      info.componentStack,
    );
  }

  render() {
    const { error } = this.state;
    if (!error) {
      return this.props.children;
    }
    return (
      <div className="p-4 sm:p-6 md:p-10">
        <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-6">
          <h2 className="font-display text-lg font-semibold text-destructive">
            Something went wrong
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {error.message || "An unexpected error occurred while rendering this page."}
          </p>
          {error.stack && (
            <pre className="mt-4 max-h-64 overflow-auto rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground">
              {error.stack}
            </pre>
          )}
          <button
            type="button"
            className="mt-4 inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            onClick={() => this.setState({ error: null })}
          >
            Try again
          </button>
        </div>
      </div>
    );
  }
}
