import React, { Component, ErrorInfo, ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI.
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-neutral-50 dark:bg-neutral-900 p-4">
          <div className="max-w-md w-full bg-white dark:bg-neutral-800 rounded-2xl shadow-xl p-8 text-center border border-neutral-200 dark:border-neutral-700">
            <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
              <span className="material-symbols-outlined text-3xl text-red-600 dark:text-red-400">error_outline</span>
            </div>
            <h1 className="text-2xl font-bold text-neutral-900 dark:text-white mb-2 font-display">Something went wrong</h1>
            <p className="text-neutral-600 dark:text-neutral-400 mb-6">
              The application encountered an unexpected error. This might be due to storage limits or a temporary glitch.
            </p>
            {this.state.error && (
                <div className="bg-neutral-100 dark:bg-neutral-900 p-3 rounded-lg text-left mb-6 overflow-auto max-h-32 text-xs font-mono text-red-600 dark:text-red-400 border border-neutral-200 dark:border-neutral-700">
                    {this.state.error.toString()}
                </div>
            )}
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-3 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 rounded-xl font-medium hover:opacity-90 transition-opacity w-full"
            >
              Reload Application
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
