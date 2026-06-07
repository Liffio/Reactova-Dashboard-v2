import { Component, type ReactNode, type ErrorInfo } from "react";
import * as Sentry from "@sentry/react";

type Props = {
  children: ReactNode;
  fallback?: ReactNode;
};

type State = {
  hasError: boolean;
  eventId?: string;
};

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    const eventId = Sentry.captureException(error, {
      extra: { componentStack: info.componentStack }
    });
    this.setState({ eventId });
  }

  render(): ReactNode {
    if (!this.state.hasError) return this.props.children;

    if (this.props.fallback) return this.props.fallback;

    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6">
        <div className="max-w-md text-center">
          <h1 className="mb-2 text-2xl font-semibold tracking-tight">Something went wrong</h1>
          <p className="mb-6 text-sm text-muted-foreground">
            An unexpected error occurred. Our team has been notified.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Reload page
          </button>
        </div>
      </div>
    );
  }
}

export const SentryErrorBoundary = Sentry.withErrorBoundary;
