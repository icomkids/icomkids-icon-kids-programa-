import { Component, type ReactNode } from "react";

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack?: string }) {
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="m-6 rounded-xl border-2 border-[#EA4D8E] bg-[#EA4D8E]/10 p-6 font-mono text-sm">
          <p className="text-base font-bold text-[#EA4D8E]">
            Erro de renderizacao
          </p>
          <p className="mt-2 font-bold">{this.state.error.message}</p>
          <pre className="mt-3 max-h-60 overflow-auto whitespace-pre-wrap text-xs text-muted-foreground">
            {this.state.error.stack}
          </pre>
          <button
            type="button"
            className="mt-4 rounded-md bg-[#1E78DC] px-3 py-1.5 text-xs font-bold text-white"
            onClick={() => this.setState({ error: null })}
          >
            Tentar novamente
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
