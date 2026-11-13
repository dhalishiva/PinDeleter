import { Component, type ErrorInfo, type ReactNode } from 'react';
import { RefreshCw } from 'lucide-react';
import { OopsIllustration } from './Illustrations';

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('UI error', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-4 text-center">
        <OopsIllustration className="mb-6 h-40 w-40" />
        <h1 className="text-2xl">Something went sideways</h1>
        <p className="mt-2 text-muted">
          An unexpected error happened on this screen. Nothing was deleted. Reloading usually fixes it.
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-6 inline-flex h-11 items-center gap-2 rounded-full bg-sunset px-5 font-bold text-white shadow-glow"
        >
          <RefreshCw className="h-4 w-4" /> Reload
        </button>
      </div>
    );
  }
}
