import { Component, type ErrorInfo, type ReactNode } from "react";

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(
    error: Error
  ): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(
    error: Error,
    info: ErrorInfo
  ) {
    console.error(
      "❌ Erro de renderização capturado pelo ErrorBoundary:",
      error,
      info.componentStack
    );
  }

  render() {
    if (this.state.error) {
      return (
        <div className="mx-6 mb-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4">
          <p className="font-semibold text-red-400">
            ⚠️ Algo quebrou ao exibir esta seção
          </p>

          <p className="mt-1 text-sm text-zinc-400">
            {this.state.error.message}
          </p>

          <button
            type="button"
            onClick={() =>
              this.setState({ error: null })
            }
            className="mt-3 bg-red-500 hover:bg-red-400 text-white px-3 py-1.5 rounded-lg border-none cursor-pointer text-sm font-semibold transition"
          >
            Tentar novamente
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
